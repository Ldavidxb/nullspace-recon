import { useState } from 'react';

interface Props {
  bandRatios: [number, number, number];
}

// Axis order and placement: Measured (top), Ill-conditioned (bottom-right), Null (bottom-left).
const axes = [
  { label: 'Measured', short: 'Measured', color: '#10b981', text: 'text-emerald-400', deg: -90 },
  { label: 'Ill-conditioned', short: 'Ill-cond.', color: '#eab308', text: 'text-yellow-400', deg: 30 },
  { label: 'Null (AI-supplied)', short: 'Null', color: '#ef4444', text: 'text-red-400', deg: 150 },
] as const;

export function SpectralRadar({ bandRatios }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const cx = 130, cy = 122, maxR = 88;
  const rad = (d: number) => (d * Math.PI) / 180;
  const at = (i: number, r: number) => ({
    x: cx + r * Math.cos(rad(axes[i].deg)),
    y: cy + r * Math.sin(rad(axes[i].deg)),
  });

  const points = bandRatios.map((v, i) => at(i, Math.min(1, Math.max(0, v)) * maxR));
  const poly = points.map(p => `${p.x},${p.y}`).join(' ');
  const ring = (level: number) => axes.map((_, i) => at(i, maxR * level)).map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 260 236" className="w-full max-w-[320px]" role="img"
        aria-label={`Band norm ratios: measured ${(bandRatios[0] * 100).toFixed(1)}%, ill-conditioned ${(bandRatios[1] * 100).toFixed(1)}%, null ${(bandRatios[2] * 100).toFixed(1)}%`}>
        <defs>
          <linearGradient id="radar-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map(level => (
          <polygon key={level} points={ring(level)} fill={level === 1 ? 'rgba(15,23,42,0.35)' : 'none'}
            stroke="rgba(100,116,139,0.28)" strokeWidth="0.8" strokeDasharray={level === 1 ? undefined : '2 3'} />
        ))}
        {[0.5, 1].map(level => {
          const p = at(0, maxR * level);
          return (
            <text key={level} x={p.x + 5} y={p.y + 3} fontSize="7.5" fill="#64748b" fontFamily="JetBrains Mono, monospace">
              {level * 100}%
            </text>
          );
        })}
        {axes.map((_, i) => {
          const e = at(i, maxR);
          return <line key={i} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="rgba(100,116,139,0.35)" strokeWidth="0.8" />;
        })}

        <polygon points={poly} fill="url(#radar-fill)" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'fade-in 0.8s ease-out both' }} />

        {points.map((p, i) => (
          <g key={i} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} className="cursor-default">
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={active === i ? 7 : 5.5} fill={axes[i].color} stroke="#050810" strokeWidth="2"
              style={{ transition: 'r 0.15s' }} />
          </g>
        ))}

        {axes.map((a, i) => {
          const l = at(i, maxR + 20);
          return (
            <text key={a.label} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central"
              fill="#cbd5e1" fontSize="10" fontWeight="600">
              {a.short}
            </text>
          );
        })}

        {active !== null && (() => {
          const p = points[active];
          const w = 92, h = 30;
          const x = Math.min(260 - w - 2, Math.max(2, p.x - w / 2));
          const y = p.y - h - 12 < 2 ? p.y + 12 : p.y - h - 12;
          return (
            <g pointerEvents="none">
              <rect x={x} y={y} width={w} height={h} rx="6" fill="rgba(15,23,42,0.95)" stroke="rgba(148,163,184,0.25)" />
              <text x={x + w / 2} y={y + 11} textAnchor="middle" fontSize="8" fill="#94a3b8">{axes[active].label}</text>
              <text x={x + w / 2} y={y + 23} textAnchor="middle" fontSize="10" fill="#f8fafc" fontWeight="600"
                fontFamily="JetBrains Mono, monospace">{(bandRatios[active] * 100).toFixed(1)}% of ‖x‖</text>
            </g>
          );
        })()}
      </svg>

      <div className="mt-2 w-full grid grid-cols-3 gap-2 text-center">
        {axes.map((a, i) => (
          <div key={a.label} className="rounded-lg bg-slate-950/40 border border-slate-700/40 px-2 py-2.5">
            <div className={`text-lg sm:text-xl font-mono font-semibold ${a.text}`}>
              {(bandRatios[i] * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{a.short}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
