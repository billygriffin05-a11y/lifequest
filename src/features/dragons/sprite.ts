/**
 * Procedural pixel-art elemental dragons.
 *
 * Each of the 20 stages is built from simple shapes (ellipses, polygons,
 * bezier strokes) on a 56×40 grid and given a 1-pixel outline — a classic
 * medieval sprite look. The result is split into animatable layers:
 *
 *   wing   – bat wing with finger bones (flaps)
 *   body   – everything else (breathes)
 *   lids   – eye pixels in body colour (blink overlay)
 *   breath – the element's breath attack (flickers)
 *   motes  – floating elemental particles (drift)
 *
 * Runs are palette roles, so each area's palette colours the same pixels.
 * Deterministic: same (stage, mood, element) → same pixels.
 */
import type { Element, PaletteRole } from "./areas";
import { PLANS, type BodyPlan } from "./body-plans";
import { UNLOCKS, type Mood } from "./rules";

export const GRID_W = 56;
export const GRID_H = 40;
const GROUND = 37;

type Cell = PaletteRole | null;
type Grid = Cell[][];
type Pt = [number, number];

export interface Run {
  x: number;
  y: number;
  w: number;
  role: PaletteRole;
}

export interface Particle {
  runs: Run[];
  /** Animation delay in seconds (staggered drift). */
  delay: number;
}

export interface SpriteLayers {
  wing: Run[];
  body: Run[];
  lids: Run[];
  breath: Run[];
  motes: Particle[];
  /** Pivot for the wing flap (viewBox units). */
  wingOrigin: Pt | null;
  /** Pivot for the breath flicker (viewBox units). */
  mouth: Pt | null;
  /** Top-centre of the head (or egg) — where cosmetics sit. */
  head: Pt;
}

// ── Raster helpers ───────────────────────────────────────────────────────────

const makeGrid = (): Grid => Array.from({ length: GRID_H }, () => Array<Cell>(GRID_W).fill(null));

function set(g: Grid, x: number, y: number, role: PaletteRole) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi >= 0 && yi >= 0 && xi < GRID_W && yi < GRID_H) g[yi][xi] = role;
}

const get = (g: Grid, x: number, y: number): Cell => g[y]?.[x] ?? null;

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, role: PaletteRole, only?: (x: number, y: number) => boolean) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!only || only(x, y))) set(g, x, y, role);
    }
  }
}

function polygon(g: Grid, pts: readonly Pt[], role: PaletteRole) {
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

function line(g: Grid, [x0, y0]: Pt, [x1, y1]: Pt, role: PaletteRole) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) set(g, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, role);
}

/** Tapering stroke along a quadratic bezier (horns). */
function bezierStroke(g: Grid, p0: Pt, p1: Pt, p2: Pt, r0: number, r1: number, role: PaletteRole) {
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const r = r0 + (r1 - r0) * t;
    ellipse(g, x, y, Math.max(0.55, r), Math.max(0.55, r), role);
  }
}

/** Deterministic pseudo-random in [0, 1). */
function noise(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const FREE_FLOATING: ReadonlySet<Cell> = new Set<Cell>(["aura", "outline", null]);

/** Add a 1-px outline around every filled pixel (aura sparkles stay free-floating). */
function addOutline(g: Grid) {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (g[y][x] !== null) continue;
      const near = [get(g, x + 1, y), get(g, x - 1, y), get(g, x, y + 1), get(g, x, y - 1)].some((c) => !FREE_FLOATING.has(c));
      if (near) out[y][x] = "outline";
    }
  }
  for (let y = 0; y < GRID_H; y++) g[y] = out[y];
}

function toRuns(g: Grid): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < GRID_H; y++) {
    let x = 0;
    while (x < GRID_W) {
      const role = g[y][x];
      if (role === null) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < GRID_W && g[y][x + w] === role) w++;
      runs.push({ x, y, w, role });
      x += w;
    }
  }
  return runs;
}

// ── Eggs ─────────────────────────────────────────────────────────────────────

function drawEgg(g: Grid, mode: "plain" | "glowing" | "hatching") {
  const cx = 28;
  const cy = 27;
  const top = mode === "hatching" ? 24 : -1;
  const keep = (_x: number, y: number) => y >= top;
  ellipse(g, cx, cy, 7.5, 9.5, "belly", keep);
  ellipse(g, cx + 3.5, cy + 3, 4.5, 6, "bellyShade", (x, y) => x > cx + 1 && keep(x, y));
  if (mode === "hatching") for (let x = 21; x <= 35; x++) if (x % 3 === 0) set(g, x, top - 1, "belly");
  for (const [sx, sy, r] of [
    [25, 22, 1.6],
    [31, 26, 1.3],
    [24, 31, 1.2],
    [30, 33, 1.5],
  ] as const) {
    if (sy >= top) ellipse(g, sx, sy, r, r, "spot");
  }
  if (mode === "glowing") {
    // Element light leaking through zig-zag cracks.
    line(g, [24, 21], [27, 24], "glow");
    line(g, [27, 24], [25, 27], "glow");
    line(g, [25, 27], [29, 30], "glow");
    line(g, [32, 22], [30, 25], "glow");
    line(g, [30, 25], [33, 28], "glow");
  }
}

