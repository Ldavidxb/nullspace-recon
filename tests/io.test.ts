import h5wasm, { Module } from 'h5wasm/node';
import { loadRawFile } from '../src/lib/mri/io.ts';
import { analyzeScan } from '../src/lib/mri/sense.ts';
await h5wasm.ready;
const dir = process.argv[2];
const out: Record<string, number[]> = {};
for (const name of ['sim_fastmri_multicoil.h5', 'sim_ismrmrd.h5']) {
  const f = new h5wasm.File(`${dir}/${name}`, 'r');
  const t = performance.now();
  const { scan, slices, slice } = loadRawFile(Module as never, f as never, name);
  console.log(name, '→', scan.label, `coils=${scan.coils} ro=${scan.ro} pe=${scan.pe} reconRO=${scan.reconRO}`, 'sampled', scan.sampled.reduce((a, b) => a + b, 0), 'slices', slices, slice, Math.round(performance.now() - t), 'ms');
  f.close();
  const a = await analyzeScan(scan, { acceleration: 4 });
  const r = a.scenarios[0].result;
  out[name] = [r.statistic, ...r.band_energy_shares!];
  for (const sc of a.scenarios) console.log('  ', sc.id.padEnd(8), 'p', sc.result.p_value.toPrecision(3), 'chi2r', sc.result.reduced_chi2, 'shares', sc.result.band_energy_shares, 'relErr', sc.result.rel_error);
  console.log('   timings', JSON.stringify(a.meta.timingsMs));
}
const [a, b] = Object.values(out);
console.log('fastMRI vs ISMRMRD identical:', a.every((v, i) => Math.abs(v - b[i]) < 1e-6 * Math.max(1, Math.abs(v))));
