import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { gaussianBlur } from '../lib/engine';

interface Props {
  measured: number[];
  illConditioned: number[];
  nullBand: number[];
  reconstruction: number[];
  bandRatios: [number, number, number];
  n: number;
}

const BAND_COLORS = {
  measured: [16, 185, 129],
  ill: [234, 179, 8],
  null: [239, 68, 68],
} as const;

const BAND_NAMES = ['Measured', 'Ill-conditioned', 'Null (AI-supplied)'] as const;
const BAND_DOT = ['bg-measured', 'bg-illcond', 'bg-null'] as const;

function rms(a: number[]) {
  let s = 0;
  for (const v of a) s += v * v;
  return Math.sqrt(s / a.length) || 1;
}

/**
 * Per-pixel share of each provenance band: local band energy relative to that band's
 * RMS, tempered by the global band-norm ratios (sub-linearly, so a dominant null band
 * doesn't wash out the regions the scanner genuinely measured).
 */
function computeShares(measured: number[], ill: number[], nul: number[], ratios: [number, number, number], n: number) {
  // Local band energy (smoothed magnitude) so the map shows coherent regions rather than per-pixel noise.
  const energy = (a: number[]) => gaussianBlur(a.map(Math.abs), n, 1.1);
  [measured, ill, nul] = [energy(measured), energy(ill), energy(nul)];
  const [rm, ri, rn] = [rms(measured), rms(ill), rms(nul)];
  return measured.map((_, i) => {
    const m = (measured[i] / rm) ** 1.5 * ratios[0] ** 0.35;
    const c = (ill[i] / ri) ** 1.5 * ratios[1] ** 0.35;
    const z = (nul[i] / rn) ** 1.5 * ratios[2] ** 0.35;
    const t = m + c + z || 1;
    return [m / t, c / t, z / t] as [number, number, number];
  });
}

export function ProvenanceHeatmap({ measured, illConditioned, nullBand, reconstruction, bandRatios, n }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const shares = useMemo(
    () => computeShares(measured, illConditioned, nullBand, bandRatios, n),
    [measured, illConditioned, nullBand, bandRatios, n],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(n, n);

    let max = 0;
    for (const v of reconstruction) max = Math.max(max, Math.abs(v));
    max ||= 1;

    const cols = [BAND_COLORS.measured, BAND_COLORS.ill, BAND_COLORS.null];
    for (let i = 0; i < n * n; i++) {
      // Sharpen the mix toward the dominant band so the map reads as provenance, not mud.
      const w = shares[i].map(s => s ** 2.2);
      const wt = w[0] + w[1] + w[2] || 1;
      const brightness = 0.22 + 0.78 * Math.sqrt(Math.min(1, Math.abs(reconstruction[i]) / (0.45 * max)));
      for (let ch = 0; ch < 3; ch++) {
        const c = (cols[0][ch] * w[0] + cols[1][ch] * w[1] + cols[2][ch] * w[2]) / wt;
        img.data[4 * i + ch] = Math.min(255, c * Math.min(1, brightness));
      }
      img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [shares, reconstruction, n]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * n);
    if (x >= 0 && y >= 0 && x < n && y < n) setHover({ x, y });
  };

  const hovered = hover ? shares[hover.y * n + hover.x] : null;
  const dominant = hovered ? hovered.indexOf(Math.max(...hovered)) : -1;

  return (
    <div className="flex flex-col h-full">
      <div
        className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-slate-700/50 cursor-crosshair touch-none"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} className="block w-full h-full render-pixelated" aria-label="Spectral provenance heatmap" role="img" />
        {hover && hovered && (
          <>
            <div
              className="absolute ring-1 ring-white/90 pointer-events-none"
              style={{
                left: `${(hover.x / n) * 100}%`, top: `${(hover.y / n) * 100}%`,
                width: `${100 / n}%`, height: `${100 / n}%`,
              }}
            />
            <div
              className="absolute z-10 pointer-events-none glass-strong rounded-lg px-3 py-2 text-[11px] min-w-[150px] shadow-xl"
              style={{
                left: hover.x < n / 2 ? `calc(${((hover.x + 1) / n) * 100}% + 8px)` : undefined,
                right: hover.x >= n / 2 ? `calc(${((n - hover.x) / n) * 100}% + 8px)` : undefined,
                top: hover.y < n / 2 ? `${(hover.y / n) * 100}%` : undefined,
                bottom: hover.y >= n / 2 ? `${((n - hover.y - 1) / n) * 100}%` : undefined,
              }}
            >
              <div className="font-mono text-slate-400 mb-1">px ({hover.x}, {hover.y})</div>
              {BAND_NAMES.map((name, i) => (
                <div key={name} className={`flex items-center justify-between gap-3 ${i === dominant ? 'text-white font-semibold' : 'text-slate-300'}`}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${BAND_DOT[i]}`} />
                    {name.split(' ')[0]}
                  </span>
                  <span className="font-mono">{(hovered[i] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-4 text-xs text-slate-300">
        {BAND_NAMES.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${BAND_DOT[i]}`} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
