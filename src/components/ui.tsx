import type { ReactNode } from 'react';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      <span className="text-white">nullspace</span>
      <span className="text-gradient">-recon</span>
    </span>
  );
}

export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="rgba(6,182,212,0.08)" stroke="url(#lm)" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="url(#lm)" strokeWidth="1.6" />
      <line x1="10.5" y1="21.5" x2="21.5" y2="10.5" stroke="url(#lm)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Badge({ children, tone = 'cyan', pulse = false }: { children: ReactNode; tone?: 'cyan' | 'emerald' | 'red' | 'slate'; pulse?: boolean }) {
  const tones = {
    cyan: 'border-cyan-500/25 bg-cyan-500/[0.07] text-cyan-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
    slate: 'border-slate-600/40 bg-slate-800/40 text-slate-300',
  } as const;
  const dot = { cyan: 'bg-cyan-400', emerald: 'bg-emerald-400', red: 'bg-red-400', slate: 'bg-slate-400' }[tone];
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold tracking-[0.14em] uppercase ${tones[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${pulse ? 'pulse-ring' : ''}`} />
      {children}
    </span>
  );
}

export function ShieldIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6l7-3z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

export function NavButton({ onClick, children, variant = 'ghost', ariaLabel }: {
  onClick: () => void; children: ReactNode; variant?: 'ghost' | 'accent' | 'outline'; ariaLabel?: string;
}) {
  const styles = {
    ghost: 'text-slate-400 hover:text-white',
    outline: 'text-slate-300 hover:text-white border border-slate-700/60 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-600/60 px-4 py-2',
    accent: 'text-cyan-300 hover:text-cyan-200 border border-cyan-500/25 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.12] hover:border-cyan-500/45 px-4 py-2 shadow-lg shadow-cyan-500/0 hover:shadow-cyan-500/10',
  } as const;
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`group inline-flex items-center gap-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function PageFooter({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <footer className="mt-12 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
      <p className="text-slate-500 font-mono tracking-tight text-center sm:text-left">{left}</p>
      {right && (
        <p className="text-slate-400 flex items-center gap-2">
          <LockIcon className="w-3.5 h-3.5 text-emerald-400" />
          {right}
        </p>
      )}
    </footer>
  );
}
