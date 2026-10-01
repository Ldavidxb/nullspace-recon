import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Run, RunScenario } from '../lib/run';
import { energyShares } from '../lib/run';
import { formatPct } from '../lib/format';
import { ImageCanvas } from '../components/ImageCanvas';
import { ProvenanceHeatmap } from '../components/ProvenanceHeatmap';
import { ChiSquaredGauge } from '../components/ChiSquaredGauge';
import { SpectralRadar } from '../components/SpectralRadar';
import { LesionMarker } from '../components/LesionMarker';
import { NavButton, PageFooter } from '../components/ui';
import { ModalityIcon } from './ModalitySelector';

interface Props {
  run: Run;
  scenario: RunScenario;
  onScenario: (id: string) => void;
  onBack: () => void;
  onViewManifest: () => void;
}

type Accent = 'emerald' | 'amber' | 'red' | 'cyan' | 'slate';

export function VerificationDashboard({ run, scenario, onScenario, onBack, onViewManifest }: Props) {
  const r = scenario.result;
  const exact = r.engine === 'sense';
  const pass = r.p_value > 0.01;
  const shares = energyShares(r);
  const errAccent: Accent = !Number.isFinite(r.rel_error) ? 'slate' : r.rel_error > 2 ? 'red' : r.rel_error > 0.5 ? 'amber' : 'emerald';
  const totalDims = run.meta ? run.meta.matrix[0] * run.meta.matrix[1] : r.n * r.n;
  const colormap = r.display?.colormap ?? 'viridis';

  // Ground truth and reconstruction share one display window, so differences are real.
  const displayRange = useMemo<[number, number]>(() => {
    if (r.display?.range) return r.display.range;
    let lo = Infinity, hi = -Infinity;
    for (const v of r.phantom) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return [lo, lo + 0.5 * (hi - lo)];
  }, [r.phantom, r.display]);

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

        <header className="mt-8 mb-5 animate-fade-in-d1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
              <ModalityIcon id={run.iconId} className="w-6 h-6 text-cyan-300" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-[-0.025em]">
              {run.title} <span className="text-slate-500 font-light">Verification</span>
            </h1>
            <Verdict pass={pass} />
          </div>
          <p className="mt-3 text-sm text-slate-400 max-w-3xl leading-relaxed">
            <span className="text-slate-200 font-medium">Consistent with the data is not the same as correct.</span>{' '}
            {formatPct(shares[2])} of this image’s energy lies in the null band — content the scanner did not measure and the
            χ² test cannot check.
          </p>
          {run.meta && <p className="mt-1.5 text-[11px] font-mono text-slate-500">{run.meta.label}</p>}
          <p className="basis-full md:hidden mt-1 text-[11px] text-slate-400 font-mono break-all">{r.operator_desc}</p>
        </header>

        {run.scenarios.length > 1 && (
          <ScenarioSwitch run={run} active={scenario.id} onChange={onScenario} />
        )}

        {/* Row 1 — stat cards */}
        <section className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-in-d2">
          <StatCard label="Relative Error" value={Number.isFinite(r.rel_error) ? `${(r.rel_error * 100).toFixed(1)}%` : 'n/a'} accent={errAccent}
            hint={Number.isFinite(r.rel_error) ? '‖x̂ − x‖ / ‖x‖ vs. reference' : 'no fully-sampled reference'} />
          <StatCard label="Effective Rank" value={r.effective_rank.toLocaleString('en-US')} accent="cyan"
            hint={`of ${totalDims.toLocaleString('en-US')} unknowns${exact ? ' · g ≤ 5' : ''}`} />
          <StatCard label="p-value" value={pValueText(r.p_value)}
            accent={pass ? 'emerald' : 'red'} hint="χ² residual test, α = 0.01" />
          <StatCard label="Prior" value={r.prior_desc} accent="slate" hint="Reconstruction regulariser" />
        </section>

        {/* Row 2 — images */}
        <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-d3">
          <Panel title={r.ground_truth_label ?? 'Ground Truth'} subtitle={exact ? 'Fully-sampled k-space · SENSE combined' : 'Shepp-Logan phantom · soft-tissue window'}>
            <div className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/50">
              <ImageCanvas data={r.phantom} n={r.n} colormap={colormap} range={displayRange} />
            </div>
            <ColorbarLegend colormap={colormap} />
          </Panel>
          <Panel title="Reconstruction" subtitle={scenario.id === 'baseline' ? 'AI-reconstructed image under test' : scenario.label}>
            <div className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/50">
              <ImageCanvas data={r.reconstruction} n={r.n} colormap={colormap} range={displayRange} />
              <LesionMarker lesion={r.lesion} n={r.n} />
            </div>
            <ColorbarLegend colormap={colormap} />
          </Panel>
          <Panel title="Spectral Provenance" subtitle={exact ? 'Exact band projection per pixel · hover to inspect' : 'Dominant band per pixel · hover to inspect'} highlight>
            <ProvenanceHeatmap
              measured={r.measured_band}
              illConditioned={r.ill_conditioned_band}
              nullBand={r.null_band}
              reconstruction={r.reconstruction}
              bandRatios={r.band_norm_ratios}
              n={r.n}
              exact={exact}
              lesion={r.lesion}
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
                  It can only judge what the scanner measured.
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border whitespace-nowrap ${
                pass ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
              }`}>
                {pass ? 'H₀ not rejected' : 'H₀ rejected'}
              </span>
            </div>
            <ChiSquaredGauge pValue={r.p_value} reducedChi2={r.reduced_chi2} statistic={r.statistic} dof={r.dof} />
            {scenario.deltaChi2 !== undefined && scenario.id !== 'baseline' && (
              <p className="mt-4 text-center text-xs text-slate-400">
                Δχ² vs. baseline: <span className={`font-mono ${pass ? 'text-emerald-300' : 'text-red-300'}`}>+{scenario.deltaChi2.toFixed(0)}</span>
                <span className="text-slate-500"> (noise spread ±{Math.sqrt(2 * r.dof).toFixed(0)})</span>
              </p>
            )}
          </div>

          <div className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-5 max-w-md">
              <h2 className="text-base font-semibold text-white">Spectral Band Decomposition</h2>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                {exact
                  ? 'Exact eigen-decomposition of the SENSE operator. Bands by noise amplification g: measured g ≤ 1.4, ill-conditioned 1.4–5, null g > 5. Null = content the measurements cannot see.'
                  : 'Tikhonov spectral filters decompose the image into three provenance bands. Null = content the measurements cannot see.'}
              </p>
            </div>
            <SpectralRadar shares={shares} bandRatios={r.band_norm_ratios} />
          </div>
        </section>

        <Interpretation run={run} scenario={scenario} pass={pass} shares={shares} />

        <PageFooter left="nullspace-recon v0.3.0 · Rust + WebAssembly · Client-side only" right="Your data never leaves this machine" />
      </div>
    </div>
  );
}

function Verdict({ pass }: { pass: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-semibold tracking-[0.08em] uppercase border ${
      pass
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)]'
        : 'bg-red-500/15 text-red-300 border-red-500/40 shadow-[0_0_24px_-4px_rgba(239,68,68,0.5)]'
    }`}>
      <span aria-hidden>{pass ? '✓' : '✕'}</span>
      {pass ? 'Consistent with raw data' : 'Contradicts raw data'}
    </span>
  );
}

