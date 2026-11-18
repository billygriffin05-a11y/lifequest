import type { Palette } from "../areas";
import type { Mood } from "../rules";
import { GRID, spriteRuns } from "../sprite";

interface Props {
  stage: number;
  mood: Mood;
  palette: Palette;
  label: string;
  className?: string;
}

/** Crisp pixel-art dragon rendered as SVG (scales to any size without blur). */
export function DragonSprite({ stage, mood, palette, label, className }: Props) {
  const runs = spriteRuns(stage, mood);
  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
    >
      {runs.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={palette[r.role]} />
      ))}
    </svg>
  );
}
