// Full-resolution Cartesian multi-coil MRI verification (SENSE model).
//
// Model: y = M F_pe S x + e, with the readout direction fully sampled and the
// phase-encode (PE) direction undersampled on an equispaced grid (every R-th
// line, plus a fully-sampled calibration region used only to estimate coil
// sensitivities). Working in hybrid space (x, k_y), the normal operator
// N = A^H A couples only pixels in the same SENSE aliasing set, so it is block
// diagonal with R×R Hermitian blocks. Each block is diagonalised exactly, which
// gives an exact spectral decomposition of the operator:
//
//   measured         λ ≥ τ_hi   (noise amplification g ≤ √2)
//   ill-conditioned  τ_lo ≤ λ < τ_hi
//   null / near-null λ < τ_lo   (g > 5, or no sensitivity at all)
//
// with λ normalised so that a perfectly conditioned block has λ = 1/R. The three
// bands are orthogonal projections, so their energies sum to the image energy.

import { FFT } from './fft.ts';
import { jacobiEigen } from './eigen.ts';
import { sha256Hex } from '../sha256.ts';
import type { VerificationResult } from '../engine.ts';

export interface RawScan {
  coils: number;
  ro: number;
  pe: number;
  /** Centred k-space, index ((c * ro) + r) * pe + l. Unacquired lines are zero. */
  re: Float32Array;
  im: Float32Array;
  /** 1 for every acquired phase-encode line. */
  sampled: Uint8Array;
  /** Image-domain readout size to keep (removes readout oversampling). */
  reconRO: number;
  format: 'simulation' | 'fastmri' | 'ismrmrd';
  label: string;
}

export interface AnalysisOptions {
  /** Acceleration to simulate when the scan is fully sampled. Ignored for undersampled scans. */
  acceleration: number;
  /** Lesion radius in pixels. */
  lesionRadius?: number;
}

export type ScenarioId = 'baseline' | 'hidden' | 'edit';

export interface MriScenario {
  id: ScenarioId;
  label: string;
  blurb: string;
  result: VerificationResult;
  deltaChi2: number;
}

export interface MriAnalysis {
  scenarios: MriScenario[];
  meta: {
    acceleration: number;
    coils: number;
    sigmaThermal: number;
    hiddenLesionPeak: number;
    matrix: [number, number];
    sampledLines: number;
    acsLines: number;
    sigma: number;
    fullySampled: boolean;
    label: string;
    format: RawScan['format'];
    timingsMs: Record<string, number>;
  };
}

export type ProgressFn = (stage: string, fraction: number) => void;

const BANDS = { hi: 0.5, lo: 0.04 }; // in units of 1/R

// ---------------------------------------------------------------------------

function percentile(values: Float64Array | number[], p: number) {
  const a = Float64Array.from(values).sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

function hann(n: number, center: number, half: number) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(i - center);
    w[i] = d < half ? 0.5 + 0.5 * Math.cos((Math.PI * d) / half) : 0;
  }
  return w;
}

/** Flood-fill the background from the border; anything unreachable is inside the object. */
function fillHoles(mask: Uint8Array, h: number, w: number) {
  const outside = new Uint8Array(h * w);
  const stack: number[] = [];
  const push = (i: number) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < h; x++) { push(x * w); push(x * w + w - 1); }
  for (let y = 0; y < w; y++) { push(y); push((h - 1) * w + y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = Math.floor(i / w), y = i % w;
    if (x > 0) push(i - w);
    if (x < h - 1) push(i + w);
    if (y > 0) push(i - 1);
    if (y < w - 1) push(i + 1);
  }
  for (let i = 0; i < h * w; i++) mask[i] = outside[i] ? 0 : 1;
}

function dilate(mask: Uint8Array, h: number, w: number, r: number, erode = false) {
  const out = new Uint8Array(h * w);
  for (let x = 0; x < h; x++) for (let y = 0; y < w; y++) {
    let hit = erode ? 1 : 0;
    for (let dx = -r; dx <= r && (erode ? hit : !hit); dx++) for (let dy = -r; dy <= r; dy++) {
      if (dx * dx + dy * dy > r * r) continue;
      const xx = x + dx, yy = y + dy;
      const v = xx >= 0 && yy >= 0 && xx < h && yy < w ? mask[xx * w + yy] : 0;
      if (erode && !v) { hit = 0; break; }
      if (!erode && v) { hit = 1; break; }
    }
    out[x * w + y] = hit;
  }
  return out;
}

