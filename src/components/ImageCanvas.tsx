import { useRef, useEffect } from 'react';

interface Props {
  data: number[];
  n: number;
  className?: string;
  colormap?: 'gray' | 'viridis';
}

function viridis(t: number): [number, number, number] {
  const r = Math.min(255, Math.max(0, Math.round(255 * (0.267 + t * (0.004 + t * (2.244 - t * 1.515))))));
  const g = Math.min(255, Math.max(0, Math.round(255 * (0.004 + t * (1.384 + t * (-0.822 + t * 0.170))))));
  const b = Math.min(255, Math.max(0, Math.round(255 * (0.329 + t * (1.442 + t * (-4.003 + t * 3.173))))));
  return [r, g, b];
}

export function ImageCanvas({ data, n, className = '', colormap = 'gray' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(n, n);

    let max = -Infinity, min = Infinity;
    for (const v of data) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
    const range = max - min || 1;

    for (let i = 0; i < n * n; i++) {
      const t = (data[i] - min) / range;
      let r: number, g: number, b: number;
      if (colormap === 'viridis') {
        [r, g, b] = viridis(t);
      } else {
        r = g = b = Math.round(t * 255);
      }
      img.data[4 * i] = r;
      img.data[4 * i + 1] = g;
      img.data[4 * i + 2] = b;
      img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [data, n, colormap]);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-full render-pixelated rounded-lg border border-slate-700/50 ${className}`}
    />
  );
}
