import { useState } from 'react';
import type { CSSProperties } from 'react';
import { MODALITIES, setLiveEngine, verify } from '../lib/engine';
import type { EngineInfo, ModalityId, PriorType, VerificationResult } from '../lib/engine';
import { Badge, LockIcon, LogoMark, NavButton, PageFooter, Wordmark } from '../components/ui';

interface Props {
  engine: EngineInfo;
  onEngineChange: (engine: EngineInfo) => void;
  onBack: () => void;
  onComplete: (modality: ModalityId, result: VerificationResult) => void;
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

export function ModalitySelector({ engine, onEngineChange, onBack, onComplete }: Props) {
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
      onComplete(id, result);
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

        <header className="text-center mt-12 sm:mt-16 mb-10 sm:mb-12 animate-fade-in-d1">
          <Badge>Step 1 of 3 · Choose modality</Badge>
          <h1 className="mt-5 text-3xl sm:text-4xl font-semibold text-white tracking-[-0.03em]">
            Which acquisition should we verify?
          </h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Each modality has its own forward operator. We compute its spectrum and bound exactly which
            image content the measurements can — and cannot — see.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 animate-fade-in-d2">
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