function boxBlur(src: Float64Array, h: number, w: number, r: number) {
  const tmp = new Float64Array(h * w), out = new Float64Array(h * w);
  for (let x = 0; x < h; x++) for (let y = 0; y < w; y++) {
    let s = 0, c = 0;
    for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < w) { s += src[x * w + yy]; c++; } }
    tmp[x * w + y] = s / c;
  }
  for (let x = 0; x < h; x++) for (let y = 0; y < w; y++) {
    let s = 0, c = 0;
    for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < h) { s += tmp[xx * w + y]; c++; } }
    out[x * w + y] = s / c;
  }
  return out;
}

/** Complex total-variation denoiser (smoothed TV, gradient descent) — the "prior" that fills unmeasured content. */
function tvDenoise(re0: Float64Array, im0: Float64Array, h: number, w: number, mask: Uint8Array, lam = 0.035, iters = 80) {
  const re = re0.slice(), im = im0.slice();
  const n = h * w, eps = 0.05, tau = 0.18;
  const pxr = new Float64Array(n), pxi = new Float64Array(n), pyr = new Float64Array(n), pyi = new Float64Array(n);
  for (let it = 0; it < iters; it++) {
    for (let x = 0; x < h; x++) for (let y = 0; y < w; y++) {
      const i = x * w + y;
      const gxr = x < h - 1 ? re[i + w] - re[i] : 0, gxi = x < h - 1 ? im[i + w] - im[i] : 0;
      const gyr = y < w - 1 ? re[i + 1] - re[i] : 0, gyi = y < w - 1 ? im[i + 1] - im[i] : 0;
      const m = Math.sqrt(gxr * gxr + gxi * gxi + gyr * gyr + gyi * gyi + eps * eps);
      pxr[i] = gxr / m; pxi[i] = gxi / m; pyr[i] = gyr / m; pyi[i] = gyi / m;
    }
    for (let x = 0; x < h; x++) for (let y = 0; y < w; y++) {
      const i = x * w + y;
      if (!mask[i]) continue;
      const divr = pxr[i] - (x > 0 ? pxr[i - w] : 0) + pyr[i] - (y > 0 ? pyr[i - 1] : 0);
      const divi = pxi[i] - (x > 0 ? pxi[i - w] : 0) + pyi[i] - (y > 0 ? pyi[i - 1] : 0);
      re[i] -= tau * (re[i] - re0[i] - lam * divr);
      im[i] -= tau * (im[i] - im0[i] - lam * divi);
    }
  }
  return { re, im };
}

function chi2UpperTail(stat: number, dof: number) {
  if (dof <= 0) return NaN;
  const z = (Math.cbrt(stat / dof) - (1 - 2 / (9 * dof))) / Math.sqrt(2 / (9 * dof));
  return 0.5 * erfc(z / Math.SQRT2);
}

function erfc(x: number) {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? y : 2 - y;
}

// ---------------------------------------------------------------------------

/** Infer the equispaced sub-grid (R, offset) and calibration lines of an acquisition. */
export function inferSampling(sampled: Uint8Array, requestedR: number) {
  const W = sampled.length;
  const all = sampled.every(v => v === 1);
  const centre = Math.floor(W / 2);
  // contiguous acquired block around the centre = calibration region
  let a = centre, b = centre;
  while (a > 0 && sampled[a - 1]) a--;
  while (b < W - 1 && sampled[b + 1]) b++;
  if (all) {
    const R = requestedR;
    if (W % R !== 0) throw new Error(`Phase-encode size ${W} is not divisible by R=${R}. Choose another acceleration.`);
    const acs = Math.max(16, Math.round((W * (R >= 8 ? 0.04 : 0.08)) / 2) * 2);
    return { R, offset: centre % R, acsStart: centre - acs / 2, acsEnd: centre + acs / 2 - 1, fullySampled: true };
  }
  // undersampled: lines outside the calibration block define the grid
  const outer: number[] = [];
  for (let l = 0; l < W; l++) if (sampled[l] && (l < a || l > b)) outer.push(l);
  if (outer.length < 2) throw new Error('Could not find an equispaced undersampling pattern outside the calibration region.');
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);
  let R = 0;
  for (let i = 1; i < outer.length; i++) R = gcd(R, outer[i] - outer[i - 1]);
  const offset = outer[0] % R;
  if (R < 2 || W % R !== 0 || outer.some(l => l % R !== offset)) {
    throw new Error('This acquisition uses a non-equispaced (e.g. random) mask. Phase 0 supports equispaced Cartesian undersampling.');
  }
  for (let l = offset; l < W; l += R) {
    if (!sampled[l]) throw new Error(`Line ${l} of the equispaced grid (R=${R}) was not acquired.`);
  }
  if (b - a + 1 < 8) throw new Error('Not enough fully-sampled calibration lines (need ≥ 8) to estimate coil sensitivities.');
  return { R, offset, acsStart: a, acsEnd: b, fullySampled: false };
}

