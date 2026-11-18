/**
 * Procedural pixel-art dragon sprites.
 *
 * Each stage is built from simple shapes (ellipses, polygons) on a 40×40 grid,
 * then given a 1-pixel outline — the classic sprite look. Output is a list of
 * horizontal runs per palette role, so any area palette can colour it.
 * Deterministic: same (stage, mood) → same pixels.
 */
import type { PaletteRole } from "./areas";
import type { Mood } from "./rules";

export const GRID = 40;
const GROUND = 37;

type Cell = PaletteRole | null;
type Grid = Cell[][];

export interface Run {
  x: number;
  y: number;
  w: number;
  role: PaletteRole;
}

function makeGrid(): Grid {
  return Array.from({ length: GRID }, () => Array<Cell>(GRID).fill(null));
}

function set(g: Grid, x: number, y: number, role: PaletteRole) {
  if (x >= 0 && y >= 0 && x < GRID && y < GRID) g[y][x] = role;
}

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, role: PaletteRole, only?: (x: number, y: number) => boolean) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!only || only(x, y))) set(g, x, y, role);
    }
  }
}

function polygon(g: Grid, pts: readonly [number, number][], role: PaletteRole) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) set(g, x, y, role);
    }
  }
}

function line(g: Grid, x0: number, y0: number, x1: number, y1: number, role: PaletteRole) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    set(g, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), role);
  }
}

/** Add a 1-px outline around every filled pixel (aura sparkles stay free-floating). */
function addOutline(g: Grid) {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (g[y][x] !== null) continue;
      const near = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].some(([nx, ny]) => {
        const c = g[ny]?.[nx];
        return c != null && c !== "aura" && c !== "outline";
      });
      if (near) out[y][x] = "outline";
    }
  }
  for (let y = 0; y < GRID; y++) g[y] = out[y];
}

function drawEgg(g: Grid, cracked: boolean) {
  const cx = 20;
  const cy = 27;
  const top = cracked ? 24 : 0; // hatching: only the lower shell remains
  ellipse(g, cx, cy, 7.5, 9.5, "belly", (_x, y) => y >= top || !cracked);
  ellipse(g, cx + 3.5, cy + 3, 4.5, 6, "bellyShade", (x, y) => x > cx + 1 && (y >= top || !cracked));
  if (cracked) {
    // jagged broken rim
    for (let x = 13; x <= 27; x++) if (x % 3 === 0) set(g, x, top - 1, "belly");
  }
  for (const [sx, sy, r] of [
    [17, 22, 1.6],
    [23, 26, 1.3],
    [16, 31, 1.2],
    [22, 33, 1.5],
  ] as const) {
    if (!cracked || sy >= top) ellipse(g, sx, sy, r, r, "spot");
  }
}

interface Shape {
  s: number;
}

/** Scale around the ground centre so every stage stands on the same floor. */
function sc(shape: Shape, x: number, y: number): [number, number] {
  return [20 + (x - 20) * shape.s, GROUND - (GROUND - y) * shape.s];
}

function drawEye(g: Grid, ex: number, ey: number, mood: Mood) {
  const x = Math.round(ex);
  const y = Math.round(ey);
  switch (mood) {
    case "joyful":
      set(g, x - 1, y + 1, "eye");
      set(g, x, y, "eye");
      set(g, x + 1, y + 1, "eye");
      set(g, x - 1, y + 3, "blush");
      set(g, x, y + 3, "blush");
      break;
    case "restless":
      set(g, x - 1, y + 1, "eye");
      set(g, x, y + 1, "eye");
      set(g, x + 1, y + 1, "eye");
      break;
    case "grumpy":
      set(g, x, y, "eye");
      set(g, x + 1, y, "eye");
      set(g, x, y + 1, "eye");
      set(g, x + 1, y + 1, "eye");
      set(g, x - 1, y - 2, "outline");
      set(g, x, y - 2, "outline");
      set(g, x + 1, y - 1, "outline");
      set(g, x + 2, y - 1, "outline");
      break;
    default:
      set(g, x, y, "eye");
      set(g, x + 1, y, "eye");
      set(g, x, y + 1, "eye");
      set(g, x + 1, y + 1, "eye");
      set(g, x, y, "eyeShine");
  }
}