// ── Dragon ───────────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Body scale: hatchling (stage 3) 0.5 → Eternal (stage 19) 1.0. */
const scaleFor = (stage: number) => 0.5 + ((Math.min(19, stage) - 3) / 16) * 0.5;

interface Frame {
  k: number;
  dx: number;
}

/** Scale around the ground centre, then shift right by dx. */
const sc = (f: Frame, x: number, y: number): Pt => [20 + (x - 20) * f.k + f.dx, GROUND - (GROUND - y) * f.k];

/** Draws the eye; returns the eye pixels so the blink layer can cover them. */
function drawEye(g: Grid, ex: number, ey: number, mood: Mood, fierce: boolean): Pt[] {
  const x = Math.round(ex);
  const y = Math.round(ey);
  const eye: [number, number, PaletteRole][] = [];
  const brow: Pt[] = [];
  if (fierce) {
    if (mood === "restless") eye.push([x, y, "shade"], [x + 1, y, "shade"]);
    else {
      eye.push([x, y, "glow"], [x + 1, y, "glow"]);
      if (mood === "joyful") eye.push([x + 2, y, "glow"]);
    }
    if (mood === "grumpy") brow.push([x - 1, y - 2], [x, y - 1], [x + 1, y - 1], [x + 2, y - 1]);
    else brow.push([x - 1, y - 1], [x, y - 1], [x + 1, y - 1]);
  } else {
    switch (mood) {
      case "joyful":
        eye.push([x - 1, y + 1, "eye"], [x, y, "eye"], [x + 1, y + 1, "eye"]);
        set(g, x - 1, y + 3, "blush");
        set(g, x, y + 3, "blush");
        break;
      case "restless":
        eye.push([x - 1, y + 1, "eye"], [x, y + 1, "eye"], [x + 1, y + 1, "eye"]);
        break;
      case "grumpy":
        eye.push([x, y, "eye"], [x + 1, y, "eye"], [x, y + 1, "eye"], [x + 1, y + 1, "eye"]);
        brow.push([x - 1, y - 2], [x, y - 2], [x + 1, y - 1], [x + 2, y - 1]);
        break;
      default:
        eye.push([x, y, "eyeShine"], [x + 1, y, "eye"], [x, y + 1, "eye"], [x + 1, y + 1, "eye"]);
    }
  }
  for (const [px, py, role] of eye) set(g, px, py, role);
  for (const [px, py] of brow) set(g, px, py, "outline");
  return eye.map(([px, py]) => [px, py]);
}

interface DragonResult {
  wingOrigin: Pt | null;
  mouth: Pt;
  eyes: Pt[];
  head: Pt;
}

function clear(g: Grid, x: number, y: number) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi >= 0 && yi >= 0 && xi < GRID_W && yi < GRID_H) g[yi][xi] = null;
}

