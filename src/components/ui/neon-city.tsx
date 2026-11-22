/**
 * Procedural pixel-art neon city skyline, fixed behind every page.
 * Deterministic (same pixels every render), drawn on a 192×108 grid and
 * scaled up with crisp edges. Colours are art data (like the dragon
 * palettes), not UI tokens. A dark veil on top keeps text readable.
 * Tests: tests/unit/neon-city.test.ts
 */

export const CITY_W = 192;
export const CITY_H = 108;

const ART = {
  skyTop: "#0c0618",
  skyMid: "#22114a",
  skyGlow: "#1f6f7a",
  far: "#1a2e57",
  farLit: "#3ef5c4",
  mid: "#150a2e",
  midEdge: "#2c1a59",
  near: "#0a0516",
  pink: "#ff2bd1",
  pinkSoft: "#ff8fe6",
  yellow: "#ffd23f",
  cyan: "#5ff9ff",
  green: "#3ef5c4",
} as const;

type Rect = { x: number; y: number; w: number; h: number; fill: string; o?: number };

/** Deterministic pseudo-random in [0, 1). */
function rand(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function skyline(layer: number, baseY: number, minH: number, maxH: number, minW: number, maxW: number): { x: number; w: number; top: number }[] {
  const out: { x: number; w: number; top: number }[] = [];
  let x = -2;
  let i = 0;
  while (x < CITY_W + 2) {
    const w = Math.round(minW + rand(layer * 1000 + i) * (maxW - minW));
    const h = Math.round(minH + rand(layer * 2000 + i) * (maxH - minH));
    out.push({ x, w, top: baseY - h });
    x += w + (rand(layer * 3000 + i) < 0.25 ? 1 : 0);
    i++;
  }
  return out;
}

export function cityRects(): Rect[] {
  const r: Rect[] = [];
  // Far towers with sparse teal / yellow windows.
  for (const [i, b] of skyline(1, 92, 30, 78, 7, 15).entries()) {
    r.push({ x: b.x, y: b.top, w: b.w, h: CITY_H - b.top, fill: ART.far });
    for (let y = b.top + 3; y < 90; y += 3) {
      for (let x = b.x + 1; x < b.x + b.w - 1; x += 2) {
        const n = rand(i * 7919 + y * 131 + x);
        if (n < 0.16) r.push({ x, y, w: 1, h: 1, fill: n < 0.05 ? ART.yellow : ART.farLit, o: 0.75 });
      }
    }
  }
  // Mid buildings: darker, with vertical neon signs and lit balconies.
  for (const [i, b] of skyline(2, 100, 18, 52, 10, 22).entries()) {
    r.push({ x: b.x, y: b.top, w: b.w, h: CITY_H - b.top, fill: ART.mid });
    r.push({ x: b.x, y: b.top, w: b.w, h: 1, fill: ART.midEdge });
    const n = rand(5000 + i);
    if (n < 0.55 && b.w > 11) {
      const sx = b.x + 2 + Math.floor(rand(6000 + i) * (b.w - 5));
      const sh = 6 + Math.floor(rand(7000 + i) * 8);
      const colour = n < 0.2 ? ART.pink : n < 0.38 ? ART.yellow : ART.cyan;
      r.push({ x: sx - 1, y: b.top + 4, w: 4, h: sh + 2, fill: colour, o: 0.18 });
      r.push({ x: sx, y: b.top + 5, w: 2, h: sh, fill: colour });
      for (let k = 1; k < sh; k += 2) r.push({ x: sx, y: b.top + 5 + k, w: 2, h: 1, fill: ART.mid, o: 0.55 });
    }
    if (rand(8000 + i) < 0.5) {
      const by = b.top + 10 + Math.floor(rand(9000 + i) * 10);
      r.push({ x: b.x + 1, y: by, w: b.w - 2, h: 1, fill: ART.pinkSoft, o: 0.55 });
    }
  }
  // Glowing shop front low on the right, like a neon doorway.
  r.push({ x: 150, y: 86, w: 22, h: 12, fill: ART.pink, o: 0.22 });
  r.push({ x: 152, y: 88, w: 18, h: 2, fill: ART.pink });
  r.push({ x: 154, y: 91, w: 14, h: 7, fill: ART.pinkSoft, o: 0.35 });
  // Skywalk bridge across the foreground with a pink rail and support struts.
  r.push({ x: 0, y: 96, w: CITY_W, h: 3, fill: ART.near });
  r.push({ x: 0, y: 95, w: CITY_W, h: 1, fill: ART.pink, o: 0.8 });
  for (let x = 4; x < CITY_W; x += 12) r.push({ x, y: 92, w: 1, h: 4, fill: ART.near });
  r.push({ x: 0, y: 92, w: CITY_W, h: 1, fill: ART.near });
  for (let x = 10; x < CITY_W; x += 38) r.push({ x, y: 99, w: 3, h: CITY_H - 99, fill: ART.near });
  // Ground level.
  r.push({ x: 0, y: 104, w: CITY_W, h: 4, fill: ART.near });
  r.push({ x: 0, y: 104, w: CITY_W, h: 1, fill: ART.green, o: 0.35 });
  return r;
}

const RECTS = cityRects();

/** Fixed full-screen backdrop. Decorative only. */
export function NeonCity() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" data-testid="neon-city">
      <svg viewBox={`0 0 ${CITY_W} ${CITY_H}`} preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" className="h-full w-full">
        <defs>
          <linearGradient id="lq-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ART.skyTop} />
            <stop offset="0.55" stopColor={ART.skyMid} />
            <stop offset="0.9" stopColor={ART.skyGlow} />
          </linearGradient>
        </defs>
        <rect width={CITY_W} height={CITY_H} fill="url(#lq-sky)" />
        {RECTS.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} opacity={r.o} />
        ))}
      </svg>
      {/* Veil: darker at the top where headings sit, lighter low down so the city glows through. */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian-950/80 via-obsidian-950/45 to-obsidian-950/10" />
    </div>
  );
}
