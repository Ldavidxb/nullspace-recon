import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ModalitySpec, VerificationResult } from '../lib/engine';
import { ImageCanvas } from '../components/ImageCanvas';
import { ProvenanceHeatmap } from '../components/ProvenanceHeatmap';
import { ChiSquaredGauge } from '../components/ChiSquaredGauge';
import { SpectralRadar } from '../components/SpectralRadar';
import { NavButton, PageFooter } from '../components/ui';
import { ModalityIcon } from './ModalitySelector';

interface Props {
  result: VerificationResult;
  modality: ModalitySpec;
  onBack: () => void;
  onViewManifest: () => void;
}

type Accent = 'emerald' | 'amber' | 'red' | 'cyan' | 'slate';

export function VerificationDashboard({ result: r, modality, onBack, onViewManifest }: Props) {
  const pass = r.p_value > 0.01;
  const errAccent: Accent = r.rel_error > 2 ? 'red' : r.rel_error > 0.5 ? 'amber' : 'emerald';

  // Ground truth and reconstruction share one soft-tissue display window, so differences are real.
  const displayRange = useMemo<[number, number]>(() => {
    const lo = Math.min(...r.phantom), hi = Math.max(...r.phantom);
    return [lo, lo + 0.5 * (hi - lo)];
  }, [r.phantom]);

  return (
    <div className="mesh-grid min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <nav className="grid grid-cols-[auto_1fr_auto] items-center gap-3 animate-fade-in">
          <NavButton onClick={onBack}>
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span className="hidden sm:inline">Back to modalities</span>
            <span className="sm:hidden">Back</span>
          </NavButton>
          <div className="min-w-0 flex justify-center">
            <div className="hidden md:block max-w-full truncate text-[11px] text-slate-300 font-mono bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-700/50"
              title={r.operator_desc}>
              {r.operator_desc}
            </div>
          </div>
          <NavButton onClick={onViewManifest} variant="accent">
            <span className="hidden sm:inline">View Manifest</span>
            <span className="sm:hidden">Manifest</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </NavButton>
        </nav>

        <header className="mt-8 mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 animate-fade-in-d1">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
            <ModalityIcon id={modality.id} className="w-6 h-6 text-cyan-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-[-0.025em]">
            {modality.name} <span className="text-slate-500 font-light">Verification</span>
          </h1>
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold tracking-[0.2em] border ${
            pass
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)]'
              : 'bg-red-500/15 text-red-300 border-red-500/40 shadow-[0_0_24px_-4px_rgba(239,68,68,0.5)]'
          }`}>
            <span aria-hidden>{pass ? '✓' : '✕'}</span>
            {pass ? 'PASS' : 'FAIL'}
          </span>
          <p className="basis-full md:hidden text-[11px] text-slate-400 font-mono break-all">{r.operator_desc}</p>
        </header>

        {/* Row 1 — stat cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in-d2">
          <StatCard label="Relative Error" value={`${(r.rel_error * 100).toFixed(1)}%`} accent={errAccent}
            hint="‖x̂ − x‖ / ‖x‖ vs. ground truth" />
          <StatCard label="Effective Rank" value={r.effective_rank.toFixed(0)} accent="cyan"
            hint={`of ${r.n * r.n} pixel dimensions`} />
          <StatCard label="p-value" value={r.p_value < 0.001 ? r.p_value.toExponential(2) : r.p_value.toFixed(4)}
            accent={pass ? 'emerald' : 'red'} hint="χ² residual test, α = 0.01" />
          <StatCard label="Prior" value={r.prior_desc} accent="slate" hint="Reconstruction regulariser" />
        </section>

        {/* Row 2 — images */}
        <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-d3">
          <Panel title="Ground Truth" subtitle="Shepp-Logan phantom · soft-tissue window">
            <div className="aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/50">
              <ImageCanvas data={r.phantom} n={r.n} colormap="viridis" range={displayRange} />
            </div>
            <ColorbarLegend />
          </Panel>
          <Panel title="Reconstruction" subtitle="AI-reconstructed image under test">
            <div className="aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/50">
              <ImageCanvas data={r.reconstruction} n={r.n} colormap="viridis" range={displayRange} />
            </div>
            <ColorbarLegend />
          </Panel>
          <Panel title="Spectral Provenance" subtitle="Dominant band per pixel · hover to inspect" highlight>
            <ProvenanceHeatmap
              measured={r.measured_band}
              illConditioned={r.ill_conditioned_band}
              nullBand={r.null_band}
              reconstruction={r.reconstruction}
              bandRatios={r.band_norm_ratios}
              n={r.n}
            />
          </Panel>
        </section>

        {/* Row 3 — analysis */}
        <section className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in-d4">
          <div className="glass rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div className="max-w-sm">
                <h2 className="text-base font-semibold text-white">Residual Hypothesis Test</h2>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  χ² test on measurement residuals. Small p-value = data is NOT consistent with physics + noise model.
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border whitespace-nowrap ${
                pass ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
              }`}>
                {pass ? 'H₀ not rejected' : 'H₀ rejected'}
              </span>
            </div>
            <ChiSquaredGauge pValue={r.p_value} reducedChi2={r.reduced_chi2} statistic={r.statistic} dof={r.dof} />
          </div>

          <div className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-5 max-w-md">
              <h2 className="text-base font-semibold text-white">Spectral Band Decomposition</h2>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Tikhonov spectral filters decompose the image into three provenance bands. Null = content the
                measurements cannot see.
              </p>
            </div>
            <SpectralRadar bandRatios={r.band_norm_ratios} />
          </div>
        </section>

        <Interpretation pass={pass} nullRatio={r.band_norm_ratios[2]} measuredRatio={r.band_norm_ratios[0]} />

        <PageFooter left="nullspace-recon v0.2.0 · Rust + WebAssembly · Client-side only" right="Your data never leaves this machine" />
      </div>
    </div>
  );
}