const SCALE_BY_STAGE = [0, 0, 0.56, 0.62, 0.68, 0.75, 0.82, 0.88, 0.94, 1];

function drawDragon(g: Grid, stage: number, mood: Mood) {
  const shape = { s: SCALE_BY_STAGE[stage] };
  const k = shape.s;
  // Young dragons get proportionally bigger heads (cute), older ones leaner.
  const headR = 5.4 * k * (1 + (1 - k) * 0.7);

  const [bx, by] = sc(shape, 19, 27);
  const brx = 9 * k;
  const bry = 6.5 * k;
  const [hx, hy] = sc(shape, 29, 16.5);

  // Wings (behind body)
  if (stage >= 4) {
    const span = 0.55 + (stage - 4) * 0.18;
    const [ax, ay] = sc(shape, 18, 22);
    const tipH = 13 * k * span;
    const tipW = 11 * k * span;
    const wing: [number, number][] = [
      [ax + 3 * k, ay],
      [ax - tipW * 0.55, ay - tipH],
      [ax + tipW * 0.25, ay - tipH * 1.08],
      [ax + tipW * 0.7, ay - tipH * 0.45],
      [ax + 5 * k, ay + 1],
    ];
    polygon(g, wing, "wing");
    line(g, Math.round(ax + 3 * k), Math.round(ay), Math.round(ax - tipW * 0.55), Math.round(ay - tipH), "wingShade");
    line(g, Math.round(ax + 3 * k), Math.round(ay), Math.round(ax + tipW * 0.25), Math.round(ay - tipH * 1.08), "wingShade");
  }

  // Tail: tapering circles curling up and back
  const tailLen = (4 + stage * 1.1) * (stage >= 2 ? 1 : 0);
  const [tx0, ty0] = [bx - brx * 0.85, by + bry * 0.25];
  let tipX = tx0;
  let tipY = ty0;
  const segments = 14;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = tx0 - tailLen * t * 0.85;
    const y = ty0 - Math.sin(t * Math.PI * 0.85) * tailLen * 0.45 + t * 1.5;
    const r = Math.max(0.9, bry * 0.42 * (1 - t * 0.8));
    ellipse(g, x, y, r, r, "body");
    tipX = x;
    tipY = y;
  }
  if (stage >= 5) {
    polygon(
      g,
      [
        [tipX + 0.5, tipY],
        [tipX - 2.6, tipY - 2.4],
        [tipX - 2.2, tipY + 1.6],
      ],
      "accent",
    );
  }

  // Legs
  const legW = Math.max(2, Math.round(2.8 * k));
  for (const lx of [bx - brx * 0.45, bx + brx * 0.45]) {
    for (let y = Math.round(by + bry * 0.4); y <= GROUND - 1; y++) {
      for (let x = Math.round(lx - legW / 2); x < Math.round(lx - legW / 2) + legW; x++) set(g, x, y, "shade");
    }
  }

  // Body, neck, head, snout
  ellipse(g, bx, by, brx, bry, "body");
  ellipse(g, (bx + hx) / 2 + 1, (by + hy) / 2 + 1, headR * 0.62, (by - hy) / 2 + 1, "body");
  ellipse(g, hx, hy, headR, headR * 0.92, "body");
  const snoutX = hx + headR * 0.85;
  const snoutY = hy + headR * 0.35;
  ellipse(g, snoutX, snoutY, headR * 0.62, headR * 0.45, "body");
  set(g, Math.round(snoutX + headR * 0.35), Math.round(snoutY - headR * 0.15), "outline"); // nostril

  // Under-shading and belly
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (g[y][x] === "body" && y > by + bry * 0.45) g[y][x] = "shade";
    }
  }
  ellipse(g, bx + brx * 0.25, by + bry * 0.3, brx * 0.55, bry * 0.55, "belly", (x, y) => g[y]?.[x] === "body" || g[y]?.[x] === "shade");
  ellipse(g, (bx + hx) / 2 + 2.2, (by + hy) / 2 + 2, headR * 0.3, (by - hy) / 2, "belly", (x, y) => g[y]?.[x] === "body");
  if (stage >= 8) {
    // belly plates
    for (let y = Math.round(by - bry * 0.1); y < by + bry * 0.8; y += 2) {
      for (let x = 0; x < GRID; x++) if (g[y]?.[x] === "belly") g[y][x] = "bellyShade";
    }
  }

  // Horns
  if (stage >= 3) {
    const hornLen = 1.8 + (stage - 3) * 0.6;
    for (const off of stage >= 8 ? [-0.55, -0.1] : [-0.3]) {
      const baseX = hx + headR * off;
      const baseY = hy - headR * 0.75;
      polygon(
        g,
        [
          [baseX - 1.2, baseY + 1],
          [baseX + 1.2, baseY + 1],
          [baseX - hornLen * 0.7, baseY - hornLen],
        ],
        "accent",
      );
    }
  }

  // Back spikes
  if (stage >= 6) {
    const count = stage >= 8 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const sx = bx - brx * 0.7 + t * brx * 1.3;
      const sy = by - bry * Math.sqrt(Math.max(0, 1 - ((sx - bx) / brx) ** 2)) + 0.5;
      const h = 1.6 + (stage - 6) * 0.4;
      polygon(
        g,
        [
          [sx - 1.1, sy],
          [sx + 1.1, sy],
          [sx - 0.4, sy - h],
        ],
        "accent",
      );
    }
  }

  // Eye
  drawEye(g, hx + headR * 0.2, hy - headR * 0.25, mood);

  addOutline(g);

  // Ancient: golden crown + sparkles (drawn after outline so they float)
  if (stage >= 9) {
    for (const [x, y] of [
      [Math.round(hx - 2), Math.round(hy - headR - 3)],
      [Math.round(hx), Math.round(hy - headR - 4)],
      [Math.round(hx + 2), Math.round(hy - headR - 3)],
    ]) {
      set(g, x, y, "aura");
      set(g, x, y + 1, "aura");
    }
    for (let x = Math.round(hx - 2); x <= Math.round(hx + 2); x++) set(g, x, Math.round(hy - headR - 1), "aura");
    for (const [x, y] of [
      [3, 6],
      [36, 4],
      [6, 30],
      [37, 25],
      [12, 2],
    ]) {
      if (g[y][x] === null) {
        set(g, x, y, "aura");
        set(g, x - 1, y, "aura");
        set(g, x + 1, y, "aura");
        set(g, x, y - 1, "aura");
        set(g, x, y + 1, "aura");
      }
    }
  }
}

