// Built-in simulated acquisition: an 8-channel brain-like phantom at clinical matrix
// size, fully sampled, with Gaussian noise. Produces the same RawScan structure as
// the file loaders so it exercises the identical analysis path.

import { FFT } from './fft.ts';
import type { RawScan } from './sense.ts';

const ELLIPSES = [
  [1.0, 0.69, 0.92, 0, 0, 0], [-0.8, 0.6624, 0.874, 0, -0.0184, 0],
  [-0.2, 0.11, 0.31, 0.22, 0, -18], [-0.2, 0.16, 0.41, -0.22, 0, 18],
  [0.1, 0.21, 0.25, 0, 0.35, 0], [0.1, 0.046, 0.046, 0, 0.1, 0],
  [0.1, 0.046, 0.046, 0, -0.1, 0], [0.1, 0.046, 0.023, -0.08, -0.605, 0],
  [0.1, 0.023, 0.023, 0, -0.606, 0], [0.1, 0.023, 0.046, 0.06, -0.605, 0],
];

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateScan({ ro = 320, pe = 368, coils = 8, sigma = 0.006, seed = 11 } = {}): RawScan {
  const rand = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  const size = Math.round(ro * 0.9);
  const img = new Float64Array(ro * pe);
  for (let r = 0; r < ro; r++) for (let l = 0; l < pe; l++) {
    const x = ((l - pe / 2) / size) * 2, y = -((r - ro / 2) / size) * 2;
    let v = 0;
    for (const [A, a, b, x0, y0, phi] of ELLIPSES) {
      const t = (phi * Math.PI) / 180, dx = x - x0, dy = y - y0;
      const xr = dx * Math.cos(t) + dy * Math.sin(t), yr = -dx * Math.sin(t) + dy * Math.cos(t);
      if ((xr * xr) / (a * a) + (yr * yr) / (b * b) <= 1) v += A;
    }
    // gentle texture so the prior has something to smooth
    img[r * pe + l] = v > 0 ? v * (1 + 0.04 * Math.sin(x * 23) * Math.cos(y * 19)) : 0;
  }

  const re = new Float32Array(coils * ro * pe), im = new Float32Array(coils * ro * pe);
  const fRO = new FFT(ro), fPE = new FFT(pe);
  const rowRe = new Float64Array(pe), rowIm = new Float64Array(pe);
  const colRe = new Float64Array(ro), colIm = new Float64Array(ro);
  const tmpRe = new Float64Array(ro * pe), tmpIm = new Float64Array(ro * pe);
  for (let c = 0; c < coils; c++) {
    const ang = (2 * Math.PI * c) / coils;
    const py = ro / 2 + 0.75 * (ro / 2) * Math.sin(ang), px = pe / 2 + 0.75 * (ro / 2) * Math.cos(ang);
    for (let r = 0; r < ro; r++) for (let l = 0; l < pe; l++) {
      const d2 = ((r - py) ** 2 + (l - px) ** 2) / (0.5 * ro) ** 2;
      const mag = Math.exp(-d2);
      const ph = 0.6 * Math.PI * (((r - ro / 2) * Math.sin(ang) + (l - pe / 2) * Math.cos(ang)) / ro) + 0.3 * Math.PI * (l / pe);
      const v = img[r * pe + l] * mag;
      tmpRe[r * pe + l] = v * Math.cos(ph); tmpIm[r * pe + l] = v * Math.sin(ph);
    }
    for (let r = 0; r < ro; r++) {
      for (let l = 0; l < pe; l++) { rowRe[l] = tmpRe[r * pe + l]; rowIm[l] = tmpIm[r * pe + l]; }
      fPE.centered(rowRe, rowIm, false);
      for (let l = 0; l < pe; l++) { tmpRe[r * pe + l] = rowRe[l]; tmpIm[r * pe + l] = rowIm[l]; }
    }
    for (let l = 0; l < pe; l++) {
      for (let r = 0; r < ro; r++) { colRe[r] = tmpRe[r * pe + l]; colIm[r] = tmpIm[r * pe + l]; }
      fRO.centered(colRe, colIm, false);
      for (let r = 0; r < ro; r++) {
        const i = (c * ro + r) * pe + l;
        re[i] = colRe[r] + sigma * gauss(); im[i] = colIm[r] + sigma * gauss();
      }
    }
  }
  return {
    coils, ro, pe, re, im, sampled: new Uint8Array(pe).fill(1), reconRO: ro,
    format: 'simulation', label: `Simulated ${coils}-channel brain phantom · ${ro}×${pe} · fully sampled`,
  };
}
