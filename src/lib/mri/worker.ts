// Web Worker: loads raw data and runs the full-resolution analysis off the main thread.
import { analyzeScan } from './sense.ts';
import { simulateScan } from './simulate.ts';
import type { RawScan } from './sense.ts';

export type MriRequest =
  | { type: 'simulate'; acceleration: number }
  | { type: 'file'; file: File; acceleration: number; slice?: number };

const ctx = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent<MriRequest>) => void) | null };
const progress = (stage: string, fraction: number) => ctx.postMessage({ type: 'progress', stage, fraction });

// The shareable single-file demo build (VITE_DEMO) leaves out the 4 MB HDF5 reader.
const loadFile = import.meta.env.VITE_DEMO ? undefined : async (file: File, slice?: number): Promise<RawScan> => {
  progress('Opening HDF5 file', 0);
  const [h5, { loadRawFile }] = await Promise.all([import('h5wasm'), import('./io.ts')]);
  const { FS } = await h5.default.ready;
  const fs = FS as unknown as { mkdir(p: string): void; mount(t: unknown, o: unknown, p: string): void; unmount(p: string): void; filesystems: Record<string, unknown> };
  try { fs.unmount('/work'); } catch { /* not mounted yet */ }
  try { fs.mkdir('/work'); } catch { /* exists */ }
  fs.mount(fs.filesystems.WORKERFS, { files: [file] }, '/work');
  const f = new h5.default.File(`/work/${file.name}`, 'r');
  try {
    progress('Reading k-space', 0.01);
    return loadRawFile(h5.Module as never, f as never, file.name, slice).scan;
  } finally {
    f.close();
  }
};

ctx.onmessage = async e => {
  const req = e.data;
  try {
    const scan = req.type === 'simulate'
      ? (progress('Simulating 8-channel acquisition', 0), simulateScan())
      : loadFile ? await loadFile(req.file, req.slice) : (() => { throw new Error('File loading is not included in this demo build.'); })();
    const analysis = await analyzeScan(scan, { acceleration: req.acceleration }, progress);
    ctx.postMessage({ type: 'result', analysis });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
