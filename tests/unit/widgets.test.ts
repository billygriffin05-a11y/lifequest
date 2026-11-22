import { describe, expect, it } from "vitest";
import { scriptableScript } from "@/features/widgets/scriptable";

describe("Scriptable widget script", () => {
  const script = scriptableScript("https://desktop.example.ts.net/");
  it("points at this app's feed", () => {
    expect(script).toContain('const FEED = "https://desktop.example.ts.net/api/widget";');
    expect(script).toContain('const APP = "https://desktop.example.ts.net";');
  });
  it("is valid JavaScript (compiled, not run)", () => {
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...a: string[]) => unknown;
    expect(() => new AsyncFunction("args", "config", "Request", "ListWidget", "Color", "Font", "Script", script)).not.toThrow();
  });
  it("supports every home and lock screen size", () => {
    for (const f of ["accessoryInline", "accessoryCircular", "accessoryRectangular", '"small"', '"large"']) expect(script).toContain(f);
  });
});
