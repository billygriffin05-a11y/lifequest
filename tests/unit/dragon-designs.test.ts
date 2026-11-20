import { describe, expect, it } from "vitest";
import type { Element } from "@/features/dragons/areas";
import { PLANS } from "@/features/dragons/body-plans";
import { spriteLayers, type Run } from "@/features/dragons/sprite";

const ELEMENTS = Object.keys(PLANS) as Element[];

/** Which pixels are filled, ignoring colour — the dragon's silhouette. */
function silhouette(runs: readonly Run[]): Set<string> {
  const s = new Set<string>();
  for (const r of runs) for (let x = r.x; x < r.x + r.w; x++) s.add(`${x},${r.y}`);
  return s;
}

function shape(element: Element, stage: number) {
  const l = spriteLayers(stage, "content", element);
  return silhouette([...l.wing, ...l.body]);
}

/** Share of pixels that differ between two silhouettes (0 = identical, 1 = nothing shared). */
function difference(a: Set<string>, b: Set<string>): number {
  let same = 0;
  for (const p of a) if (b.has(p)) same++;
  return 1 - same / Math.max(a.size, b.size);
}

describe("each element has its own dragon design", () => {
  it("has a body plan with a description for every element", () => {
    expect(ELEMENTS).toHaveLength(8);
    for (const e of ELEMENTS) expect(PLANS[e].look.length).toBeGreaterThan(10);
  });

  it("uses a different tail on every element", () => {
    expect(new Set(ELEMENTS.map((e) => PLANS[e].tail)).size).toBe(ELEMENTS.length);
  });

  it("gives every adult dragon a clearly different silhouette, not just a recolour", () => {
    for (let i = 0; i < ELEMENTS.length; i++) {
      for (let j = i + 1; j < ELEMENTS.length; j++) {
        const d = difference(shape(ELEMENTS[i], 19), shape(ELEMENTS[j], 19));
        expect(d, `${ELEMENTS[i]} vs ${ELEMENTS[j]}`).toBeGreaterThan(0.15);
      }
    }
  });

  it("already differs as a young dragon (before wings)", () => {
    expect(difference(shape("earth", 5), shape("air", 5))).toBeGreaterThan(0.1);
  });

  it("is deterministic", () => {
    expect([...shape("shadow", 14)]).toEqual([...shape("shadow", 14)]);
  });
});