export async function analyzeScan(scan: RawScan, opts: AnalysisOptions, progress: ProgressFn = () => {}): Promise<MriAnalysis> {
  const timings: Record<string, number> = {};
  let t0 = performance.now();
  const lap = (k: string) => { const t = performance.now(); timings[k] = Math.round(t - t0); t0 = t; };

  const C = scan.coils, RO = scan.ro, W = scan.pe;
  const H = Math.min(scan.reconRO, RO);
  const samp = inferSampling(scan.sampled, opts.acceleration);
  const R = samp.R, nb = W / R;
  const lines: number[] = [];
  for (let l = samp.offset; l < W; l += R) lines.push(l);
  const lineMask = new Uint8Array(W);
  for (const l of lines) lineMask[l] = 1;

  // 1. Hybrid space: inverse FFT along readout, crop the oversampling.
  progress('Readout transform', 0.02);
  const fftRO = new FFT(RO), fftPE = new FFT(W), fftH = new FFT(H);
  const hre = new Float64Array(C * H * W), him = new Float64Array(C * H * W);
  {
    const colRe = new Float64Array(RO), colIm = new Float64Array(RO);
    const off = Math.floor((RO - H) / 2);
    for (let c = 0; c < C; c++) {
      for (let l = 0; l < W; l++) {
        if (!scan.sampled[l]) continue;
        for (let r = 0; r < RO; r++) {
          const i = (c * RO + r) * W + l;
          colRe[r] = scan.re[i]; colIm[r] = scan.im[i];
        }
        fftRO.centered(colRe, colIm, true);
        for (let x = 0; x < H; x++) {
          const j = (c * H + x) * W + l;
          hre[j] = colRe[x + off]; him[j] = colIm[x + off];
        }
      }
    }
  }
  lap('hybrid');

  // 2. Coil sensitivities from the calibration region (low-resolution ratio method).
  progress('Estimating coil sensitivities', 0.15);
  const n = H * W;
  const lowRe = new Float64Array(C * n), lowIm = new Float64Array(C * n);
  {
    const acsN = samp.acsEnd - samp.acsStart + 1;
    const wPE = hann(W, Math.floor(W / 2), acsN / 2);
    const wRO = hann(H, Math.floor(H / 2), Math.max(8, (acsN / W) * H));
    const rowRe = new Float64Array(W), rowIm = new Float64Array(W);
    const colRe = new Float64Array(H), colIm = new Float64Array(H);
    for (let c = 0; c < C; c++) {
      // PE: window the calibration lines and transform to image space
      for (let x = 0; x < H; x++) {
        for (let l = 0; l < W; l++) {
          const j = (c * H + x) * W + l;
          const inAcs = l >= samp.acsStart && l <= samp.acsEnd;
          rowRe[l] = inAcs ? hre[j] * wPE[l] : 0; rowIm[l] = inAcs ? him[j] * wPE[l] : 0;
        }
        fftPE.centered(rowRe, rowIm, true);
        for (let y = 0; y < W; y++) { lowRe[c * n + x * W + y] = rowRe[y]; lowIm[c * n + x * W + y] = rowIm[y]; }
      }
      // RO: low-pass along x as well
      for (let y = 0; y < W; y++) {
        for (let x = 0; x < H; x++) { colRe[x] = lowRe[c * n + x * W + y]; colIm[x] = lowIm[c * n + x * W + y]; }
        fftH.centered(colRe, colIm, false);
        for (let x = 0; x < H; x++) { colRe[x] *= wRO[x]; colIm[x] *= wRO[x]; }
        fftH.centered(colRe, colIm, true);
        for (let x = 0; x < H; x++) { lowRe[c * n + x * W + y] = colRe[x]; lowIm[c * n + x * W + y] = colIm[x]; }
      }
    }
  }
  const rss = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < C; c++) s += lowRe[c * n + i] ** 2 + lowIm[c * n + i] ** 2;
    rss[i] = Math.sqrt(s);
  }
  const rssMax = percentile(rss, 0.995);
  let mask: Uint8Array = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = rss[i] > 0.07 * rssMax ? 1 : 0;
  fillHoles(mask, H, W);
  mask = dilate(mask, H, W, 2);
  const sRe = new Float64Array(C * n), sIm = new Float64Array(C * n);
  for (let i = 0; i < n; i++) {
    if (!mask[i] || rss[i] === 0) continue;
    for (let c = 0; c < C; c++) { sRe[c * n + i] = lowRe[c * n + i] / rss[i]; sIm[c * n + i] = lowIm[c * n + i] / rss[i]; }
  }
  lap('sensitivities');

  // 3. Noise level and fully-sampled reference.
  progress('Noise calibration', 0.25);
  let sigma = 0;
  const refRe = new Float64Array(n), refIm = new Float64Array(n);
  {
    const rowRe = new Float64Array(W), rowIm = new Float64Array(W);
    const bg = dilate(mask, H, W, 8);
    let ss = 0, cnt = 0;
    if (samp.fullySampled) {
      for (let c = 0; c < C; c++) for (let x = 0; x < H; x++) {
        for (let l = 0; l < W; l++) { const j = (c * H + x) * W + l; rowRe[l] = hre[j]; rowIm[l] = him[j]; }
        fftPE.centered(rowRe, rowIm, true);
        for (let y = 0; y < W; y++) {
          const i = x * W + y;
          const sr = sRe[c * n + i], si = sIm[c * n + i];
          refRe[i] += sr * rowRe[y] + si * rowIm[y];
          refIm[i] += sr * rowIm[y] - si * rowRe[y];
          if (!bg[i]) { ss += rowRe[y] ** 2 + rowIm[y] ** 2; cnt++; }
        }
      }
    }
    if (cnt > 500) {
      sigma = Math.sqrt(ss / cnt / 2);
    } else {
      // Undersampled: readout rows entirely outside the object hold pure thermal noise on every acquired line.
      let rs = 0, rc = 0;
      for (let x = 0; x < H; x++) {
        let empty = true;
        for (let y = 0; y < W && empty; y++) if (bg[x * W + y]) empty = false;
        if (!empty) continue;
        for (let c = 0; c < C; c++) for (const l of lines) {
          const j = (c * H + x) * W + l;
          rs += hre[j] ** 2 + him[j] ** 2; rc++;
        }
      }
      sigma = rc > 500 ? Math.sqrt(rs / rc / 2) : 0; // 0 → use the fit-calibrated floor below
    }
  }
  lap('noise');

  // 4. Point-spread kernel of F^H M F (circulant) and the per-block eigen-decompositions.
  progress('SENSE eigen-decomposition', 0.32);
  const kRe = new Float64Array(W), kIm = new Float64Array(W);
  {
    kRe[0] = 1;
    fftPE.centered(kRe, kIm, false);
    for (let l = 0; l < W; l++) if (!lineMask[l]) { kRe[l] = 0; kIm[l] = 0; }
    fftPE.centered(kRe, kIm, true);
  }
  const R2 = 2 * R;
  const nBlocks = H * nb;
  const vals = new Float64Array(nBlocks * R2);
  const vecs = new Float64Array(nBlocks * R2 * R2);
  const emptyBlock = new Uint8Array(nBlocks);
  {
    const E = new Float64Array(R2 * R2);
    const idx = new Int32Array(R);
    for (let x = 0; x < H; x++) {
      if (x % 16 === 0) progress('SENSE eigen-decomposition', 0.32 + 0.4 * (x / H));
      for (let y0 = 0; y0 < nb; y0++) {
        const blk = x * nb + y0;
        let any = false;
        for (let j = 0; j < R; j++) { idx[j] = x * W + y0 + j * nb; if (mask[idx[j]]) any = true; }
        if (!any) { emptyBlock[blk] = 1; continue; }
        for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) {
          // Σ_c conj(S_ci) S_cj
          let cr = 0, ci = 0;
          for (let c = 0; c < C; c++) {
            const ar = sRe[c * n + idx[i]], ai = -sIm[c * n + idx[i]];
            const br = sRe[c * n + idx[j]], bi = sIm[c * n + idx[j]];
            cr += ar * br - ai * bi; ci += ar * bi + ai * br;
          }
          const d = (((idx[i] - idx[j]) % W) + W) % W; // pixel offset within the row
          const gr = kRe[d] * cr - kIm[d] * ci, gi = kRe[d] * ci + kIm[d] * cr;
          E[i * R2 + j] = gr; E[(i + R) * R2 + (j + R)] = gr;
          E[i * R2 + (j + R)] = -gi; E[(i + R) * R2 + j] = gi;
        }
        const { values, vectors } = jacobiEigen(E, R2);
        vals.set(values, blk * R2);
        vecs.set(vectors, blk * R2 * R2);
      }
    }
  }
  lap('eigen');

  // Block-wise application of a spectral function g(λ) to a complex image.
  const tau = { hi: BANDS.hi / R, lo: BANDS.lo / R };
  const v = new Float64Array(R2), coef = new Float64Array(R2);
  function applySpectral(re: Float64Array, im: Float64Array, g: (lam: number) => number) {
    const outRe = new Float64Array(n), outIm = new Float64Array(n);
    const g0 = g(0);
    for (let x = 0; x < H; x++) for (let y0 = 0; y0 < nb; y0++) {
      const blk = x * nb + y0;
      if (emptyBlock[blk]) {
        for (let j = 0; j < R; j++) { const p = x * W + y0 + j * nb; outRe[p] = g0 * re[p]; outIm[p] = g0 * im[p]; }
        continue;
      }
      for (let j = 0; j < R; j++) { const p = x * W + y0 + j * nb; v[j] = re[p]; v[j + R] = im[p]; }
      const vb = blk * R2 * R2, lb = blk * R2;
      for (let k = 0; k < R2; k++) {
        let d = 0;
        for (let i = 0; i < R2; i++) d += vecs[vb + i * R2 + k] * v[i];
        coef[k] = d * g(vals[lb + k]);
      }
      for (let i = 0; i < R2; i++) {
        let s = 0;
        for (let k = 0; k < R2; k++) s += vecs[vb + i * R2 + k] * coef[k];
        if (i < R) outRe[x * W + y0 + i * nb] = s; else outIm[x * W + y0 + (i - R) * nb] = s;
      }
    }
    return { re: outRe, im: outIm };
  }
  const band = (lam: number) => (lam >= tau.hi ? 0 : lam >= tau.lo ? 1 : 2);

  // Per-pixel share of each band (diagonal of the band projectors).
  const pixFrac = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  for (let blk = 0; blk < nBlocks; blk++) {
    const x = Math.floor(blk / nb), y0 = blk % nb;
    for (let j = 0; j < R; j++) {
      const p = x * W + y0 + j * nb;
      if (emptyBlock[blk]) { pixFrac[2][p] = 1; continue; }
      for (let k = 0; k < R2; k++) {
        const w1 = vecs[blk * R2 * R2 + j * R2 + k], w2 = vecs[blk * R2 * R2 + (j + R) * R2 + k];
        pixFrac[band(vals[blk * R2 + k])][p] += (w1 * w1 + w2 * w2) / 2;
      }
    }
  }
  let rankReal = 0;
  for (let i = 0; i < vals.length; i++) if (vals[i] >= tau.lo) rankReal++;
  const effectiveRank = Math.round(rankReal / 2);
  lap('spectra');

  // 5. Adjoint of the measurements: b = A^H y (zero-filled, coil-combined).
  progress('Data-consistent reconstruction', 0.75);
  const bRe = new Float64Array(n), bIm = new Float64Array(n);
  let yNorm2 = 0;
  {
    const rowRe = new Float64Array(W), rowIm = new Float64Array(W);
    for (let c = 0; c < C; c++) for (let x = 0; x < H; x++) {
      for (let l = 0; l < W; l++) {
        const j = (c * H + x) * W + l;
        if (lineMask[l]) { rowRe[l] = hre[j]; rowIm[l] = him[j]; yNorm2 += hre[j] ** 2 + him[j] ** 2; } else { rowRe[l] = 0; rowIm[l] = 0; }
      }
      fftPE.centered(rowRe, rowIm, true);
      for (let y = 0; y < W; y++) {
        const i = x * W + y, sr = sRe[c * n + i], si = sIm[c * n + i];
        bRe[i] += sr * rowRe[y] + si * rowIm[y];
        bIm[i] += sr * rowIm[y] - si * rowRe[y];
      }
    }
  }
  const m = C * H * lines.length; // complex measurements

  // Tikhonov-regularised SENSE (data-consistent reconstruction).
  const alphaDc = 0.01 / R;
  const xdc = applySpectral(bRe, bIm, lam => (lam > 1e-12 ? 1 / (lam + alphaDc) : 0));

  // Normalise intensities so the 99th percentile of the image is 1.
  const mags = new Float64Array(n);
  const base = samp.fullySampled ? { re: refRe, im: refIm } : xdc;
  for (let i = 0; i < n; i++) mags[i] = Math.hypot(base.re[i], base.im[i]);
  const scale = 1 / (percentile(Array.from(mags).filter((_, i) => mask[i]), 0.99) || 1);
  for (const arr of [bRe, bIm, xdc.re, xdc.im, refRe, refIm]) for (let i = 0; i < n; i++) arr[i] *= scale;
  sigma *= scale;
  yNorm2 *= scale * scale;

  // Residual ‖A x − y‖² evaluated exactly through the block spectra.
  function residualNorm2(re: Float64Array, im: Float64Array) {
    const Nx = applySpectral(re, im, lam => lam);
    let q = 0, cross = 0;
    for (let i = 0; i < n; i++) { q += re[i] * Nx.re[i] + im[i] * Nx.im[i]; cross += re[i] * bRe[i] + im[i] * bIm[i]; }
    return Math.max(0, q - 2 * cross + yNorm2);
  }
  // Expected residual dimensions: 2m minus the (real) dimensions a reconstruction fits.
  // The data-consistent fit uses every λ > 0; the prior-filled reconstruction deliberately
  // does not fit the null band, so those dimensions stay in its residual.
  let dofRedDc = 0, dofRedRecon = 0;
  for (let i = 0; i < vals.length; i++) {
    const h = vals[i] > 1e-12 ? vals[i] / (vals[i] + alphaDc) : 0;
    dofRedDc += h * (2 - h);
    if (band(vals[i]) !== 2) dofRedRecon += h * (2 - h);
  }
  const dofDc = Math.round(2 * m - dofRedDc);
  const dof = Math.round(2 * m - dofRedRecon);

  // Noise floor: thermal noise from the background, calibrated upward by the residual of the
  // data-consistent fit so that sensitivity-model error is not mistaken for inconsistency.
  const sigmaThermal = sigma;
  const sigmaFit = Math.sqrt(residualNorm2(xdc.re, xdc.im) / dofDc);
  sigma = Math.max(sigmaThermal, sigmaFit);

  // 6. Prior-filled ("AI") reconstruction: data where it is measured, TV prior in the null band.
  progress('Prior-based reconstruction', 0.8);
  const prior = tvDenoise(xdc.re, xdc.im, H, W, mask);
  const nullOf = (re: Float64Array, im: Float64Array) => applySpectral(re, im, lam => (band(lam) === 2 ? 1 : 0));
  const nX = nullOf(xdc.re, xdc.im), nP = nullOf(prior.re, prior.im);
  const xr = new Float64Array(n), xi = new Float64Array(n);
  for (let i = 0; i < n; i++) { xr[i] = xdc.re[i] - nX.re[i] + nP.re[i]; xi[i] = xdc.im[i] - nX.im[i] + nP.im[i]; }

  // 7. Lesion: placed where the operator is blindest; the hidden version is its null-band projection.
  progress('Lesion scenarios', 0.86);
  const lesionR = opts.lesionRadius ?? Math.max(4, Math.round(H / 64));
  const inner = dilate(mask, H, W, lesionR * 3, true);
  const score = boxBlur(pixFrac[2], H, W, lesionR);
  const displayN = Math.min(H, W), cropY = Math.floor((W - displayN) / 2), cropX = Math.floor((H - displayN) / 2);
  let best = -1, cx = Math.floor(H / 2), cy = Math.floor(W / 2);
  for (let x = cropX + lesionR * 2; x < cropX + displayN - lesionR * 2; x++) {
    for (let y = cropY + lesionR * 2; y < cropY + displayN - lesionR * 2; y++) {
      const i = x * W + y;
      if (!inner[i] || Math.hypot(xr[i], xi[i]) < 0.15) continue;
      if (score[i] > best) { best = score[i]; cx = x; cy = y; }
    }
  }
  const amp = 0.45;
  const Lre = new Float64Array(n), Lim = new Float64Array(n);
  for (let x = cx - 2 * lesionR; x <= cx + 2 * lesionR; x++) for (let y = cy - 2 * lesionR; y <= cy + 2 * lesionR; y++) {
    if (x < 0 || y < 0 || x >= H || y >= W) continue;
    const d = Math.hypot(x - cx, y - cy) / lesionR;
    const prof = d <= 1 ? 1 : d < 1.6 ? 0.5 + 0.5 * Math.cos((Math.PI * (d - 1)) / 0.6) : 0;
    if (!prof) continue;
    const i = x * W + y, ph = Math.atan2(xi[i], xr[i]);
    Lre[i] = amp * prof * Math.cos(ph); Lim[i] = amp * prof * Math.sin(ph);
  }
  const Lh = nullOf(Lre, Lim);
  let peak = 0;
  for (let x = cx - lesionR; x <= cx + lesionR; x++) for (let y = cy - lesionR; y <= cy + lesionR; y++) {
    if (x >= 0 && y >= 0 && x < H && y < W) peak = Math.max(peak, Math.hypot(Lh.re[x * W + y], Lh.im[x * W + y]));
  }
  // Scale so the lesion peak matches `amp`, then shrink if needed until the χ² change stays
  // within one standard deviation of the χ² distribution — i.e. statistically invisible.
  let gain = amp / (peak || 1);
  {
    const add = (a: number) => {
      const r2 = new Float64Array(n), i2 = new Float64Array(n);
      for (let i = 0; i < n; i++) { r2[i] = xr[i] + a * Lh.re[i]; i2[i] = xi[i] + a * Lh.im[i]; }
      return residualNorm2(r2, i2) / (sigma * sigma);
    };
    const r0 = add(0), rp = add(gain), rm = add(-gain);
    const qa = (rp + rm - 2 * r0) / 2, la = (rp - rm) / 2; // Δχ²(t·gain) = qa t² + la t
    const budget = Math.sqrt(2 * dof);
    let t = 1;
    if (qa + la > budget) t = qa > 0 ? (-la + Math.sqrt(la * la + 4 * qa * budget)) / (2 * qa) : 1;
    gain *= Math.min(1, Math.max(0, t));
  }
  const lesionPeak = gain * peak;
  for (let i = 0; i < n; i++) { Lh.re[i] *= gain; Lh.im[i] *= gain; }
  lap('reconstruction');

  // 8. Evaluate each scenario: bands, χ² data-consistency test, error vs reference.
  progress('Residual hypothesis tests', 0.9);

  const fmt = (x: number, d = 3) => +x.toFixed(d);
  const crop = (arr: Float64Array) => {
    const out = new Array<number>(displayN * displayN);
    for (let x = 0; x < displayN; x++) for (let y = 0; y < displayN; y++) out[x * displayN + y] = arr[(x + cropX) * W + y + cropY];
    return out;
  };
  const magOf = (re: Float64Array, im: Float64Array) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = Math.hypot(re[i], im[i]); return o; };

  const groundTruth = samp.fullySampled ? magOf(refRe, refIm) : magOf(bRe, bIm);
  const gtCrop = crop(groundTruth);
  const displayMax = percentile(gtCrop, 0.995) || 1;

  const kHash = await sha256Hex(new Uint8Array(scan.re.buffer, scan.re.byteOffset, scan.re.byteLength))
    + await sha256Hex(new Uint8Array(scan.im.buffer, scan.im.byteOffset, scan.im.byteLength));
  const measurementSha = await sha256Hex(kHash);
  const maskSha = await sha256Hex(lines.join(','));
  const sensSha = await sha256Hex(new Uint8Array(new Float32Array(sRe).buffer));
  const operatorDesc = `sense-cartesian-2d R=${R} ro=${H} pe=${W} coils=${C} lines=${lines.length} acs=${samp.acsEnd - samp.acsStart + 1}`;

  const scenarioDefs: { id: ScenarioId; label: string; blurb: string; add?: { re: Float64Array; im: Float64Array } }[] = [
    { id: 'baseline', label: 'Prior-filled reconstruction', blurb: 'Data-consistent SENSE where the scanner measured; TV prior fills the null band.' },
    { id: 'hidden', label: 'Hallucinated lesion (null-space)', blurb: 'A lesion added only where the measurements are blind. It agrees with the raw data, so χ² cannot see it.', add: Lh },
    { id: 'edit', label: 'Inconsistent edit', blurb: 'The same lesion added naively. It contradicts the raw data, and the χ² test rejects it.', add: { re: Lre, im: Lim } },
  ];

  let baseStat = 0;
  const scenarios: MriScenario[] = [];
  for (const def of scenarioDefs) {
    const sr = xr.slice(), si = xi.slice();
    if (def.add) for (let i = 0; i < n; i++) { sr[i] += def.add.re[i]; si[i] += def.add.im[i]; }
    const meas = applySpectral(sr, si, lam => (band(lam) === 0 ? 1 : 0));
    const ill = applySpectral(sr, si, lam => (band(lam) === 1 ? 1 : 0));
    const nul = nullOf(sr, si);
    let eT = 0; const e = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      eT += sr[i] ** 2 + si[i] ** 2;
      e[0] += meas.re[i] ** 2 + meas.im[i] ** 2;
      e[1] += ill.re[i] ** 2 + ill.im[i] ** 2;
      e[2] += nul.re[i] ** 2 + nul.im[i] ** 2;
    }
    const eSum = e[0] + e[1] + e[2] || 1;
    const stat = residualNorm2(sr, si) / (sigma * sigma);
    if (def.id === 'baseline') baseStat = stat;
    let relErr = NaN;
    if (samp.fullySampled) {
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) if (mask[i]) { num += (sr[i] - refRe[i]) ** 2 + (si[i] - refIm[i]) ** 2; den += refRe[i] ** 2 + refIm[i] ** 2; }
      relErr = Math.sqrt(num / (den || 1));
    }
    const reconMag = magOf(sr, si);
    const res: VerificationResult = {
      n: displayN,
      phantom: gtCrop,
      reconstruction: crop(reconMag),
      measured_band: crop(magOf(meas.re, meas.im)),
      ill_conditioned_band: crop(magOf(ill.re, ill.im)),
      null_band: crop(magOf(nul.re, nul.im)),
      band_norm_ratios: [fmt(Math.sqrt(e[0] / eT)), fmt(Math.sqrt(e[1] / eT)), fmt(Math.sqrt(e[2] / eT))],
      band_energy_shares: [fmt(e[0] / eSum, 4), fmt(e[1] / eSum, 4), fmt(e[2] / eSum, 4)],
      statistic: fmt(stat, 1),
      dof,
      p_value: chi2UpperTail(stat, dof),
      reduced_chi2: fmt(stat / dof),
      effective_rank: effectiveRank,
      rel_error: samp.fullySampled ? fmt(relErr) : NaN,
      operator_desc: operatorDesc,
      prior_desc: 'TV · null-band fill',
      manifest_json: '',
      engine: 'sense',
      display: { colormap: 'gray', range: [0, displayMax] },
      ground_truth_label: samp.fullySampled ? 'Fully-sampled reference' : 'Zero-filled (no reference)',
      lesion: def.add ? { x: cx - cropX, y: cy - cropY, r: lesionR } : undefined,
      scenario: def.id,
    };
    const body = {
      version: 'nullspace-recon/0.3.0',
      created_at: new Date().toISOString(),
      engine: 'sense-blockwise-eigen (exact)',
      source: { format: scan.format, label: scan.label },
      scenario: def.id,
      operator: operatorDesc,
      noise_model: `gaussian-iid sigma=${sigma.toExponential(3)} (thermal ${sigmaThermal ? sigmaThermal.toExponential(3) : 'n/a'} from ${samp.fullySampled ? 'image background' : 'object-free readout rows'}; floor calibrated on data-consistent fit ${sigmaFit.toExponential(3)})`,
      hidden_lesion_peak: def.id === 'hidden' ? +lesionPeak.toFixed(4) : undefined,
      prior: res.prior_desc,
      thresholds: { measured: `lambda >= ${BANDS.hi}/R (g <= 1.41)`, null: `lambda < ${BANDS.lo}/R (g > 5)` },
      hashes: {
        measurements_sha256: measurementSha,
        sampling_mask_sha256: maskSha,
        coil_sensitivities_sha256: sensSha,
        reconstruction_sha256: await sha256Hex(new Uint8Array(new Float32Array(sr).buffer)),
      },
      spectral: {
        effective_rank: effectiveRank,
        band_energy_shares: { measured: res.band_energy_shares![0], ill_conditioned: res.band_energy_shares![1], null: res.band_energy_shares![2] },
      },
      residual_test: {
        test: 'chi-squared', statistic: res.statistic, dof, reduced_chi2: res.reduced_chi2,
        p_value: +res.p_value.toPrecision(4), alpha: 0.01, h0_rejected: res.p_value <= 0.01,
      },
      rel_error_vs_reference: samp.fullySampled ? res.rel_error : null,
    };
    res.manifest_json = JSON.stringify({
      ...body,
      manifest_sha256: await sha256Hex(JSON.stringify(body)),
      signature: { algorithm: 'ML-DSA-65', standard: 'FIPS 204', status: 'ready-for-signing', value: null },
    });
    scenarios.push({ id: def.id, label: def.label, blurb: def.blurb, result: res, deltaChi2: stat - baseStat });
  }
  lap('scenarios');
  progress('Done', 1);

  return {
    scenarios,
    meta: {
      acceleration: R, coils: C, sigmaThermal, hiddenLesionPeak: lesionPeak, matrix: [H, W], sampledLines: lines.length,
      acsLines: samp.acsEnd - samp.acsStart + 1, sigma, fullySampled: samp.fullySampled,
      label: scan.label, format: scan.format, timingsMs: timings,
    },
  };
}
