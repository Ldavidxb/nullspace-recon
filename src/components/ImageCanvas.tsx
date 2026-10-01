import { useRef, useEffect } from 'react';

interface Props {
  data: number[];
  n: number;
  className?: string;
  colormap?: 'gray' | 'viridis';
  /** Fixed display window; defaults to the data's own min/max. */
  range?: [number, number];
}

// Viridis control points (matplotlib), linearly interpolated.
const VIRIDIS = [
  [68, 1, 84], [72, 35, 116], [64, 67, 135], [52, 94, 141], [41, 120, 142],
  [32, 144, 140], [34, 167, 132], [68, 190, 112], [121, 209, 81], [189, 222, 38], [253, 231, 37],
];

function viridis(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  const f = x - i;
  const a = VIRIDIS[i], b = VIRIDIS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function ImageCanvas({ data, n, className = '', colormap = 'gray', range }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(n, n);

    let min = Infinity, max = -Infinity;
    if (range) {
      [min, max] = range;
    } else {
      for (const v of data) {
        if (v > max) max = v;
        if (v < min) min = v;
      }
    }
    const span = max - min || 1;

    for (let i = 0; i < n * n; i++) {
      const t = (data[i] - min) / span;
      const [r, g, b] = colormap === 'viridis' ? viridis(t) : [t * 255, t * 255, t * 255];
      img.data[4 * i] = r;
      img.data[4 * i + 1] = g;
      img.data[4 * i + 2] = b;
      img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [data, n, colormap, range]);

  return <canvas ref={canvasRef} className={`block w-full h-full render-pixelated ${className}`} />;
}
