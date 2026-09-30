import type { VerificationResult } from '../wasm';
import { ImageCanvas } from '../components/ImageCanvas';
import { ProvenanceHeatmap } from '../components/ProvenanceHeatmap';
import { ChiSquaredGauge } from '../components/ChiSquaredGauge';
import { SpectralRadar } from '../components/SpectralRadar';

interface Props {
  result: VerificationResult;
  modality: string;
  onBack: () => void;
  onViewManifest: () => void;
}

export function VerificationDashboard({ result, modality, onBack, onViewManifest }: Props) {
  const r = result;
  const pass = r.p_value > 0.01;

  return (
    <div className="mesh-grid min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6">

        <nav className="flex items-center justify-between mb-8 animate-fade-in">
          <button onClick={onBack} className="text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm group">
            <span className="text-lg group-hover:-translate-x-0.5 transition-transform">&#8592;</span>
            Back to modalities
          </button>
          <div className="hidden sm:block text-xs text-slate-600 font-mono bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800/50 max-w-md truncate">
            {r.operator_desc}
          </div>
          <button onClick={onViewManifest}
            className="text-cyan-400 hover:text-cyan-300 transition-all text-sm border border-cyan-500/20 bg-cyan-500/5 rounded-lg px-4 py-2 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5">
            View Manifest &#8594;
          </button>
        </nav>

        <div className="flex items-center gap-4 mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white tracking-tight">{modality}</h1>
          <span className="text-xl text-slate-600 font-light">Verification</span>
          <span className={`text-xs px-3 py-1 rounded-full font-bold tracking-widest ${
            pass
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/5'
              : 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/5'
          }`}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8 animate-fade-in-d1">
          <StatCard label="Relative Error" value={`${(r.rel_error * 100).toFixed(1)}%`} accent={r.rel_error < 0.5 ? 'emerald' : r.rel_error < 2 ? 'amber' : 'red'} />
          <StatCard label="Effective Rank" value={r.effective_rank.toFixed(0)} accent="cyan" />
          <StatCard label="p-value" value={r.p_value < 0.001 ? r.p_value.toExponential(2) : r.p_value.toFixed(4)} accent={pass ? 'emerald' : 'red'} />
          <StatCard label="Prior" value={r.prior_desc} accent="slate" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in-d2">
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl p-5 group hover:border-slate-700/60 transition-colors">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Ground Truth</h2>
            <div className="aspect-square overflow-hidden rounded-lg">
              <ImageCanvas data={r.phantom} n={r.n} colormap="viridis" />
            </div>
          </div>
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl p-5 group hover:border-slate-700/60 transition-colors">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Reconstruction</h2>
            <div className="aspect-square overflow-hidden rounded-lg">
              <ImageCanvas data={r.reconstruction} n={r.n} colormap="viridis" />
            </div>
          </div>
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl p-5 group hover:border-slate-700/60 transition-colors">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Spectral Provenance</h2>
            <ProvenanceHeatmap
              measured={r.measured_band}
              illConditioned={r.ill_conditioned_band}
              null_band={r.null_band}
              n={r.n}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 animate-fade-in-d3">
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1.5">Residual Hypothesis Test</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                  &#967;&#178; test on measurement residuals. Small p-value = data is NOT
                  consistent with physics + noise model.
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {pass ? 'H0 not rejected' : 'H0 rejected'}
              </span>
            </div>
            <ChiSquaredGauge
              pValue={r.p_value}
              reducedChi2={r.reduced_chi2}
              statistic={r.statistic}
              dof={r.dof}
            />
          </div>
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-white mb-1.5">Spectral Band Decomposition</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Tikhonov spectral filters decompose the image into three provenance bands.
                Null = content the measurements cannot see.
              </p>
            </div>
            <SpectralRadar bandRatios={r.band_norm_ratios} />
          </div>
        </div>

        <footer className="mt-10 pt-6 border-t border-slate-800/40 flex items-center justify-between animate-fade-in-d4">
          <p className="text-xs text-slate-600">
            nullspace-recon v0.2.0 &middot; Rust + WebAssembly &middot; Client-side only
          </p>
          <p className="text-xs text-slate-700">
            Your data never leaves this machine
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const accentMap: Record<string, { border: string; text: string; glow: string }> = {
    emerald: { border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/5' },
    amber: { border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/5' },
    cyan: { border: 'border-cyan-500/20', text: 'text-cyan-400', glow: 'shadow-cyan-500/5' },
    red: { border: 'border-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/5' },
    slate: { border: 'border-slate-700/50', text: 'text-slate-300', glow: '' },
  };
  const a = accentMap[accent] || accentMap.slate;

  return (
    <div className={`bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl px-4 py-3.5 shadow-lg ${a.border} ${a.glow}`}>
      <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-lg font-mono font-semibold truncate ${a.text}`}>{value}</div>
    </div>
  );
}
