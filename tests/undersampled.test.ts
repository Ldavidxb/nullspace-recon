import { simulateScan } from '../src/lib/mri/simulate.ts';
import { analyzeScan } from '../src/lib/mri/sense.ts';

function undersample(keep: (l: number, pe: number) => boolean) {
  const s = simulateScan();
  for (let l = 0; l < s.pe; l++) {
    if (keep(l, s.pe)) continue;
    s.sampled[l] = 0;
    for (let c = 0; c < s.coils; c++) for (let r = 0; r < s.ro; r++) { const i = (c * s.ro + r) * s.pe + l; s.re[i] = 0; s.im[i] = 0; }
  }
  return s;
}
// equispaced R=4 with 24 ACS lines, as acquired on a scanner
const eq = undersample((l, pe) => l % 4 === (pe / 2) % 4 || Math.abs(l - pe / 2) < 12);
const a = await analyzeScan(eq, { acceleration: 8 /* ignored for undersampled data */ });
console.log('equispaced: R', a.meta.acceleration, 'fullySampled', a.meta.fullySampled, 'acs', a.meta.acsLines,
  'p', a.scenarios.map(s => s.result.p_value.toPrecision(2)).join('/'), 'relErr', a.scenarios[0].result.rel_error, 'gt', a.scenarios[0].result.ground_truth_label);
// random mask → clear error
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
try { await analyzeScan(undersample((l, pe) => rnd() < 0.3 || Math.abs(l - pe / 2) < 12), { acceleration: 4 }); console.log('random: NO ERROR (unexpected)'); }
catch (e) { console.log('random mask →', (e as Error).message); }
