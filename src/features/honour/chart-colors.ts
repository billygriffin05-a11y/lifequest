/**
 * Chart colours (data, like the dragon palettes). Series pair validated with
 * the dataviz palette checker against the obsidian-900 surface: inside the dark
 * lightness band, CVD ΔE 12.7 (deutan), contrast ≥ 3:1. Ink/grid mirror the
 * obsidian/silver theme tokens (futuristic palette) in globals.css.
 */
export const CHART = {
  good: "#1aa58f",
  bad: "#e05a2b",
  grid: "#1a2742",
  ink: "#b9c8e2",
  inkStrong: "#e8f1ff",
  hair: "#7f90b4",
  surface: "#0a0f1c",
} as const;