/** Wings differ per element: bat, stubby, jagged, fin, feather, tattered or sharp. */
function drawWing(w: Grid, f: Frame, stage: number, plan: BodyPlan, [ax, ay]: Pt): Pt {
  const span = (0.55 + ((stage - UNLOCKS.wings) / (19 - UNLOCKS.wings)) * 0.9) * plan.wingSpan;
  const tipH = 13 * f.k * span;
  const tipW = 11 * f.k * span;
  const back: Pt = [ax - tipW * 0.8, ay - tipH * 0.8];
  const top: Pt = [ax - tipW * 0.12, ay - tipH * 1.1];
  const front: Pt = [ax + tipW * 0.55, ay - tipH * 0.72];
  const anchor: Pt = [ax, ay];
  const R = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];
  const scallop = (a: Pt, b: Pt): Pt => [lerp((a[0] + b[0]) / 2, anchor[0], 0.28), lerp((a[1] + b[1]) / 2, anchor[1], 0.28)];
  const bones = (tips: Pt[]) => {
    for (const tip of tips) line(w, R(anchor), R(tip), "wingShade");
  };

  switch (plan.wing) {
    case "jagged": {
      // Saw-tooth trailing edge like forked lightning.
      const pts: Pt[] = [[ax + 3 * f.k, ay + 1], front];
      const edge = [front, top, back];
      for (let i = 0; i < edge.length - 1; i++) {
        const [a, b] = [edge[i], edge[i + 1]];
        for (const t of [0.33, 0.66]) {
          const p: Pt = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
          const pull = t === 0.33 ? 0.35 : 0.05;
          pts.push([lerp(p[0], anchor[0], pull), lerp(p[1], anchor[1], pull)]);
        }
        pts.push(b);
      }
      pts.push([ax - tipW * 0.4, ay - tipH * 0.2], [ax - 1, ay + 1]);
      polygon(w, pts, "wing");
      bones([back, top, front]);
      set(w, top[0], top[1] - 1, "accent");
      break;
    }
    case "fin": {
      // Rounded fan fin with ribs, like a fish fin.
      const arc: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (1.05 + i * 0.075);
        arc.push([ax + Math.cos(a) * tipW * 0.95, ay + Math.sin(a) * tipH * 0.95]);
      }
      polygon(w, [[ax + 2 * f.k, ay + 1], ...arc.reverse(), [ax - 1, ay + 1]], "wing");
      for (let i = 1; i < 10; i += 2) {
        const a = Math.PI * (1.05 + i * 0.075);
        line(w, R(anchor), R([ax + Math.cos(a) * tipW * 0.85, ay + Math.sin(a) * tipH * 0.85]), "wingShade");
      }
      break;
    }
    case "feather": {
      // Layered long feathers fanning out.
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (1.08 + i * 0.105);
        const len = (0.75 + (i % 2) * 0.2) * Math.max(tipW, tipH) * 1.05;
        const mid: Pt = [ax + Math.cos(a) * len * 0.55, ay + Math.sin(a) * len * 0.55];
        const rot = (px: number, py: number): Pt => [mid[0] + Math.cos(a) * px - Math.sin(a) * py, mid[1] + Math.sin(a) * px + Math.cos(a) * py];
        const hl = Math.max(1.4, len * 0.5);
        const hw = Math.max(1, 1.6 * f.k);
        polygon(w, [rot(-hl, 0), rot(-hl * 0.3, -hw), rot(hl, 0), rot(-hl * 0.3, hw)], i % 2 ? "wing" : "wingShade");
      }
      line(w, R(anchor), R(top), "wingShade");
      break;
    }
    case "sharp": {
      // One angular blade-like wing with two struts.
      const peak: Pt = [ax - tipW * 0.2, ay - tipH * 1.15];
      const rear: Pt = [ax - tipW, ay - tipH * 0.45];
      polygon(w, [[ax + 2 * f.k, ay + 1], [ax + tipW * 0.35, ay - tipH * 0.9], peak, rear, [ax - 1, ay + 1]], "wing");
      bones([peak, rear]);
      set(w, peak[0], peak[1] - 1, "accent");
      break;
    }
    default: {
      // bat / stubby / tattered share the classic scalloped bat wing.
      polygon(w, [[ax + 3 * f.k, ay + 1], front, scallop(front, top), top, scallop(top, back), back, [ax - tipW * 0.4, ay - tipH * 0.2], [ax - 1, ay + 1]], "wing");
      bones([back, top, front]);
      line(w, [Math.round(ax) + 1, Math.round(ay)], [Math.round(top[0]) + 1, Math.round(top[1])], "wingShade");
      set(w, top[0], top[1] - 1, "horn");
      if (plan.wing === "tattered") {
        // Torn holes and ragged edges.
        for (let y = 0; y < GRID_H; y++) {
          for (let x = 0; x < GRID_W; x++) {
            if (w[y][x] !== "wing") continue;
            const edge = !get(w, x, y - 1) || !get(w, x - 1, y);
            if (noise(x, y, 7) < (edge ? 0.35 : 0.12)) clear(w, x, y);
          }
        }
      }
    }
  }
  addOutline(w);
  return [ax, ay];
}

