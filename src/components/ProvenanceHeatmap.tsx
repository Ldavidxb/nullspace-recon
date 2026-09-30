import { useRef, useEffect } from 'react';

interface Props {
  measured: number[];
  illConditioned: number[];
  null_band: number[];
  n: number;
  className?: string;
}

export function ProvenanceHeatmap({ measured, illConditioned, null_band, n, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(n, n);

    let maxM = 0, maxI = 0, maxN = 0;
    for (let i = 0; i < n * n; i++) {
      const am = Math.abs(measured[i]);
      const ai = Math.abs(illConditioned[i]);
      const an = Math.abs(null_band[i]);
      if (am > maxM) maxM = am;
      if (ai > maxI) maxI = ai;
      if (an > maxN) maxN = an;
    }
    maxM = maxM || 1;
    maxI = maxI || 1;
    maxN = maxN || 1;

    for (let i = 0; i < n * n; i++) {
      const fm = Math.abs(measured[i]) / maxM;
      const fi = Math.abs(illConditioned[i]) / maxI;
      const fn = Math.abs(null_band[i]) / maxN;

      const total = fm + fi + fn || 1;
      const wm = fm / total;
      const wi = fi / total;
      const wn = fn / total;

      const intensity = Math.min(1, (fm + fi + fn) * 0.8);

      const r = Math.round(255 * intensity * (wn * 0.95 + wi * 0.97));
      const g = Math.round(255 * intensity * (wm * 0.90 + wi * 0.75 + wn * 0.15));
      const b = Math.round(255 * intensity * (wm * 0.35 + wn * 0.08));

      img.data[4 * i] = Math.min(255, Math.max(0, r));
      img.data[4 * i + 1] = Math.min(255, Math.max(0, g));
      img.data[4 * i + 2] = Math.min(255, Math.max(0, b));
      img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [measured, illConditioned, null_band, n]);

  return (
    <div className="flex flex-col h-full">
      <canvas
        ref={canvasRef}
        className={`block w-full flex-1 render-pixelated rounded-lg border border-slate-700/50 ${className}`}
      />
      <div className="flex justify-center gap-5 pt-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Measured
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          Ill-conditioned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Null (AI-supplied)
        </span>
      </div>
    </div>
  );
}
