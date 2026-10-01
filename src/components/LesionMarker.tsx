/** Dashed ring marking the injected lesion, positioned in display-pixel coordinates (x = row, y = column). */
export function LesionMarker({ lesion, n, tone = 'white' }: { lesion?: { x: number; y: number; r: number }; n: number; tone?: 'white' | 'red' }) {
  if (!lesion) return null;
  const d = ((lesion.r * 3.2) / n) * 100;
  return (
    <div
      className={`absolute pointer-events-none rounded-full border-2 border-dashed ${tone === 'red' ? 'border-red-300/90' : 'border-white/80'} shadow-[0_0_0_1px_rgba(0,0,0,0.4)]`}
      style={{
        width: `${d}%`, height: `${d}%`,
        left: `${((lesion.y + 0.5) / n) * 100}%`, top: `${((lesion.x + 0.5) / n) * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-label="Injected lesion"
    />
  );
}