/** Tail body and tip, per style. */
function drawTail(g: Grid, plan: BodyPlan, stage: number, k: number, [tx0, ty0]: Pt, bry: number): void {
  const tailLen = (4 + (stage - 3) * 0.7) * plan.tailLen;
  let tip: Pt = [tx0, ty0];
  let prev: Pt = [tx0, ty0];
  const thin = plan.tail === "barb" || plan.tail === "orb";
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    let x = tx0 - tailLen * t * 0.85;
    let y: number;
    if (plan.tail === "zigzag") {
      const seg = t * 4;
      const zig = (Math.floor(seg) % 2 === 0 ? seg % 1 : 1 - (seg % 1)) - 0.5;
      y = ty0 - t * tailLen * 0.35 + zig * 3 * Math.max(0.8, k);
    } else if (plan.tail === "wave") {
      x = tx0 - tailLen * t * 0.95;
      y = ty0 + Math.sin(t * Math.PI * 2.2) * 2.4 * Math.max(0.7, k) + t * 1.2;
    } else if (plan.tail === "barb") {
      y = ty0 - Math.sin(t * Math.PI * 0.6) * tailLen * 0.25 + t * 2.5;
    } else {
      y = ty0 - Math.sin(t * Math.PI * 0.85) * tailLen * 0.45 + t * 1.5;
    }
    const r = Math.max(thin ? 0.6 : 0.9, bry * 0.42 * (1 - Math.min(1, t * (thin ? 0.95 : 0.8))));
    ellipse(g, x, y, r, r, "body");
    prev = tip;
    tip = [x, y];
  }
  if (stage < UNLOCKS.tailBlade) return;
  const [x, y] = tip;
  const dir = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
  const ahead = (d: number, side = 0): Pt => [x + Math.cos(dir) * d - Math.sin(dir) * side, y + Math.sin(dir) * d + Math.cos(dir) * side];
  switch (plan.tail) {
    case "club":
      ellipse(g, x - 0.5, y, 2.2 * Math.max(1, k * 1.4), 1.9 * Math.max(1, k * 1.3), "horn");
      set(g, x - 2, y - 2, "accent");
      set(g, x + 1, y - 2, "accent");
      break;
    case "zigzag":
      polygon(g, [ahead(-0.5, -1.4), ahead(3.2), ahead(-0.5, 1.4)], "accent");
      break;
    case "wave":
      // Vertical fluke like a fish tail.
      polygon(g, [[x + 0.5, y], [x - 2.5, y - 3.6], [x - 1.2, y], [x - 2.5, y + 3.6]], "wing");
      break;
    case "orb":
      ellipse(g, x - 1, y, 1.9, 1.9, "glow");
      set(g, x - 1.5, y - 0.8, "eyeShine");
      break;
    case "fan":
      for (const s of [-1, 0, 1]) {
        const a = dir + s * 0.55;
        ellipse(g, x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.9, 1, s === 0 ? "wingShade" : "wing");
      }
      break;
    case "barb":
      polygon(g, [ahead(-1, -1.8), ahead(2.6), ahead(-1, 1.8), ahead(0.2)], "horn");
      break;
    case "blade":
      polygon(g, [[x + 0.5, y], [x - 4, y - 3.6], [x - 2.2, y - 0.2], [x - 3.4, y + 2.6]], "accent");
      set(g, x - 2.5, y - 1.5, "eyeShine");
      break;
    default:
      polygon(g, [[x + 0.5, y], [x - 3, y - 2.6], [x - 2.4, y + 1.8]], "accent");
  }
}

/** Decorations along the top of the back. */
function drawBack(g: Grid, plan: BodyPlan, stage: number, bx: number, by: number, brx: number, bry: number) {
  if (stage < UNLOCKS.spines || plan.back === "none") return;
  const topAt = (sx: number) => by - bry * Math.sqrt(Math.max(0, 1 - ((sx - bx) / brx) ** 2)) + 0.5;
  const grow = (stage - UNLOCKS.spines) * 0.15;
  const count = Math.min(7, 3 + Math.floor((stage - UNLOCKS.spines) / 2));
  const at = (i: number, n = count) => bx - brx * 0.75 + ((i + 0.5) / n) * brx * 1.35;
  switch (plan.back) {
    case "plates":
      for (let i = 0; i < count; i++) {
        const sx = at(i);
        ellipse(g, sx, topAt(sx) - 0.4, 1.5 + grow * 0.5, 1.2 + grow * 0.6, i % 2 ? "horn" : "accent");
      }
      break;
    case "fins":
      for (let i = 0; i < count; i++) {
        const sx = at(i);
        const sy = topAt(sx);
        polygon(g, [[sx - 1.4, sy + 0.5], [sx + 1, sy + 0.5], [sx - 1.8, sy - 2.2 - grow]], "wing");
      }
      break;
    case "shards":
      for (let i = 0; i < count + 1; i++) {
        const sx = at(i, count + 1);
        const sy = topAt(sx);
        const h = 1.8 + grow * 1.6 + (i % 2 ? 1.4 : 0);
        polygon(g, [[sx - 0.9, sy], [sx + 0.9, sy], [sx + 0.2, sy - h]], "accent");
        set(g, sx, sy - h * 0.5, "eyeShine");
      }
      break;
    case "ridges":
      for (let i = 0; i < count * 2; i++) {
        const sx = at(i, count * 2);
        set(g, sx, topAt(sx) - 1, "horn");
        if (i % 2 === 0) set(g, sx, topAt(sx) - 2, "horn");
      }
      break;
    case "sail": {
      const crest: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const sx = bx - brx * 0.7 + (i / 8) * brx * 1.3;
        crest.push([sx, topAt(sx) - (2 + grow * 2) * Math.sin((i / 8) * Math.PI)]);
      }
      const base = crest.map(([sx]): Pt => [sx, topAt(sx) + 0.6]).reverse();
      polygon(g, [...crest, ...base], "wing");
      for (let i = 1; i < 8; i += 2) {
        line(g, [Math.round(crest[i][0]), Math.round(topAt(crest[i][0]))], [Math.round(crest[i][0]), Math.round(crest[i][1])], "glow");
      }
      break;
    }
    default: {
      const h = 1.4 + grow;
      for (let i = 0; i < count; i++) {
        const sx = at(i);
        const sy = topAt(sx);
        polygon(g, [[sx - 1.1, sy], [sx + 1.1, sy], [sx - 0.5, sy - h]], "horn");
      }
    }
  }
}

