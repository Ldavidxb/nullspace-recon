export function formatP(p: number) {
  if (!Number.isFinite(p)) return 'p = n/a';
  if (p > 0.999) return 'p > 0.999';
  if (p < 1e-6) return 'p < 10⁻⁶';
  return `p = ${p < 0.001 ? p.toExponential(1) : p.toFixed(3)}`;
}

export function formatPct(v: number) {
  const pct = v * 100;
  return `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}
