/**
 * Chart colours (data, like the dragon palettes). Series pair validated with
 * the dataviz palette checker against the obsidian-900 surface: inside the dark
 * lightness band, CVD ΔE 12.7 (deutan), contrast ≥ 3:1. Ink/grid mirror the
 * obsidian/silver theme tokens (futuristic palette) in globals.css.
 */
export const CHART = {
  good: "#1aa58f",
  bad: "#e05a2b",
  grid: "#2c1a59",
  ink: "#cdc2f0",
  inkStrong: "#f3edff",
  hair: "#9387c4",
  surface: "#150b29",
} as const;
