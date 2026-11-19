import type { CSSProperties } from "react";
import type { Element, Palette } from "../areas";
import type { Mood } from "../rules";
import { COLOURS, itemById, type ShopItem } from "@/features/treasury/catalog";
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
  /** Equipped cosmetic item id (treasure shop). */
  accessory?: string | null;
}

function Runs({ runs, palette }: { runs: Run[]; palette: Palette }) {
  return runs.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={palette[r.role]} />);
}

/** Cosmetic pixels centred on the head top (bottom row just above the head). */
function Accessory({ item, head }: { item: ShopItem; head: [number, number] }) {
  const width = Math.max(...item.pixels.map((r) => r.length));
  const left = head[0] - Math.floor(width / 2);
  const bottom = head[1] - (item.lift ?? 0);
  const top = bottom - item.pixels.length + 1;
  return (
    <g data-testid="accessory">
      {item.pixels.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : <rect key={`${x}-${y}`} x={left + x} y={top + y} width={1} height={1} fill={COLOURS[ch]} />,
        ),
      )}
    </g>
  );
}

const origin = ([x, y]: [number, number]): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

/** Crisp pixel-art elemental dragon rendered as layered SVG. */
export function DragonSprite({ stage, mood, element, palette, label, className, animate = true, accessory }: Props) {
  const item = itemById(accessory);
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
      {item && <Accessory item={item} head={l.head} />}
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
