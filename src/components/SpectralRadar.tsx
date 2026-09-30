interface Props {
  bandRatios: [number, number, number];
}

const labels = ['Measured', 'Ill-cond.', 'Null'] as const;
const colorClasses = ['text-emerald-400', 'text-amber-400', 'text-red-400'] as const;
const svgColors = ['#10b981', '#f59e0b', '#ef4444'] as const;

export function SpectralRadar({ bandRatios }: Props) {
  const cx = 100;
  const cy = 100;
  const maxR = 75;
  const angles = [270, 30, 150].map(d => (d * Math.PI) / 180);

  const maxVal = Math.max(...bandRatios, 0.01);
  const points = bandRatios.map((v, i) => {
    const r = (v / maxVal) * maxR;
    return {
      x: cx + r * Math.cos(angles[i]),
      y: cy + r * Math.sin(angles[i]),
    };
  });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-48">
        {gridLevels.map(level => (
          <polygon
            key={level}
            points={angles.map(a =>
              `${cx + maxR * level * Math.cos(a)},${cy + maxR * level * Math.sin(a)}`
            ).join(' ')}
            fill="none"
            stroke="#334155"
            strokeWidth="0.5"
          />
        ))}

        {angles.map((a, i) => (
          <line key={i} x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(a)} y2={cy + maxR * Math.sin(a)}
            stroke="#334155" strokeWidth="0.5"
          />
        ))}

        <polygon
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="rgba(6, 182, 212, 0.15)"
          stroke="#06b6d4"
          strokeWidth="1.5"
        />

        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={svgColors[i]} />
        ))}

        {angles.map((a, i) => {
          const lx = cx + (maxR + 18) * Math.cos(a);
          const ly = cy + (maxR + 18) * Math.sin(a);
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
              fill={svgColors[i]} fontSize="9" fontWeight="500">
              {labels[i]}
            </text>
          );
        })}
      </svg>

      <div className="grid grid-cols-3 gap-3 mt-2 text-center">
        {labels.map((label, i) => (
          <div key={label}>
            <div className={`text-lg font-mono font-semibold ${colorClasses[i]}`}>
              {(bandRatios[i] * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
