import { formatP } from '../lib/format';

interface Props {
  pValue: number;
  reducedChi2: number;
  statistic: number;
  dof: number;
  alpha?: number;
}

// Zones on a log-scaled p axis so the 1% and 10% boundaries are legible:
// 1e-4 … 1 maps to 0° … 180°.
const P_MIN = 1e-4;
const toDeg = (p: number) => ((Math.log10(Math.min(1, Math.max(P_MIN, p))) - Math.log10(P_MIN)) / -Math.log10(P_MIN)) * 180;

export function ChiSquaredGauge({ pValue, reducedChi2, statistic, dof, alpha = 0.01 }: Props) {
  const pass = pValue > alpha;
  const cx = 120, cy = 118, radius = 92, stroke = 14;

  const polar = (deg: number, r = radius) => ({
    x: cx - r * Math.cos((deg * Math.PI) / 180),
    y: cy - r * Math.sin((deg * Math.PI) / 180),
  });
  const arc = (from: number, to: number, r = radius) => {
    const s = polar(from, r), e = polar(to, r);
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
  };

  const zones = [
    { from: 0, to: toDeg(0.01), color: '#ef4444', label: '1%' },
    { from: toDeg(0.01), to: toDeg(0.1), color: '#f59e0b', label: '10%' },
    { from: toDeg(0.1), to: 180, color: '#10b981', label: '' },
  ];
  const needleDeg = toDeg(pValue);
  const tip = polar(needleDeg, radius - 20);
  const verdictColor = pass ? '#34d399' : '#f87171';

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="-16 0 272 150" className="w-full max-w-[320px]" role="img"
        aria-label={`p-value gauge: ${formatP(pValue)}, ${pass ? 'consistent' : 'inconsistent'}`}>
        <defs>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <path d={arc(0, 180)} stroke="rgba(51,65,85,0.5)" strokeWidth={stroke + 6} fill="none" strokeLinecap="round" />
        {zones.map((z, i) => (
          <path key={i} d={arc(z.from + (i ? 1 : 0), z.to - (i < 2 ? 1 : 0))} stroke={z.color} strokeOpacity={0.9}
            strokeWidth={stroke} fill="none" strokeLinecap="butt" />
        ))}

        {/* tick labels at zone boundaries */}
        {[[0.0001, '0.01%'], [0.01, '1%'], [0.1, '10%'], [1, '100%']].map(([p, label]) => {
          const d = toDeg(p as number);
          const inner = polar(d, radius - stroke / 2 - 3);
          const outer = polar(d, radius + stroke / 2 + 3);
          const lab = polar(d, radius + stroke / 2 + 13);
          return (
            <g key={label as string}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#050810" strokeWidth="2" />
              <text x={lab.x} y={lab.y} fontSize="8.5" fill="#94a3b8" textAnchor="middle" dominantBaseline="middle"
                fontFamily="JetBrains Mono, monospace">{label}</text>
            </g>
          );
        })}

        <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'needle-in 1.1s cubic-bezier(0.3, 1.4, 0.4, 1) both' }}>
          <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={verdictColor} strokeWidth="6" strokeLinecap="round" opacity="0.35" filter="url(#gauge-glow)" />
          <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r="7" fill="#0f172a" stroke={verdictColor} strokeWidth="2.5" />
      </svg>

      <div className="-mt-1 text-center">
        <div className="text-2xl font-mono font-semibold text-white">
          {formatP(pValue)}
        </div>
        <div className={`mt-1 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] ${pass ? 'text-emerald-400' : 'text-red-400'}`}>
          <span aria-hidden>{pass ? '✓' : '✕'}</span>
          {pass ? 'CONSISTENT' : 'INCONSISTENT'}
        </div>
      </div>

      <dl className="mt-6 w-full grid grid-cols-3 gap-2">
        {[
          ['Reduced χ²', reducedChi2.toFixed(3)],
          ['Statistic', statistic.toFixed(1)],
          ['DoF', dof.toFixed(0)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-950/40 border border-slate-700/40 px-3 py-2.5 text-center">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{k}</dt>
            <dd className="mt-1 text-sm font-mono text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