function drawHorns(g: Grid, plan: BodyPlan, stage: number, k: number, hx: number, hy: number, headR: number) {
  if (stage < UNLOCKS.horns) return;
  const L = 2 + (stage - UNLOCKS.horns) * 0.45;
  const twin = stage >= UNLOCKS.twinHorns;
  const w0 = 1.25 * Math.min(1.4, 0.7 + k * 0.6);
  const bases = (twin ? [-0.15, -0.55] : [-0.25]).map((off): Pt => [hx + headR * off, hy - headR * 0.72]);
  for (const base of bases) {
    switch (plan.horns) {
      case "long":
        bezierStroke(g, base, [base[0] - L * 0.6, base[1] - L * 0.55], [base[0] - L * 1.5, base[1] - L * 0.8], w0 * 0.9, 0.45, "horn");
        break;
      case "nubs":
        ellipse(g, base[0], base[1] - 0.6, 1 + L * 0.12, 0.9 + L * 0.12, "horn");
        break;
      case "forward":
        bezierStroke(g, base, [base[0] - L * 0.2, base[1] - L * 1.1], [base[0] + L * 0.75, base[1] - L * 0.9], w0, 0.5, "horn");
        break;
      case "antlers": {
        const tip: Pt = [base[0] - L * 0.5, base[1] - L * 1.2];
        bezierStroke(g, base, [base[0] - L * 0.1, base[1] - L * 0.7], tip, w0 * 0.8, 0.5, "horn");
        const mid: Pt = [lerp(base[0], tip[0], 0.55), lerp(base[1], tip[1], 0.55)];
        line(g, [Math.round(mid[0]), Math.round(mid[1])], [Math.round(mid[0] + L * 0.45), Math.round(mid[1] - L * 0.35)], "horn");
        if (L > 4) line(g, [Math.round(mid[0]), Math.round(mid[1])], [Math.round(mid[0] - L * 0.45), Math.round(mid[1] - L * 0.15)], "horn");
        set(g, tip[0], tip[1] - 1, "glow");
        break;
      }
      case "crystal":
        polygon(g, [[base[0] - 1, base[1] + 0.5], [base[0] + 1, base[1] + 0.5], [base[0] - 0.3, base[1] - L * 1.1]], "accent");
        set(g, base[0] - 0.2, base[1] - L * 0.5, "eyeShine");
        break;
      default:
        bezierStroke(g, base, [base[0] - L * 0.35, base[1] - L * 0.9], [base[0] - L * 1.05, base[1] - L * 0.55], w0, 0.5, "horn");
    }
  }
  if (plan.horns === "crystal" && twin) {
    const c: Pt = [hx - headR * 0.35, hy - headR * 0.85];
    polygon(g, [[c[0] - 0.7, c[1] + 0.5], [c[0] + 0.7, c[1] + 0.5], [c[0], c[1] - L * 0.7]], "accent");
  }
}

