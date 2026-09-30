import init, {
  verify_parallel_beam,
  verify_fan_beam,
  verify_mri,
  get_phantom,
} from '../../wasm/pkg/nullspace_recon_wasm.js';

let initialized = false;

export async function initWasm() {
  if (initialized) return;
  await init();
  initialized = true;
}

export interface VerificationResult {
  n: number;
  phantom: number[];
  reconstruction: number[];
  measured_band: number[];
  ill_conditioned_band: number[];
  null_band: number[];
  band_norm_ratios: [number, number, number];
  statistic: number;
  dof: number;
  p_value: number;
  reduced_chi2: number;
  effective_rank: number;
  rel_error: number;
  manifest_json: string;
  operator_desc: string;
  prior_desc: string;
}

export { verify_parallel_beam, verify_fan_beam, verify_mri, get_phantom };
