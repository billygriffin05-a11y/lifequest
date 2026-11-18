/**
 * Chart colours (data, like the dragon palettes). Series pair validated with
 * the dataviz palette checker against the obsidian-900 surface: inside the dark
 * lightness band, CVD ΔE 12.7 (deutan), contrast ≥ 3:1. Ink/grid mirror the
 * obsidian/silver theme tokens in globals.css.
 */
export const CHART = {
  good: "#1aa58f",
  bad: "#e05a2b",
  grid: "#1f2530",
  ink: "#c8ced8",
  inkStrong: "#eef1f5",
  hair: "#8b93a1",
  surface: "#0d0f12",
} as const;
