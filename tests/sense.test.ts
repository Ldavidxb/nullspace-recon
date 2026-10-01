import { simulateScan } from '../src/lib/mri/simulate.ts';
import { analyzeScan } from '../src/lib/mri/sense.ts';

const R = Number(process.argv[2] ?? 4);
const t = performance.now();
const scan = simulateScan();
console.log('simulate', Math.round(performance.now() - t), 'ms');
const a = await analyzeScan(scan, { acceleration: R });
console.log('meta', JSON.stringify(a.meta));
for (const s of a.scenarios) {
  const r = s.result;
  console.log(s.id.padEnd(8), 'shares', r.band_energy_shares, 'ratios', r.band_norm_ratios, 'chi2', r.statistic, 'dof', r.dof,
    'red', r.reduced_chi2, 'p', r.p_value.toPrecision(3), 'dChi2', s.deltaChi2.toFixed(1), 'relErr', r.rel_error, 'rank', r.effective_rank, 'lesion', JSON.stringify(r.lesion));
}
