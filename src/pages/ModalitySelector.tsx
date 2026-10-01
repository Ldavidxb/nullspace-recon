import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { MODALITIES, setLiveEngine, verify } from '../lib/engine';
import type { EngineInfo, ModalityId, PriorType, VerificationResult } from '../lib/engine';
import { referenceRun } from '../lib/run';
import type { Run } from '../lib/run';
import { runMriAnalysis } from '../lib/mri/client.ts';
import type { MriAnalysis } from '../lib/mri/sense.ts';
import { Badge, LockIcon, LogoMark, NavButton, PageFooter, Wordmark } from '../components/ui';

interface Props {
  engine: EngineInfo;
  autoStart?: boolean;
  onEngineChange: (engine: EngineInfo) => void;
  onBack: () => void;
  onComplete: (run: Run) => void;
}

const accents: Record<ModalityId, { tile: string; icon: string; glowA: string; glowB: string; chip: string }> = {
  'parallel-beam': {
    tile: 'from-cyan-500/25 to-blue-500/25',
    icon: 'text-cyan-300',
    glowA: 'rgba(6,182,212,0.6)',
    glowB: 'rgba(59,130,246,0.45)',
    chip: 'text-cyan-300',
  },
  'fan-beam': {
    tile: 'from-violet-500/25 to-indigo-500/25',
    icon: 'text-violet-300',
    glowA: 'rgba(139,92,246,0.6)',
    glowB: 'rgba(99,102,241,0.45)',
    chip: 'text-violet-300',
  },
  'mri': {
    tile: 'from-emerald-500/25 to-teal-500/25',
    icon: 'text-emerald-300',
    glowA: 'rgba(16,185,129,0.6)',
    glowB: 'rgba(20,184,166,0.45)',
    chip: 'text-emerald-300',
  },
};

const steps = ['Forward operator', 'Tikhonov spectrum', 'Band projection', 'χ² residual test', 'Manifest hash'];

