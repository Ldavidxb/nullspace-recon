// Raw MRI data loaders for HDF5-based formats:
//   • fastMRI multicoil / singlecoil files   (dataset `kspace`: [slices, (coils,) ro, pe] complex64)
//   • ISMRMRD raw data                       (`/dataset/data` acquisitions + `/dataset/xml` header)
// Works with any h5wasm `File`, so the same code runs in the browser worker and in Node tests.

import type { RawScan } from './sense.ts';

// Minimal structural types for the parts of h5wasm used here.
interface H5Dataset {
  shape: number[] | null;
  dtype: unknown;
  metadata: { size: number; type: number; compound_type?: { members: { name: string; offset: number; size: number; compound_type?: { members: { name: string }[] } }[] } };
  slice(ranges: number[][]): unknown;
  value: unknown;
}
interface H5File {
  get(path: string): H5Dataset | unknown;
  keys(): string[];
}
interface H5Module {
  HEAPU8: Uint8Array;
  _malloc(n: number): number;
  _free(p: number): void;
  get_dataset_data(fileId: bigint, path: string, count: bigint[] | null, offset: bigint[] | null, strides: bigint[] | null, ptr: bigint): number;
}

export interface LoadedScan {
  scan: RawScan;
  slices: number;
  slice: number;
}

/** Read a hyperslab of a complex64 (compound r,i float32) dataset as raw interleaved floats. */
function readComplexSlab(Module: H5Module, file: { file_id: bigint }, path: string, start: number[], count: number[]): Float32Array {
  const total = count.reduce((a, b) => a * b, 1);
  const nbytes = total * 8;
  const ptr = Module._malloc(nbytes);
  if (!ptr) throw new Error('Out of memory while reading k-space.');
  try {
    Module.get_dataset_data(file.file_id, path, count.map(BigInt), start.map(BigInt), count.map(() => 1n), BigInt(ptr));
    const bytes = Module.HEAPU8.slice(ptr, ptr + nbytes);
    return new Float32Array(bytes.buffer);
  } finally {
    Module._free(ptr);
  }
}

function isComplexCompound(ds: H5Dataset) {
  const m = ds.metadata.compound_type?.members;
  return !!m && m.length === 2 && m[0].size === 4 && m[1].size === 4;
}

function detectSampled(re: Float32Array, im: Float32Array, coils: number, ro: number, pe: number) {
  const sampled = new Uint8Array(pe);
  for (let l = 0; l < pe; l++) {
    outer: for (let c = 0; c < coils; c++) for (let r = 0; r < ro; r += 7) {
      const i = (c * ro + r) * pe + l;
      if (re[i] !== 0 || im[i] !== 0) { sampled[l] = 1; break outer; }
    }
  }
  return sampled;
}

export function loadFastMRI(Module: H5Module, file: H5File & { file_id: bigint }, fileName: string, sliceIndex?: number): LoadedScan {
  const ds = file.get('kspace') as H5Dataset;
  if (!ds?.shape) throw new Error('No `kspace` dataset found — is this a fastMRI file?');
  if (!isComplexCompound(ds)) throw new Error('`kspace` is not complex64 data.');
  const shape = ds.shape;
  const multi = shape.length === 4;
  const [S, C, RO, PE] = multi ? shape : [shape[0], 1, shape[1], shape[2]];
  const s = sliceIndex ?? Math.floor(S / 2);
  if (s < 0 || s >= S) throw new Error(`Slice ${s} out of range (file has ${S}).`);

  const raw = multi
    ? readComplexSlab(Module, file, 'kspace', [s, 0, 0, 0], [1, C, RO, PE])
    : readComplexSlab(Module, file, 'kspace', [s, 0, 0], [1, RO, PE]);
  const re = new Float32Array(C * RO * PE), im = new Float32Array(C * RO * PE);
  for (let i = 0; i < re.length; i++) { re[i] = raw[2 * i]; im[i] = raw[2 * i + 1]; }

  let reconRO = RO > 1.5 * PE ? Math.round(RO / 2) : RO;
  const rss = file.keys().includes('reconstruction_rss') ? (file.get('reconstruction_rss') as H5Dataset) : null;
  if (rss?.shape && rss.shape.length === 3) reconRO = Math.min(RO, rss.shape[1]);

  return {
    scan: {
      coils: C, ro: RO, pe: PE, re, im,
      sampled: detectSampled(re, im, C, RO, PE),
      reconRO, format: 'fastmri',
      label: `fastMRI ${multi ? `${C}-coil` : 'single-coil'} · ${fileName} · slice ${s + 1}/${S}`,
    },
    slices: S, slice: s,
  };
}

const xmlNum = (xml: string, path: string[]): number | undefined => {
  let scope = xml;
  for (const tag of path) {
    const m = scope.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    if (!m) return undefined;
    scope = m[1];
  }
  const v = Number(scope.trim());
  return Number.isFinite(v) ? v : undefined;
};

