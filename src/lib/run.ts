import { MODALITIES } from './engine';
import type { ModalityId, VerificationResult } from './engine';
import type { MriAnalysis } from './mri/sense.ts';

export interface RunScenario {
  id: string;
  label: string;
  blurb: string;
  result: VerificationResult;
  deltaChi2?: number;
}

/** One verification run as shown on the dashboard: one or more scenarios over the same acquisition. */
export interface Run {
  kind: 'reference' | 'sense';
  title: string;
  iconId: ModalityId;
  scenarios: RunScenario[];
  meta?: MriAnalysis['meta'];
}

/** Energy shares from band norm ratios when an engine does not report them directly. */
export function energyShares(r: VerificationResult): [number, number, number] {
  if (r.band_energy_shares) return r.band_energy_shares;
  const sq = r.band_norm_ratios.map(v => v * v);
  const t = sq[0] + sq[1] + sq[2] || 1;
  return [sq[0] / t, sq[1] / t, sq[2] / t];
}

export function referenceRun(id: ModalityId, result: VerificationResult): Run {
  const modality = MODALITIES.find(m => m.id === id)!;
  return {
    kind: 'reference',
    title: modality.name,
    iconId: id,
    scenarios: [{ id: 'baseline', label: 'Reconstruction', blurb: '', result }],
  };
}
