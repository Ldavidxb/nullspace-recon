// Cyclic Jacobi eigen-decomposition for small real symmetric matrices.
// Complex Hermitian blocks are handled through the real embedding
// [[Re, -Im], [Im, Re]], whose spectrum is the Hermitian spectrum doubled.

/**
 * Diagonalise the symmetric n×n matrix `a` (row-major, destroyed).
 * Returns eigenvalues and eigenvectors (columns of `v`, row-major n×n).
 */
export function jacobiEigen(a: Float64Array, n: number, maxSweeps = 30): { values: Float64Array; vectors: Float64Array } {
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0, diag = 0;
    for (let i = 0; i < n; i++) {
      diag += a[i * n + i] * a[i * n + i];
      for (let j = i + 1; j < n; j++) off += a[i * n + j] * a[i * n + j];
    }
    if (off <= 1e-26 * Math.max(diag, 1e-300)) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const app = a[p * n + p], aqq = a[q * n + q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p], akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k], aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p], vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = a[i * n + i];
  return { values, vectors: v };
}
