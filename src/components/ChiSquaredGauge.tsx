interface Props {
  pValue: number;
  reducedChi2: number;
  statistic: number;
  dof: number;
}

export function ChiSquaredGauge({ pValue, reducedChi2, statistic, dof }: Props) {
  const pass = pValue > 0.01;
  const angle = Math.min(Math.max(pValue, 0), 1) * 180;
  const radius = 80;
  const cx = 100;
  const cy = 95;

  const toXY = (deg: number) => ({
    x: cx + radius * Math.cos(Math.PI - (deg * Math.PI) / 180),
    y: cy - radius * Math.sin(Math.PI - (deg * Math.PI) / 180),
  });

  const needleEnd = toXY(angle);

  const arcPath = (start: number, end: number) => {
    const s = toXY(start);
    const e = toXY(end);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 0 ${e.x} ${e.y}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-52">
        <path d={arcPath(0, 1.8)} stroke="#ef4444" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d={arcPath(1.8, 18)} stroke="#f59e0b" strokeWidth="8" fill="none" />
        <path d={arcPath(18, 180)} stroke="#10b981" strokeWidth="8" fill="none" strokeLinecap="round" />

        <line
          x1={cx} y1={cy}
          x2={needleEnd.x} y2={needleEnd.y}
          stroke={pass ? '#10b981' : '#ef4444'}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={pass ? '#10b981' : '#ef4444'} />

        <text x={cx} y={cy + 20} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
          p = {pValue < 0.001 ? pValue.toExponential(1) : pValue.toFixed(3)}
        </text>
      </svg>

      <div className={`text-sm font-medium mt-1 ${pass ? 'text-green-400' : 'text-red-400'}`}>
        {pass ? 'CONSISTENT' : 'INCONSISTENT'}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-slate-400">
        <span>Reduced chi-sq:</span>
        <span className="text-slate-200 font-mono">{reducedChi2.toFixed(3)}</span>
        <span>Statistic:</span>
        <span className="text-slate-200 font-mono">{statistic.toFixed(1)}</span>
        <span>DoF:</span>
        <span className="text-slate-200 font-mono">{dof.toFixed(0)}</span>
      </div>
    </div>
  );
}
