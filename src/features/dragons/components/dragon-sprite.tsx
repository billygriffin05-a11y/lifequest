import type { CSSProperties } from "react";
import type { Element, Palette } from "../areas";
import type { Mood } from "../rules";
import { GRID_H, GRID_W, spriteLayers, type Run } from "../sprite";

interface Props {
  stage: number;
  mood: Mood;
  element: Element;
  palette: Palette;
  label: string;
  className?: string;
  /** Turn idle animation on (wings, breathing, blink, breath, motes). */
  animate?: boolean;
}

function Runs({ runs, palette }: { runs: Run[]; palette: Palette }) {
  return runs.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={palette[r.role]} />);
}

const origin = ([x, y]: [number, number]): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

/** Crisp pixel-art elemental dragon rendered as layered SVG. */
export function DragonSprite({ stage, mood, element, palette, label, className, animate = true }: Props) {
  const l = spriteLayers(stage, mood, element);
  const calm = mood === "grumpy" || mood === "restless";
  return (
    <svg viewBox={`0 0 ${GRID_W} ${GRID_H}`} shapeRendering="crispEdges" role="img" aria-label={label} className={className}>
      {l.wing.length > 0 && l.wingOrigin && (
        <g className={animate && !calm ? (mood === "joyful" ? "lq-flap lq-fast" : "lq-flap") : undefined} style={origin(l.wingOrigin)}>
          <Runs runs={l.wing} palette={palette} />
        </g>
      )}
      <g className={animate ? "lq-breathe" : undefined}>
        <Runs runs={l.body} palette={palette} />
        {l.lids.length > 0 && (
          <g className={animate ? "lq-blink" : "lq-lid-hidden"}>
            <Runs runs={l.lids} palette={palette} />
          </g>
        )}
      </g>
      {l.breath.length > 0 && l.mouth && (
        <g className={animate ? "lq-breath" : undefined} style={origin(l.mouth)} data-testid="dragon-breath">
          <Runs runs={l.breath} palette={palette} />
        </g>
      )}
      {l.motes.map((m, i) => (
        <g key={i} className={animate && !calm ? "lq-float" : undefined} style={{ animationDelay: `${m.delay}s` }}>
          <Runs runs={m.runs} palette={palette} />
        </g>
      ))}
    </svg>
  );
}