export function loadISMRMRD(file: H5File, fileName: string, sliceIndex?: number): LoadedScan {
  const group = file.keys().includes('dataset') ? 'dataset' : file.keys()[0];
  const xmlDs = file.get(`${group}/xml`) as H5Dataset;
  const dataDs = file.get(`${group}/data`) as H5Dataset;
  if (!dataDs?.shape) throw new Error('No ISMRMRD acquisitions found (expected /dataset/data).');
  const xmlRaw = xmlDs?.value;
  const xml = String(Array.isArray(xmlRaw) ? xmlRaw[0] : xmlRaw ?? '');
  const RO = xmlNum(xml, ['encodedSpace', 'matrixSize', 'x']);
  const PE = xmlNum(xml, ['encodedSpace', 'matrixSize', 'y']);
  const reconX = xmlNum(xml, ['reconSpace', 'matrixSize', 'x']);
  const centerPE = xmlNum(xml, ['kspace_encoding_step_1', 'center']);
  if (!RO || !PE) throw new Error('Could not read the encoded matrix size from the ISMRMRD header.');
  const traj = xml.match(/<trajectory>\s*([A-Za-z_]+)/)?.[1];
  if (traj && traj.toLowerCase() !== 'cartesian') throw new Error('Only Cartesian ISMRMRD acquisitions are supported in Phase 0.');

  const members = dataDs.metadata.compound_type!.members;
  const hi = members.findIndex(m => m.name === 'head'), di = members.findIndex(m => m.name === 'data');
  const headNames = members[hi].compound_type!.members.map(m => m.name);
  const H = (name: string) => headNames.indexOf(name);
  const iFlags = H('flags'), iNs = H('number_of_samples'), iCh = H('active_channels'), iCenter = H('center_sample'), iIdx = H('idx');

  const rows = dataDs.slice([[0, dataDs.shape[0]]]) as unknown[][];
  const NOISE = 1n << 18n, NAV = 1n << 22n, PHASECORR = 1n << 21n; // ACQ_IS_NOISE_MEASUREMENT, NAVIGATION, PHASECORR

  const slicesSeen = new Set<number>();
  for (const row of rows) {
    const head = row[hi] as unknown[];
    const flags = BigInt(head[iFlags] as number | bigint);
    if (flags & (NOISE | NAV | PHASECORR)) continue;
    slicesSeen.add(Number((head[iIdx] as unknown[])[3]));
  }
  const sliceList = [...slicesSeen].sort((a, b) => a - b);
  if (!sliceList.length) throw new Error('No imaging acquisitions in this file.');
  const s = sliceIndex ?? sliceList[Math.floor(sliceList.length / 2)];

  let C = 0;
  for (const row of rows) {
    const head = row[hi] as unknown[];
    C = Math.max(C, Number(head[iCh]));
  }
  const re = new Float32Array(C * RO * PE), im = new Float32Array(C * RO * PE);
  const counts = new Uint16Array(PE);
  const center = centerPE ?? Math.floor(PE / 2);

  for (const row of rows) {
    const head = row[hi] as unknown[];
    const flags = BigInt(head[iFlags] as number | bigint);
    if (flags & (NOISE | NAV | PHASECORR)) continue;
    const idx = head[iIdx] as unknown[];
    if (Number(idx[3]) !== s) continue;
    const l = Number(idx[0]) - center + Math.floor(PE / 2);
    if (l < 0 || l >= PE) continue;
    const ns = Number(head[iNs]), ch = Number(head[iCh]), cs = Number(head[iCenter]);
    const data = row[di] as Float32Array;
    for (let c = 0; c < ch; c++) for (let k = 0; k < ns; k++) {
      const r = k - cs + Math.floor(RO / 2);
      if (r < 0 || r >= RO) continue;
      const i = (c * RO + r) * PE + l;
      re[i] += data[2 * (c * ns + k)];
      im[i] += data[2 * (c * ns + k) + 1];
    }
    counts[l]++;
  }
  // average repeated acquisitions of the same line
  for (let l = 0; l < PE; l++) if (counts[l] > 1) {
    for (let c = 0; c < C; c++) for (let r = 0; r < RO; r++) { const i = (c * RO + r) * PE + l; re[i] /= counts[l]; im[i] /= counts[l]; }
  }
  const sampled = new Uint8Array(PE);
  for (let l = 0; l < PE; l++) sampled[l] = counts[l] > 0 ? 1 : 0;

  return {
    scan: {
      coils: C, ro: RO, pe: PE, re, im, sampled,
      reconRO: reconX && reconX < RO ? reconX : RO,
      format: 'ismrmrd',
      label: `ISMRMRD ${C}-coil · ${fileName} · slice ${sliceList.indexOf(s) + 1}/${sliceList.length}`,
    },
    slices: sliceList.length, slice: s,
  };
}

/** Detect the format from the HDF5 layout and load one slice. */
export function loadRawFile(Module: H5Module, file: H5File & { file_id: bigint }, fileName: string, sliceIndex?: number): LoadedScan {
  const keys = file.keys();
  if (keys.includes('kspace')) return loadFastMRI(Module, file, fileName, sliceIndex);
  if (keys.includes('dataset')) return loadISMRMRD(file, fileName, sliceIndex);
  throw new Error(`Unrecognised HDF5 layout (top-level: ${keys.join(', ') || 'empty'}). Expected fastMRI (kspace) or ISMRMRD (/dataset).`);
}
