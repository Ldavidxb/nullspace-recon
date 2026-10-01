// Mixed-radix complex FFT (any length), orthonormal scaling, split re/im arrays.
// Lengths in MRI are often not powers of two (e.g. 368 = 2^4 · 23), so this uses a
// recursive Cooley–Tukey decomposition over the prime factors of n.

function factorize(n: number): number[] {
  const f: number[] = [];
  for (const p of [4, 2, 3, 5]) {
    while (n % p === 0) { f.push(p); n /= p; }
  }
  for (let p = 7; p * p <= n; p += 2) {
    while (n % p === 0) { f.push(p); n /= p; }
  }
  if (n > 1) f.push(n);
  return f;
}

export class FFT {
  readonly n: number;
  private factors: number[];
  private cos: Float64Array;
  private sin: Float64Array;
  private bufRe: Float64Array;
  private bufIm: Float64Array;
  private tmpRe: Float64Array;
  private tmpIm: Float64Array;
  private scale: number;

  constructor(n: number) {
    this.n = n;
    this.factors = factorize(n);
    this.cos = new Float64Array(n);
    this.sin = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
    const maxP = Math.max(...this.factors, 1);
    this.bufRe = new Float64Array(n);
    this.bufIm = new Float64Array(n);
    this.tmpRe = new Float64Array(maxP);
    this.tmpIm = new Float64Array(maxP);
    this.scale = 1 / Math.sqrt(n);
  }

  /**
   * Centred, orthonormal transform of `re/im` in place:
   * forward = fftshift(fft(ifftshift(x))) / √n, inverse likewise with ifft.
   */
  centered(re: Float64Array, im: Float64Array, inverse: boolean) {
    const n = this.n, h = n >> 1;
    const inRe = this.bufRe, inIm = this.bufIm;
    // ifftshift into the work buffer (for odd n, shift by floor(n/2))
    for (let i = 0; i < n; i++) {
      const j = (i + h) % n;
      inRe[i] = re[j];
      inIm[i] = im[j];
    }
    const outRe = re, outIm = im; // reuse caller storage for the result, then fftshift
    this.rec(inRe, inIm, 0, 1, outRe, outIm, 0, n, 0, inverse ? 1 : -1);
    // fftshift the result back in place via the work buffer
    for (let i = 0; i < n; i++) { inRe[i] = outRe[i]; inIm[i] = outIm[i]; }
    const s = this.scale;
    const hs = h; // fftshift: out[(i + floor(n/2)) % n] = in[i]
    for (let i = 0; i < n; i++) {
      const j = (i + hs) % n;
      re[j] = inRe[i] * s;
      im[j] = inIm[i] * s;
    }
  }

  private rec(
    inRe: Float64Array, inIm: Float64Array, inOff: number, stride: number,
    outRe: Float64Array, outIm: Float64Array, outOff: number,
    n: number, fi: number, sign: number,
  ) {
    if (n === 1) {
      outRe[outOff] = inRe[inOff];
      outIm[outOff] = inIm[inOff];
      return;
    }
    const p = this.factors[fi];
    const m = n / p;
    for (let q = 0; q < p; q++) {
      this.rec(inRe, inIm, inOff + q * stride, stride * p, outRe, outIm, outOff + q * m, m, fi + 1, sign);
    }
    const N = this.n, step = N / n;
    const cos = this.cos, sin = this.sin;
    if (p === 2) {
      for (let k = 0; k < m; k++) {
        const t = k * step;
        const wr = cos[t], wi = sign * sin[t];
        const a = outOff + k, b = a + m;
        const br = outRe[b] * wr - outIm[b] * wi;
        const bi = outRe[b] * wi + outIm[b] * wr;
        const ar = outRe[a], ai = outIm[a];
        outRe[a] = ar + br; outIm[a] = ai + bi;
        outRe[b] = ar - br; outIm[b] = ai - bi;
      }
      return;
    }
    if (p === 4) {
      for (let k = 0; k < m; k++) {
        const i0 = outOff + k, i1 = i0 + m, i2 = i1 + m, i3 = i2 + m;
        const t1 = k * step, t2 = 2 * t1, t3 = 3 * t1;
        const w1r = cos[t1 % N], w1i = sign * sin[t1 % N];
        const w2r = cos[t2 % N], w2i = sign * sin[t2 % N];
        const w3r = cos[t3 % N], w3i = sign * sin[t3 % N];
        const x0r = outRe[i0], x0i = outIm[i0];
        const x1r = outRe[i1] * w1r - outIm[i1] * w1i, x1i = outRe[i1] * w1i + outIm[i1] * w1r;
        const x2r = outRe[i2] * w2r - outIm[i2] * w2i, x2i = outRe[i2] * w2i + outIm[i2] * w2r;
        const x3r = outRe[i3] * w3r - outIm[i3] * w3i, x3i = outRe[i3] * w3i + outIm[i3] * w3r;
        const s02r = x0r + x2r, s02i = x0i + x2i, d02r = x0r - x2r, d02i = x0i - x2i;
        const s13r = x1r + x3r, s13i = x1i + x3i, d13r = x1r - x3r, d13i = x1i - x3i;
        // multiply d13 by sign·i
        const jr = -sign * d13i, ji = sign * d13r;
        outRe[i0] = s02r + s13r; outIm[i0] = s02i + s13i;
        outRe[i2] = s02r - s13r; outIm[i2] = s02i - s13i;
        outRe[i1] = d02r + jr; outIm[i1] = d02i + ji;
        outRe[i3] = d02r - jr; outIm[i3] = d02i - ji;
      }
      return;
    }
    // generic radix-p butterfly
    const tr = this.tmpRe, ti = this.tmpIm;
    for (let k = 0; k < m; k++) {
      for (let q = 0; q < p; q++) {
        tr[q] = outRe[outOff + q * m + k];
        ti[q] = outIm[outOff + q * m + k];
      }
      for (let r = 0; r < p; r++) {
        const kk = k + r * m;
        let sr = 0, si = 0;
        for (let q = 0; q < p; q++) {
          const t = ((q * kk) % n) * step;
          const wr = cos[t], wi = sign * sin[t];
          sr += tr[q] * wr - ti[q] * wi;
          si += tr[q] * wi + ti[q] * wr;
        }
        outRe[outOff + kk] = sr;
        outIm[outOff + kk] = si;
      }
    }
  }
}