function buildGrid(stage: number, mood: Mood): Grid {
  const g = makeGrid();
  if (stage <= 0) {
    drawEgg(g, false);
    addOutline(g);
  } else if (stage === 1) {
    // Hatching: a little head peeks out of the cracked shell.
    const [hx, hy] = [20, 21];
    ellipse(g, hx, hy, 4.6, 4.2, "body");
    ellipse(g, hx + 3.6, hy + 1.4, 2.4, 1.8, "body");
    drawEye(g, hx + 1, hy - 1.5, mood);
    drawEgg(g, true);
    addOutline(g);
  } else {
    drawDragon(g, stage, mood);
  }
  return g;
}

function toRuns(g: Grid): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < GRID; y++) {
    let x = 0;
    while (x < GRID) {
      const role = g[y][x];
      if (role === null) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < GRID && g[y][x + w] === role) w++;
      runs.push({ x, y, w, role });
      x += w;
    }
  }
  return runs;
}

const cache = new Map<string, Run[]>();

/** Pixel runs for a dragon at `stage` (0–9) with `mood`. Cached; safe to call often. */
export function spriteRuns(stage: number, mood: Mood): Run[] {
  const s = Math.min(9, Math.max(0, Math.floor(stage)));
  const key = `${s}:${mood}`;
  let runs = cache.get(key);
  if (!runs) {
    runs = toRuns(buildGrid(s, mood));
    cache.set(key, runs);
  }
  return runs;
}

/** Number of filled pixels — used by tests to check dragons grow. */
export function pixelCount(runs: readonly Run[]): number {
  return runs.reduce((n, r) => n + r.w, 0);
}