function drawDragon(g: Grid, w: Grid, stage: number, mood: Mood, plan: BodyPlan): DragonResult {
  const f: Frame = { k: scaleFor(stage), dx: stage >= UNLOCKS.breath ? 3 : 8 };
  const { k } = f;
  const fierce = stage >= UNLOCKS.fangs;
  const headR = 5.4 * k * (1 + (1 - k) * 0.8) * plan.head;

  const [bx, by] = sc(f, 19, 27 + plan.lift);
  const brx = 9 * k * plan.bodyW;
  const bry = 6.5 * k * plan.bodyH;
  const [hx, hy] = sc(f, 29 + plan.neckX, 16.5 + plan.neckY + plan.lift * 0.6);

  const wingOrigin = stage >= UNLOCKS.wings ? drawWing(w, f, stage, plan, [bx - 1 * k, by - bry * 0.77]) : null;

  drawTail(g, plan, stage, k, [bx - brx * 0.85, by + bry * 0.25], bry);

  // Legs with claws (length follows the body's lift)
  const legW = Math.max(2, Math.round(2.8 * k * plan.legW));
  for (const lx of [bx - brx * 0.45, bx + brx * 0.45]) {
    const x0 = Math.round(lx - legW / 2);
    for (let y = Math.round(by + bry * 0.4); y <= GROUND - 1; y++) for (let x = x0; x < x0 + legW; x++) set(g, x, y, "shade");
    set(g, x0 + legW, GROUND - 1, "horn");
    if (plan.legW > 1.3) set(g, x0 - 1, GROUND - 1, "horn");
  }

  // Body, neck, head, snout
  ellipse(g, bx, by, brx, bry, "body");
  ellipse(g, (bx + hx) / 2 + 1, (by + hy) / 2 + 1, headR * 0.62, Math.max(headR * 0.5, (by - hy) / 2 + 1), "body");
  ellipse(g, hx, hy, headR, headR * 0.92, "body");
  const snoutX = hx + headR * 0.85;
  const snoutY = hy + headR * 0.35;
  ellipse(g, snoutX, snoutY, headR * 0.62 * (fierce ? 1.15 : 1), headR * 0.45, "body");

  // Under-shading, rim light, belly
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (g[y][x] === "body" && y > by + bry * 0.45) g[y][x] = "shade";
  for (let y = 1; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) if (g[y][x] === "body" && g[y - 1][x] === null && y < by) g[y][x] = "highlight";
  }
  const isFlesh = (x: number, y: number) => get(g, x, y) === "body" || get(g, x, y) === "shade";
  ellipse(g, bx + brx * 0.25, by + bry * 0.3, brx * 0.55, bry * 0.55, "belly", isFlesh);
  ellipse(g, (bx + hx) / 2 + 2.2, (by + hy) / 2 + 2, headR * 0.3, Math.max(1, (by - hy) / 2), "belly", (x, y) => get(g, x, y) === "body");
  if (stage >= UNLOCKS.plates) {
    for (let y = Math.round(by - bry * 0.1); y < by + bry * 0.8; y += 2) {
      for (let x = 0; x < GRID_W; x++) if (g[y]?.[x] === "belly") g[y][x] = "bellyShade";
    }
  }

  // Nostril, jaw line and fangs
  set(g, snoutX + headR * 0.35, snoutY - headR * 0.15, "outline");
  if (fierce) {
    const jawY = Math.round(snoutY + headR * 0.2);
    for (let x = Math.round(hx); x <= Math.round(snoutX + headR * 0.5); x++) if (get(g, x, jawY)) set(g, x, jawY, "shade");
    set(g, snoutX + headR * 0.45, snoutY + headR * 0.55, "eyeShine");
    set(g, snoutX - headR * 0.05, snoutY + headR * 0.55, "eyeShine");
  }

  drawHorns(g, plan, stage, k, hx, hy, headR);

  // Crest frill behind the head (water dragons get wider, fin-coloured frills)
  if (stage >= UNLOCKS.crest) {
    const finny = plan.back === "fins";
    for (let i = 0; i < (finny ? 4 : 3); i++) {
      const cx = hx - headR * (0.75 + i * 0.25);
      const cy = hy - headR * (0.1 - i * 0.25);
      polygon(g, [[cx, cy - 1], [cx + 1.4, cy + 1], [cx - 2.4, cy + 0.4]], finny ? "wing" : "accent");
    }
  }

  drawBack(g, plan, stage, bx, by, brx, bry);

  const eyes = drawEye(g, hx + headR * 0.2, hy - headR * 0.25, mood, fierce);

  addOutline(g);

  if (stage >= UNLOCKS.aura) {
    for (const [x, y] of [
      [4, 6],
      [40, 3],
      [6, 30],
      [14, 2],
      [2, 18],
    ] as const) {
      if (g[y][x] === null) for (const [ox, oy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) set(g, x + ox, y + oy, "aura");
    }
  }
  if (stage >= UNLOCKS.crown) {
    const top = Math.round(hy - headR - 1);
    for (let x = Math.round(hx - 2); x <= Math.round(hx + 2); x++) set(g, x, top, "aura");
    for (const dx of [-2, 0, 2]) {
      set(g, hx + dx, top - 1, "aura");
      if (dx === 0) set(g, hx, top - 2, "aura");
    }
  }

  return {
    wingOrigin,
    mouth: [Math.round(snoutX + headR * 0.6), Math.round(snoutY + headR * 0.05)],
    eyes,
    head: [Math.round(hx), Math.round(hy - headR * 0.92 - 1)],
  };
}