function ScenarioSwitch({ run, active, onChange }: { run: Run; active: string; onChange: (id: string) => void }) {
  const current = run.scenarios.find(s => s.id === active) ?? run.scenarios[0];
  return (
    <section className="glass rounded-2xl p-2 sm:p-2.5 animate-fade-in-d1">
      <div role="tablist" aria-label="Scenario" className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {run.scenarios.map((s, i) => {
          const on = s.id === active;
          const ok = s.result.p_value > 0.01;
          return (
            <button key={s.id} role="tab" aria-selected={on} onClick={() => onChange(s.id)}
              className={`text-left rounded-xl px-4 py-3 transition-all border ${
                on ? 'bg-slate-800/70 border-cyan-500/40 shadow-inner' : 'border-transparent hover:bg-slate-800/40'
              }`}>
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-[11px] font-mono flex items-center justify-center ${on ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-800 text-slate-400'}`}>{i + 1}</span>
                <span className={`text-sm font-medium ${on ? 'text-white' : 'text-slate-300'}`}>{s.label}</span>
                <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded ${ok ? 'text-emerald-300 bg-emerald-500/10' : 'text-red-300 bg-red-500/10'}`}>
                  χ² {ok ? 'pass' : 'fail'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="px-3 pt-2.5 pb-1 text-xs text-slate-400">{current.blurb}</p>
    </section>
  );
}

function Interpretation({ run, scenario, pass, shares }: { run: Run; scenario: RunScenario; pass: boolean; shares: [number, number, number] }) {
  const r = scenario.result;
  const strong = (cls: string, t: ReactNode) => <strong className={`${cls} font-semibold`}>{t}</strong>;
  let body: ReactNode;
  if (run.kind === 'sense' && scenario.id === 'hidden') {
    body = (
      <>
        A lesion was inserted <em>only</em> into the null band of the SENSE operator. The raw data cannot tell the difference:
        the χ² test {pass ? strong('text-emerald-300', 'still passes') : strong('text-red-300', 'fails')} (Δχ² = +{scenario.deltaChi2?.toFixed(0)},
        within the ±{Math.sqrt(2 * r.dof).toFixed(0)} noise spread). The provenance map is what exposes it: the marked region is
        {' '}{strong('text-red-300', 'red')}, so no measurement supports it. This is the failure mode a data-consistency check alone cannot catch.
      </>
    );
  } else if (run.kind === 'sense' && scenario.id === 'edit') {
    body = (
      <>
        The same lesion added naively, without respecting the physics. It changes what the scanner would have measured, so the χ² test
        {' '}{pass ? strong('text-emerald-300', 'passes') : strong('text-red-300', 'rejects it')} (reduced χ² = {r.reduced_chi2.toFixed(2)}).
        Data-consistency testing catches edits that contradict the data. Compare with scenario 2, which it misses.
      </>
    );
  } else {
    body = (
      <>
        The reconstruction is {pass ? strong('text-emerald-300', 'consistent') : strong('text-red-300', 'inconsistent')} with the acquired
        measurements under the scanner’s noise model{pass ? '' : ' — the residuals are too large to be explained by noise alone'}.
        Consistency is not correctness: {strong('text-red-300 font-mono', formatPct(shares[2]))} of the image energy is in the null band
        versus {strong('text-emerald-300 font-mono', formatPct(shares[0]))} measured. Red regions were supplied by the reconstruction prior,
        not the scanner, and should not be relied on for diagnosis without further acquisition.
      </>
    );
  }
  return (
    <section className="mt-4 glass rounded-2xl p-5 sm:p-6 animate-fade-in-d5 grid md:grid-cols-[auto_1fr] gap-4 items-start">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-300 pt-0.5">Clinical reading</div>
      <p className="text-sm text-slate-300 leading-relaxed">{body}</p>
    </section>
  );
}

function Panel({ title, subtitle, children, highlight = false }: { title: string; subtitle: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-4 sm:p-5 flex flex-col ${highlight ? 'ring-1 ring-cyan-500/25 shadow-[0_0_60px_-20px_rgba(6,182,212,0.45)]' : ''}`}>
      <div className="mb-3.5">
        <h2 className="text-[11px] font-semibold text-slate-200 uppercase tracking-[0.16em]">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ColorbarLegend({ colormap }: { colormap: 'gray' | 'viridis' }) {
  const bg = colormap === 'gray' ? 'linear-gradient(90deg,#000,#fff)' : 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)';
  return (
    <div className="flex items-center gap-2 pt-4 text-[11px] text-slate-400 font-mono">
      <span>low</span>
      <span className="flex-1 h-1.5 rounded-full" style={{ background: bg }} />
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

function pValueText(p: number) {
  if (!Number.isFinite(p)) return 'n/a';
  if (p > 0.999) return '> 0.999';
  if (p < 1e-6) return '< 10⁻⁶';
  return p < 0.001 ? p.toExponential(2) : p.toFixed(4);
}
