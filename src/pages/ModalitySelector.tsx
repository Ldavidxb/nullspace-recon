import { useState } from 'react';
import { verify_parallel_beam, verify_fan_beam, verify_mri } from '../wasm';
import type { VerificationResult } from '../wasm';

interface Props {
  onSelect: (modality: string, result: VerificationResult) => void;
}

const modalities = [
  {
    id: 'parallel-beam',
    name: 'Parallel-Beam CT',
    desc: 'Standard diagnostic CT geometry. Equispaced projection angles with linear detector interpolation.',
    params: { n: 32, angles: 45, sigma: 0.02 },
    specs: ['32 x 32 grid', '45 angles', 'σ = 0.02'],
    gradient: 'from-cyan-500/20 to-blue-500/20',
    iconColor: 'text-cyan-400',
    borderHover: 'hover:border-cyan-500/40',
  },
  {
    id: 'fan-beam',
    name: 'Fan-Beam CT',
    desc: 'Clinical cone-beam geometry with point source and flat-panel detector array.',
    params: { n: 32, angles: 60, n_det: 48, source: 5.0, det: 5.0, sigma: 0.02 },
    specs: ['32 x 32 grid', '60 angles', '48 detectors'],
    gradient: 'from-violet-500/20 to-indigo-500/20',
    iconColor: 'text-violet-400',
    borderHover: 'hover:border-violet-500/40',
  },
  {
    id: 'mri',
    name: 'MRI (Cartesian)',
    desc: 'Multi-coil accelerated MRI with k-space undersampling and auto-calibration signal.',
    params: { n: 32, coils: 4, accel: 4, sigma: 0.05 },
    specs: ['32 x 32 grid', '4 coils', '4x acceleration'],
    gradient: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
    borderHover: 'hover:border-emerald-500/40',
  },
];

const CTIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="3" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <line x1="3" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="21" y2="12" />
    <circle cx="12" cy="12" r="3" strokeDasharray="2 2" />
  </svg>
);

const FanIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="12" cy="3" r="1.5" fill="currentColor" />
    <line x1="12" y1="4.5" x2="4" y2="20" />
    <line x1="12" y1="4.5" x2="20" y2="20" />
    <line x1="12" y1="4.5" x2="12" y2="20" />
    <path d="M4 20 L20 20" strokeLinecap="round" />
  </svg>
);

const MRIIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M3 12 Q6 4 12 4 Q18 4 21 12 Q18 20 12 20 Q6 20 3 12Z" />
    <path d="M8 12 Q9 8 12 8 Q15 8 16 12 Q15 16 12 16 Q9 16 8 12Z" />
    <line x1="1" y1="12" x2="23" y2="12" strokeDasharray="1 2" opacity="0.4" />
  </svg>
);

const icons: Record<string, typeof CTIcon> = {
  'parallel-beam': CTIcon,
  'fan-beam': FanIcon,
  'mri': MRIIcon,
};

export function ModalitySelector({ onSelect }: Props) {
  const [running, setRunning] = useState<string | null>(null);
  const [prior, setPrior] = useState('tv');
  const [lambda, setLambda] = useState(0.1);

  const [error, setError] = useState<string | null>(null);

  const run = async (mod: typeof modalities[number]) => {
    setRunning(mod.id);
    setError(null);
    await new Promise(r => setTimeout(r, 50));

    try {
      let result: VerificationResult;
      if (mod.id === 'parallel-beam') {
        result = verify_parallel_beam(mod.params.n, mod.params.angles, mod.params.sigma, prior, lambda) as VerificationResult;
      } else if (mod.id === 'fan-beam') {
        const p = mod.params as typeof modalities[1]['params'];
        result = verify_fan_beam(p.n, p.angles, p.n_det!, p.source!, p.det!, p.sigma, prior, lambda) as VerificationResult;
      } else {
        const p = mod.params as typeof modalities[2]['params'];
        result = verify_mri(p.n, p.coils!, p.accel!, p.sigma, prior, lambda) as VerificationResult;
      }
      onSelect(mod.name, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setRunning(null);
    }
  };

  return (
    <div className="mesh-grid min-h-screen flex flex-col">
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-12 flex-1">
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-ring" />
            <span className="text-cyan-400 text-xs font-medium tracking-widest uppercase">Physics-Bounded Verification</span>
          </div>

          <h1 className="text-5xl font-bold text-white tracking-tight mb-4">
            nullspace
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">-recon</span>
          </h1>

          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed mb-2">
            How much of a medical image is measurement-proven
            <br />vs. AI-supplied?
          </p>

          <p className="text-slate-600 text-sm">
            All computation runs in your browser. Your data never leaves this machine.
          </p>
        </header>

        <div className="flex items-center justify-center gap-8 mb-12">
          <label className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 font-medium">Prior</span>
            <select
              value={prior}
              onChange={e => setPrior(e.target.value)}
              className="bg-slate-900/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:border-cyan-500/50 focus:outline-none transition"
            >
              <option value="tv">Total Variation</option>
              <option value="gaussian">Gaussian Smooth</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 font-medium">Lambda</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="2"
              value={lambda}
              onChange={e => setLambda(parseFloat(e.target.value) || 0.1)}
              className="bg-slate-900/80 border border-slate-700/50 rounded-lg px-3 py-1.5 text-slate-200 text-sm w-20 font-mono focus:border-cyan-500/50 focus:outline-none transition"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {modalities.map(mod => {
            const Icon = icons[mod.id];
            return (
              <button
                key={mod.id}
                onClick={() => run(mod)}
                disabled={running !== null}
                className={`card-glow group relative bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-7 text-left
                           ${mod.borderHover} transition-all duration-300 ease-out
                           hover:bg-slate-900/80 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/5
                           disabled:opacity-50 disabled:cursor-wait disabled:hover:translate-y-0`}
              >
                {running === mod.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 rounded-2xl z-10 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-cyan-400 tracking-wide">Computing...</span>
                    </div>
                  </div>
                )}

                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mod.gradient} border border-white/5 flex items-center justify-center mb-5`}>
                  <Icon className={`w-7 h-7 ${mod.iconColor}`} />
                </div>

                <h3 className="text-white font-semibold text-lg mb-2 tracking-tight">{mod.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-5">{mod.desc}</p>

                <div className="flex flex-wrap gap-2">
                  {mod.specs.map(spec => (
                    <span key={spec} className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">
                      {spec}
                    </span>
                  ))}
                </div>

                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-xs text-cyan-400/60">Run verification &#8594;</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="text-center py-6 border-t border-slate-800/50">
        <p className="text-xs text-slate-600 tracking-wide">
          Rust + WebAssembly &middot; Zero-server architecture &middot; Client-side computation only
        </p>
      </footer>
    </div>
  );
}