// ── Breath attacks ───────────────────────────────────────────────────────────

function drawBreath(b: Grid, element: Element, [mx, my]: Pt, stage: number, mood: Mood) {
  if (mood === "grumpy") {
    // Sulky smoke puffs, whatever the element.
    ellipse(b, mx + 2, my - 2, 1, 1, "breathOuter");
    ellipse(b, mx + 4, my - 4, 1.4, 1.4, "breathOuter");
    ellipse(b, mx + 7, my - 5, 1.8, 1.6, "breathOuter");
    set(b, mx + 4, my - 4, "breathMid");
    return;
  }
  const len = Math.min(GRID_W - 1 - mx, Math.round(3 + (stage - UNLOCKS.breath) * 1.05 + (mood === "joyful" ? 3 : 0)));
  const cone = (spread: number, sparse: number, seed: number) => {
    for (let d = 1; d <= len; d++) {
      const h = 0.8 + d * spread;
      for (let y = Math.floor(my - h - 1); y <= Math.ceil(my + h + 1); y++) {
        const r = Math.abs(y + 0.5 - (my + 0.5)) / h;
        const n = noise(d, y, seed);
        if (r > 1 - n * 0.35 * (d / len)) continue;
        if (n < sparse) continue;
        if (d > len * 0.75 && n > 0.62) continue; // flickering tip
        set(b, mx + d, y, r < 0.33 ? "breathCore" : r < 0.68 ? "breathMid" : "breathOuter");
      }
    }
  };

  switch (element) {
    case "fire":
      cone(0.42, 0, 1);
      break;
    case "plasma":
      cone(0.3, 0, 2);
      for (let d = 4; d <= len; d += 4) {
        const h = Math.round(0.8 + d * 0.3) + 1;
        set(b, mx + d, my - h, "breathOuter");
        set(b, mx + d, my + h, "breathOuter");
      }
      break;
    case "ice":
      cone(0.38, 0.35, 3);
      for (let d = 3; d <= len - 1; d += 3) {
        const off = Math.round((noise(d, 0, 9) - 0.5) * (2 + d * 0.5));
        set(b, mx + d, my + off, "breathCore");
        set(b, mx + d + 1, my + off - 1, "breathCore");
      }
      break;
    case "water":
      for (let d = 1; d <= len; d++) {
        const h = 0.6 + d * 0.1;
        for (let y = Math.floor(my - h); y <= Math.ceil(my + h); y++) {
          const r = Math.abs(y - my) / (h + 0.5);
          set(b, mx + d, y, r < 0.45 ? "breathCore" : r < 0.9 ? "breathMid" : "breathOuter");
        }
        if (d % 3 === 0 && noise(d, 1, 4) > 0.35) set(b, mx + d, my + (noise(d, 2, 4) > 0.5 ? 1 : -1) * Math.round(h + 2), "breathCore");
      }
      break;
    case "air":
      for (let d = 1; d <= len; d++) {
        for (const kk of [-1, 0, 1]) {
          const y = my + kk * (1.2 + d * 0.22) + Math.sin(d * 0.7 + kk * 2) * 1.2;
          set(b, mx + d, y, kk === 0 ? "breathCore" : "breathMid");
          if (d % 2 === 0) set(b, mx + d, y + 1, "breathOuter");
        }
      }
      break;
    case "earth":
      for (let d = 2; d < len; d += 2) {
        const off = (noise(d, 0, 5) - 0.5) * 2 * (1 + d * 0.35);
        const x = mx + d;
        const y = my + off;
        set(b, x, y, "breathCore");
        set(b, x + 1, y, "breathOuter");
        set(b, x, y + 1, "breathOuter");
        set(b, x + 1, y + 1, "breathOuter");
      }
      cone(0.4, 0.78, 6);
      break;
    case "lightning":
      for (const [start, seed] of [
        [0, 7],
        [Math.floor(len / 3), 8],
      ] as const) {
        let y = my;
        for (let d = start + 1; d <= len; d++) {
          const limit = 1 + d * 0.32;
          y += noise(d, seed, seed) > 0.5 ? 1 : -1;
          y = Math.max(my - limit, Math.min(my + limit, y));
          set(b, mx + d, y, "breathCore");
          if (get(b, mx + d, y - 1) === null) set(b, mx + d, y - 1, "breathMid");
          if (noise(d, seed, 3) > 0.7) set(b, mx + d, y + 1, "breathOuter");
        }
      }
      break;
    case "shadow":
      for (let d = 2; d <= len; d += 2) {
        const r = 0.8 + d * 0.18;
        const y = my + (noise(d, 0, 10) - 0.5) * 2;
        ellipse(b, mx + d, y, r, r, "breathOuter");
        ellipse(b, mx + d, y, r * 0.5, r * 0.5, "breathMid");
        if (noise(d, 1, 10) > 0.5) set(b, mx + d, y - r, "breathCore");
      }
      break;
  }
}

