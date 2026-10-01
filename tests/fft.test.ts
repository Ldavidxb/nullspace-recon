import { FFT } from '../src/lib/mri/fft.ts';

function naiveCentered(re: number[], im: number[], inverse: boolean) {
  const n = re.length, h = Math.floor(n / 2), s = inverse ? 1 : -1;
  const xr = re.map((_, i) => re[(i + h) % n]), xi = im.map((_, i) => im[(i + h) % n]);
  const yr = new Array(n).fill(0), yi = new Array(n).fill(0);
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) {
    const a = (s * 2 * Math.PI * j * k) / n;
    yr[k] += xr[j] * Math.cos(a) - xi[j] * Math.sin(a);
    yi[k] += xr[j] * Math.sin(a) + xi[j] * Math.cos(a);
  }
  const or = new Array(n), oi = new Array(n);
  for (let i = 0; i < n; i++) { or[(i + h) % n] = yr[i] / Math.sqrt(n); oi[(i + h) % n] = yi[i] / Math.sqrt(n); }
  return [or, oi];
}

let worst = 0;
for (const n of [1, 2, 3, 4, 5, 8, 12, 23, 30, 64, 320, 368, 255]) {
  for (const inv of [false, true]) {
    const re = Array.from({ length: n }, () => Math.random() - 0.5), im = Array.from({ length: n }, () => Math.random() - 0.5);
    const [er, ei] = naiveCentered(re, im, inv);
    const a = Float64Array.from(re), b = Float64Array.from(im);
    new FFT(n).centered(a, b, inv);
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(a[i] - er[i]), Math.abs(b[i] - ei[i]));
  }
}
console.log('max abs error vs naive DFT:', worst.toExponential(2));
if (worst > 1e-9) { console.error('FAIL'); process.exit(1); }

const f = new FFT(368), r = new Float64Array(368), i = new Float64Array(368);
const t0 = performance.now();
for (let k = 0; k < 5120; k++) f.centered(r, i, false);
console.log('5120 × FFT368:', (performance.now() - t0).toFixed(0), 'ms');