export function ModalitySelector({ engine, autoStart = false, onEngineChange, onBack, onComplete }: Props) {
  const [running, setRunning] = useState<ModalityId | null>(null);
  const [step, setStep] = useState(0);
  const [prior, setPrior] = useState<PriorType>('tv');
  const [lambdaText, setLambdaText] = useState('0.1');
  const [error, setError] = useState<string | null>(null);

  const lambda = Number(lambdaText);
  const lambdaValid = Number.isFinite(lambda) && lambda > 0 && lambda <= 10;

  const run = async (id: ModalityId) => {
    if (!lambdaValid) return;
    setRunning(id);
    setError(null);
    setStep(0);
    try {
      // Let the overlay paint, then walk the pipeline stages so the audience sees what is being computed.
      const started = performance.now();
      const pending = new Promise<VerificationResult>((resolve, reject) =>
        setTimeout(() => verify(id, prior, lambda).then(resolve, reject), 30));
      for (let i = 1; i < steps.length; i++) {
        await new Promise(r => setTimeout(r, 260));
        setStep(i);
      }
      const result = await pending;
      const elapsed = performance.now() - started;
      if (elapsed < 1500) await new Promise(r => setTimeout(r, 1500 - elapsed));
      onComplete(referenceRun(id, result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setRunning(null);
    }
  };

  return (
    <div className="mesh-grid min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <nav className="flex items-center justify-between gap-4 animate-fade-in">
          <NavButton onClick={onBack}>
            <span className="transition-transform group-hover:-translate-x-0.5">←</span> Back
          </NavButton>
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-6 h-6" />
            <Wordmark className="text-sm" />
          </div>
          {engine.wasmAvailable ? (
            <div role="radiogroup" aria-label="Engine" className="hidden sm:inline-flex rounded-lg bg-slate-950/60 border border-slate-700/50 p-0.5 text-[11px] font-mono">
              {([[false, 'Demo data'], [true, 'Live WASM']] as const).map(([live, label]) => (
                <button
                  key={label}
                  role="radio"
                  aria-checked={(engine.kind === 'wasm') === live}
                  disabled={running !== null}
                  onClick={() => onEngineChange(setLiveEngine(live))}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    (engine.kind === 'wasm') === live ? 'bg-slate-700/60 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span className="hidden sm:inline text-xs font-mono text-slate-500">
              engine: <span className="text-slate-300">{engine.label}</span>
            </span>
          )}
        </nav>

        <header className="text-center mt-12 sm:mt-14 mb-8 sm:mb-10 animate-fade-in-d1">
          <Badge>Step 1 of 3 · Choose modality</Badge>
          <h1 className="mt-5 text-3xl sm:text-4xl font-semibold text-white tracking-[-0.03em]">
            Which acquisition should we verify?
          </h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Each modality has its own forward operator. We compute its spectrum and bound exactly which
            image content the measurements can — and cannot — see.
          </p>
        </header>

        <FullResolutionMri autoStart={autoStart} disabled={running !== null} onComplete={onComplete} />

        <div className="mt-12 mb-4 flex flex-wrap items-end justify-between gap-2 animate-fade-in-d3">
          <div>
            <h2 className="text-sm font-semibold text-white">Reference demonstrators</h2>
            <p className="text-xs text-slate-500 mt-0.5">32×32 operators across modalities · reference dataset</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 animate-fade-in-d3">
          {MODALITIES.map(mod => {
            const a = accents[mod.id];
            const isRunning = running === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => run(mod.id)}
                disabled={running !== null || !lambdaValid}
                style={{ '--glow-a': a.glowA, '--glow-b': a.glowB } as CSSProperties}
                className="card-glow glass group relative rounded-2xl p-6 sm:p-7 text-left transition-all duration-300 ease-out
                           hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40
                           focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2
                           disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isRunning && <ComputingOverlay step={step} />}
                {running !== null && !isRunning && <div className="absolute inset-0 rounded-2xl bg-slate-950/50 z-10" />}

                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${a.tile} border border-white/10 flex items-center justify-center`}>
                  <ModalityIcon id={mod.id} className={`w-8 h-8 ${a.icon}`} />
                </div>

                <h3 className="mt-5 text-white font-semibold text-lg tracking-tight">{mod.name}</h3>
                <p className="mt-2 text-slate-400 text-sm leading-relaxed min-h-[3.75rem]">{mod.desc}</p>

                <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-400">
                  {mod.specs.map((spec, i) => (
                    <span key={spec} className="flex items-center gap-2">
                      {i > 0 && <span className="text-slate-600">·</span>}
                      {spec}
                    </span>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/40 flex items-center justify-between">
                  <span className={`text-xs font-medium ${a.chip}`}>Run verification</span>
                  <span className={`${a.chip} transition-transform group-hover:translate-x-1`}>→</span>
                </div>
              </button>
            );
          })}
        </div>

        <section className="mt-6 glass rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 animate-fade-in-d3">
          <div className="md:w-56 shrink-0">
            <div className="text-sm font-semibold text-white">Reconstruction prior</div>
            <div className="text-xs text-slate-500 mt-0.5">Regulariser the AI reconstruction used</div>
          </div>

          <div role="radiogroup" aria-label="Prior" className="inline-flex rounded-xl bg-slate-950/60 border border-slate-700/50 p-1 self-start md:self-auto">
            {([['tv', 'Total Variation'], ['gaussian', 'Gaussian Smooth']] as const).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={prior === value}
                onClick={() => setPrior(value)}
                disabled={running !== null}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  prior === value
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/30 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 text-sm">
            <span className="text-slate-300 font-medium font-mono">λ</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.001"
              max="10"
              value={lambdaText}
              onChange={e => setLambdaText(e.target.value)}
              disabled={running !== null}
              aria-invalid={!lambdaValid}
              className={`w-28 bg-slate-950/60 border rounded-lg px-3 py-2 text-slate-100 text-sm font-mono focus:outline-none transition ${
                lambdaValid ? 'border-slate-700/50 focus:border-cyan-500/60' : 'border-red-500/60'
              }`}
            />
            <span className="text-xs text-slate-500">{lambdaValid ? 'regularisation weight' : 'enter 0 < λ ≤ 10'}</span>
          </label>

          <div className="md:ml-auto text-xs text-slate-400 flex items-center gap-2">
            <LockIcon className="w-3.5 h-3.5 text-emerald-400" />
            Runs locally
          </div>
        </section>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <PageFooter left="Rust + WebAssembly · Zero-server architecture · Client-side only" right="Your data never leaves this machine" />
      </div>
    </div>
  );
}

const fullResSteps = ['Coil sensitivities', 'SENSE eigen-decomposition', 'Reconstruction', 'Lesion scenarios', 'χ² tests & manifest'];

function FullResolutionMri({ autoStart, disabled, onComplete }: { autoStart: boolean; disabled: boolean; onComplete: (run: Run) => void }) {
  const [accel, setAccel] = useState(4);
  const [busy, setBusy] = useState<{ stage: string; fraction: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const start = async (source: { file?: File }) => {
    setError(null);
    setBusy({ stage: source.file ? 'Opening file' : 'Simulating acquisition', fraction: 0 });
    try {
      const analysis: MriAnalysis = await runMriAnalysis(
        source.file ? { type: 'file', file: source.file, acceleration: accel } : { type: 'simulate', acceleration: accel },
        (stage, fraction) => setBusy({ stage, fraction }),
      );
      onComplete({
        kind: 'sense',
        title: analysis.meta.format === 'simulation' ? 'MRI · Full resolution' : 'MRI · Raw data',
        iconId: 'mri',
        scenarios: analysis.scenarios,
        meta: analysis.meta,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setBusy(null);
    }
  };

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      start({});
    }
    // one-shot auto run for the #/demo link
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy) start({ file: f });
  };

  const stepIndex = busy ? Math.min(fullResSteps.length - 1, Math.floor(busy.fraction * fullResSteps.length)) : 0;

  return (
    <section
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative glass rounded-3xl p-5 sm:p-7 animate-fade-in-d2 ring-1 transition-colors ${
        dragging ? 'ring-cyan-400/70' : 'ring-cyan-500/20'
      } shadow-[0_0_80px_-30px_rgba(6,182,212,0.5)]`}
    >
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-10 items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="emerald">Exact physics · full resolution</Badge>
            <span className="text-[11px] font-mono text-slate-400">Phase 0</span>
          </div>
          <h2 className="mt-4 text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Multi-coil MRI · SENSE verification on raw k-space
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-xl">
            Exact per-pixel provenance from the SENSE operator’s eigen-decomposition, a calibrated χ² test on the raw data,
            and three scenarios — including a hallucinated lesion that is invisible to the data-consistency test.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-slate-400">
            <span>320×368 matrix</span><span className="text-slate-600">·</span>
            <span>8 coils</span><span className="text-slate-600">·</span>
            <span>equispaced Cartesian</span><span className="text-slate-600">·</span>
            <span>fastMRI / ISMRMRD .h5</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Acceleration</span>
            <div role="radiogroup" aria-label="Acceleration" className="inline-flex rounded-lg bg-slate-950/60 border border-slate-700/50 p-0.5">
              {[4, 8].map(r => (
                <button key={r} role="radio" aria-checked={accel === r} disabled={!!busy || disabled}
                  onClick={() => setAccel(r)}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${accel === r ? 'bg-slate-700/70 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  R = {r}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => start({})}
            disabled={!!busy || disabled}
            className="btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            Run on simulated 8-channel brain <span aria-hidden>→</span>
          </button>
          {import.meta.env.VITE_DEMO ? (
            <p className="rounded-xl border border-dashed border-slate-700/70 px-4 py-2.5 text-xs text-slate-400 text-center">
              Loading your own fastMRI / ISMRMRD raw data is available in the full application.
            </p>
          ) : (
            <>
          <button
                onClick={() => fileInput.current?.click()}
                disabled={!!busy || disabled}
                className="w-full rounded-xl border border-dashed border-slate-600/70 hover:border-cyan-500/50 bg-slate-950/30 px-5 py-3 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-60"
              >
                Load raw k-space (.h5) <span className="text-slate-500">— or drop a file here</span>
              </button>
              <input ref={fileInput} type="file" accept=".h5,.hdf5,.mrd" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) start({ file: f }); e.target.value = ''; }} />
            </>
          )}
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <LockIcon className="w-3 h-3 text-emerald-400" /> Files are read locally in your browser. Nothing is uploaded.
          </p>
        </div>
      </div>

      {busy && (
        <div className="absolute inset-0 z-20 rounded-3xl bg-[#070b15]/[0.96] flex items-center justify-center p-6" aria-live="polite">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{busy.stage}…</div>
                <div className="text-[11px] text-slate-400 font-mono">on-device · web worker</div>
              </div>
              <div className="ml-auto text-sm font-mono text-cyan-300">{Math.round(busy.fraction * 100)}%</div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-300" style={{ width: `${Math.max(3, busy.fraction * 100)}%` }} />
            </div>
            <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {fullResSteps.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 text-xs font-mono ${i < stepIndex ? 'text-emerald-300' : i === stepIndex ? 'text-cyan-200' : 'text-slate-600'}`}>
                  <span className="w-3 text-center">{i < stepIndex ? '✓' : i === stepIndex ? '›' : '·'}</span>{s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}
    </section>
  );
}

function ComputingOverlay({ step }: { step: number }) {
  return (
    <div className="absolute inset-0 z-20 rounded-2xl bg-[#070b15]/[0.97] flex items-center justify-center p-6" aria-live="polite">
      <div className="w-full max-w-[220px]">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Computing…</div>
            <div className="text-[11px] text-slate-400 font-mono">on-device</div>
          </div>
        </div>
        <ol className="mt-5 space-y-1.5">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 text-xs font-mono transition-colors ${
              i < step ? 'text-emerald-300' : i === step ? 'text-cyan-200' : 'text-slate-600'
            }`}>
              <span className="w-3 text-center">{i < step ? '✓' : i === step ? '›' : '·'}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ModalityIcon({ id, className }: { id: ModalityId; className?: string }) {
  if (id === 'parallel-beam') {
    return (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden>
        <circle cx="16" cy="16" r="11" />
        <circle cx="16" cy="16" r="4.5" strokeDasharray="2 2" />
        <line x1="16" y1="2" x2="16" y2="9" strokeLinecap="round" />
        <line x1="16" y1="23" x2="16" y2="30" strokeLinecap="round" />
        <line x1="2" y1="16" x2="9" y2="16" strokeLinecap="round" />
        <line x1="23" y1="16" x2="30" y2="16" strokeLinecap="round" />
        <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === 'fan-beam') {
    return (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden>
        <circle cx="16" cy="5" r="2" fill="currentColor" />
        {[-10, -5, 0, 5, 10].map(dx => (
          <line key={dx} x1="16" y1="7" x2={16 + dx} y2="25" opacity={dx === 0 ? 1 : 0.7} />
        ))}
        <rect x="4" y="25" width="24" height="3" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden>
      <ellipse cx="16" cy="16" rx="13" ry="8" />
      <ellipse cx="16" cy="16" rx="7.5" ry="4.5" />
      <path d="M3 16h26" strokeDasharray="1.5 2" opacity="0.5" />
      <path d="M16 5v3M16 24v3" strokeLinecap="round" />
    </svg>
  );
}