// ── Elemental motes ──────────────────────────────────────────────────────────

const MOTE_SHAPES: Record<Element, [number, number, PaletteRole][]> = {
  fire: [[0, 0, "breathCore"], [0, 1, "breathMid"], [1, 1, "breathOuter"]],
  earth: [[0, 0, "breathMid"], [1, 0, "breathOuter"], [0, 1, "breathOuter"], [1, 1, "breathOuter"]],
  lightning: [[0, 0, "breathCore"], [1, 1, "breathMid"], [0, 2, "breathCore"]],
  plasma: [[1, 0, "breathMid"], [0, 1, "breathMid"], [1, 1, "breathCore"], [2, 1, "breathMid"], [1, 2, "breathMid"]],
  water: [[1, 0, "breathMid"], [0, 1, "breathMid"], [1, 1, "breathCore"], [2, 1, "breathMid"], [1, 2, "breathOuter"]],
  ice: [[1, 0, "breathCore"], [0, 1, "breathCore"], [1, 1, "breathMid"], [2, 1, "breathCore"], [1, 2, "breathCore"]],
  air: [[0, 0, "breathMid"], [1, 0, "breathCore"], [2, 1, "breathMid"]],
  shadow: [[0, 0, "breathOuter"], [1, 0, "breathMid"], [1, 1, "breathOuter"], [2, 1, "breathCore"]],
};

const MOTE_SPOTS: readonly Pt[] = [
  [7, 7],
  [44, 6],
  [3, 22],
  [31, 3],
  [15, 13],
  [48, 33],
];

function motes(element: Element, stage: number): Particle[] {
  if (stage < UNLOCKS.motes) return [];
  const count = Math.min(MOTE_SPOTS.length, stage - UNLOCKS.motes + 1);
  return MOTE_SPOTS.slice(0, count).map(([x, y], i) => ({
    runs: MOTE_SHAPES[element].map(([ox, oy, role]) => ({ x: x + ox, y: y + oy, w: 1, role })),
    delay: +(i * 0.55).toFixed(2),
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

function build(stage: number, mood: Mood, element: Element): SpriteLayers {
  const g = makeGrid();
  const w = makeGrid();
  const b = makeGrid();
  let eyes: Pt[] = [];
  let wingOrigin: Pt | null = null;
  let mouth: Pt | null = null;
  let head: Pt = [28, 17];

  if (stage <= 0) {
    drawEgg(g, "plain");
    addOutline(g);
  } else if (stage === 1) {
    drawEgg(g, "glowing");
    addOutline(g);
  } else if (stage === 2) {
    const [hx, hy] = [28, 21];
    head = [hx, Math.round(hy - 4.2 - 1)];
    ellipse(g, hx, hy, 4.6, 4.2, "body");
    ellipse(g, hx + 3.6, hy + 1.4, 2.4, 1.8, "body");
    eyes = drawEye(g, hx + 1, hy - 1.5, mood, false);
    drawEgg(g, "hatching");
    addOutline(g);
  } else {
    const r = drawDragon(g, w, stage, mood, PLANS[element]);
    eyes = r.eyes;
    head = r.head;
    wingOrigin = r.wingOrigin;
    if (stage >= UNLOCKS.breath && mood !== "restless") {
      mouth = r.mouth;
      drawBreath(b, element, r.mouth, stage, mood);
    }
  }

  const lids = eyes
    .filter(([x, y]) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H)
    .map(([x, y]) => ({ x, y, w: 1, role: "body" as const }));

  return { wing: toRuns(w), body: toRuns(g), lids, breath: toRuns(b), motes: motes(element, stage), wingOrigin, mouth, head };
}

const cache = new Map<string, SpriteLayers>();

/** All animation layers for a dragon. Cached; safe to call often. */
export function spriteLayers(stage: number, mood: Mood, element: Element): SpriteLayers {
  const s = Math.min(19, Math.max(0, Math.floor(stage)));
  const key = `${s}:${mood}:${element}`;
  let layers = cache.get(key);
  if (!layers) {
    layers = build(s, mood, element);
    cache.set(key, layers);
  }
  return layers;
}

/** Static body + wing pixels (no breath/motes) — used by tests. */
export function spriteRuns(stage: number, mood: Mood, element: Element = "fire"): Run[] {
  const l = spriteLayers(stage, mood, element);
  return [...l.wing, ...l.body];
}

export function pixelCount(runs: readonly Run[]): number {
  return runs.reduce((n, r) => n + r.w, 0);
}
