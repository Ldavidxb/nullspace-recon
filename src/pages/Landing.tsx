import { useMemo } from 'react';
import { sheppLogan } from '../lib/engine';
import { ImageCanvas } from '../components/ImageCanvas';
import { Badge, LockIcon, LogoMark, PageFooter, ShieldIcon, Wordmark } from '../components/ui';

interface Props {
  onStart: () => void;
}

const stats = [
  { value: '3', label: 'Modalities', sub: 'CT · Fan-beam CT · MRI' },
  { value: '< 5 sec', label: 'Verification', sub: 'In-browser, on-device' },
  { value: 'ML-DSA-65', label: 'Post-quantum signed', sub: 'FIPS 204 manifest' },
];

const pillars = [
  {
    title: 'Your data never leaves this machine',
    body: 'Every projection, k-space sample and pixel is processed client-side in WebAssembly. No upload, no server, no PHI in transit.',
    icon: LockIcon,
  },
  {
    title: 'Physics-bounded, not another AI',
    body: 'Provenance is derived from the scanner’s forward operator and its spectrum — a mathematical bound, not a learned opinion.',
    icon: ShieldIcon,
  },
  {
    title: 'Modality-agnostic',
    body: 'Parallel-beam CT, fan-beam CT, multi-coil MRI and ultrasound share one verification pipeline via a pluggable operator.',
    icon: GridIcon,
  },
  {
    title: 'Post-quantum ready',
    body: 'Measurements, operator, reconstruction and verdict are hash-bound into a manifest ready for ML-DSA-65 signing.',
    icon: KeyIcon,
  },
];

const bands = [
  { name: 'Measured', desc: 'Directly supported by scanner data', color: 'bg-measured', ring: 'ring-emerald-500/30' },
  { name: 'Ill-conditioned', desc: 'Weakly supported, noise-sensitive', color: 'bg-illcond', ring: 'ring-yellow-500/30' },
  { name: 'Null-space', desc: 'Zero measurement support — AI-supplied', color: 'bg-null', ring: 'ring-red-500/30' },
];

export function Landing({ onStart }: Props) {
  const phantom = useMemo(() => sheppLogan(64), []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 mesh-grid mesh-fade pointer-events-none" />

      <header className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <Wordmark className="text-base" />
        </div>
        <span className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Offline-capable · zero network calls
        </span>
      </header>

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-10">
        <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <div className="animate-fade-in">
              <Badge pulse>Physics-Bounded Verification</Badge>
            </div>

            <h1 className="animate-fade-in-d1 mt-6 text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold text-white tracking-[-0.035em] leading-[1.08]">
              How much of a medical image is{' '}
              <span className="text-measured">measurement-proven</span>
              <br className="hidden sm:block" /> vs.{' '}
              <span className="text-null">AI-supplied</span>?
            </h1>

            <p className="animate-fade-in-d2 mt-6 text-base sm:text-lg text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              AI reconstructions can hallucinate pathology. We mathematically decompose every pixel to its
              provenance — and prove it cryptographically.
            </p>

            <div className="animate-fade-in-d3 mt-9 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button
                onClick={onStart}
                className="btn-primary group inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-cyan-300 focus-visible:outline-offset-4"
              >
                Start Verification
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <LockIcon className="w-3.5 h-3.5 text-emerald-400" />
                Your data never leaves this machine
              </span>
            </div>
          </div>

          <HeroVisual phantom={phantom} />
        </section>

        <section className="animate-fade-in-d4 mt-16 sm:mt-20 glass rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/40">
          {stats.map(s => (
            <div key={s.label} className="px-6 py-6 text-center">
              <div className="text-2xl sm:text-3xl font-semibold text-white tracking-tight font-mono">{s.value}</div>
              <div className="mt-1 text-sm text-cyan-300 font-medium">{s.label}</div>
              <div className="mt-1 text-xs text-slate-500">{s.sub}</div>
            </div>
          ))}
        </section>

        <section className="animate-fade-in-d5 mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map(p => (
            <div key={p.title} className="glass rounded-2xl p-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5 flex items-center justify-center text-cyan-300">
                <p.icon className="w-[18px] h-[18px]" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white leading-snug">{p.title}</h3>
              <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </section>
      </main>

      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-8">
        <PageFooter left="Rust + WebAssembly · Zero-server architecture · Client-side only" right="Built for clinical verification workflows" />
      </div>
    </div>
  );
}

function HeroVisual({ phantom }: { phantom: number[] }) {
    return (
      <div className="animate-fade-in-d2 relative mx-auto w-full max-w-[400px]">
        <div className="absolute -inset-8 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative glass rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono text-slate-400">phantom_032.f64</span>
            <span className="text-[11px] font-mono text-cyan-300">decomposing…</span>
          </div>
          <div className="relative aspect-square rounded-xl overflow-hidden scanline">
            <ImageCanvas data={phantom} n={64} colormap="viridis" range={[0, 0.5]} />
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
              <g className="orbit" style={{ transformOrigin: '50px 50px' }}>
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="0.3" strokeDasharray="1 2" />
                <circle cx="50" cy="4" r="1.2" fill="#22d3ee" />
              </g>
              <g className="orbit-rev" style={{ transformOrigin: '50px 50px' }}>
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="0.3" />
              </g>
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {bands.map(b => (
              <div key={b.name} className="rounded-lg bg-slate-900/50 border border-slate-700/40 px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${b.color} ring-4 ${b.ring}`} />
                  <span className="text-[11px] font-medium text-slate-200 truncate">{b.name}</span>
                </div>
                <p className="mt-1 text-[10px] leading-tight text-slate-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <circle cx="16.75" cy="16.75" r="3.25" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" strokeLinecap="round" />
    </svg>
  );
}