function Interpretation({ pass, nullRatio, measuredRatio }: { pass: boolean; nullRatio: number; measuredRatio: number }) {
  return (
    <section className="mt-4 glass rounded-2xl p-5 sm:p-6 animate-fade-in-d5 grid md:grid-cols-[auto_1fr] gap-4 items-start">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-300 pt-0.5">Clinical reading</div>
      <p className="text-sm text-slate-300 leading-relaxed">
        The reconstruction is {pass ? <strong className="text-emerald-300 font-semibold">consistent</strong> : <strong className="text-red-300 font-semibold">inconsistent</strong>} with
        the acquired measurements under the scanner’s noise model{pass ? '' : ' — the residuals are too large to be explained by noise alone'}.
        However, the null-space band carries <strong className="text-red-300 font-mono font-semibold">{(nullRatio * 100).toFixed(1)}%</strong> of
        the image norm versus <strong className="text-emerald-300 font-mono font-semibold">{(measuredRatio * 100).toFixed(1)}%</strong> measured:
        red regions in the provenance map were supplied by the reconstruction prior, not the scanner, and
        should not be relied on for diagnosis without further acquisition.
      </p>
    </section>
  );
}

function Panel({ title, subtitle, children, highlight = false }: { title: string; subtitle: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-4 sm:p-5 flex flex-col ${highlight ? 'ring-1 ring-cyan-500/25 shadow-[0_0_60px_-20px_rgba(6,182,212,0.45)]' : ''}`}>
      <div className="mb-3.5">
        <h2 className="text-[11px] font-semibold text-slate-200 uppercase tracking-[0.16em]">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ColorbarLegend() {
  return (
    <div className="flex items-center gap-2 pt-4 text-[11px] text-slate-400 font-mono">
      <span>low</span>
      <span className="flex-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)' }} />
      <span>high</span>
    </div>
  );
}

function StatCard({ label, value, accent, hint }: { label: string; value: string; accent: Accent; hint: string }) {
  const map: Record<Accent, { text: string; bar: string }> = {
    emerald: { text: 'text-emerald-400', bar: 'from-emerald-400/80' },
    amber: { text: 'text-amber-400', bar: 'from-amber-400/80' },
    red: { text: 'text-red-400', bar: 'from-red-400/80' },
    cyan: { text: 'text-cyan-300', bar: 'from-cyan-400/80' },
    slate: { text: 'text-slate-200', bar: 'from-slate-400/50' },
  };
  const a = map[accent];
  return (
    <div className="glass relative overflow-hidden rounded-2xl px-4 sm:px-5 py-4">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.bar} to-transparent`} />
      <div className="text-[11px] text-slate-400 uppercase tracking-[0.14em] font-medium">{label}</div>
      <div className={`mt-2 text-lg sm:text-2xl font-mono font-semibold truncate ${a.text}`} title={value}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-500 truncate">{hint}</div>
    </div>
  );
}
