/**
 * The eight life areas, each with its own dragon and pixel-art palette.
 * Palette values are art data (sprite colours), not UI styling tokens.
 */
export type PaletteRole =
  | "outline"
  | "body"
  | "shade"
  | "belly"
  | "bellyShade"
  | "wing"
  | "wingShade"
  | "accent"
  | "eye"
  | "eyeShine"
  | "spot"
  | "blush"
  | "aura";

export type Palette = Record<PaletteRole, string>;

export interface Area {
  id: string;
  /** Matches the Honour action category (case-insensitive). */
  name: string;
  dragonName: string;
  palette: Palette;
}

const shared = { eye: "#0b0c10", eyeShine: "#ffffff", blush: "#ff9db0", aura: "#ffe68a" } as const;

export const AREAS: readonly Area[] = [
  {
    id: "fitness",
    name: "Fitness",
    dragonName: "Emberclaw",
    palette: { ...shared, outline: "#3a120e", body: "#e0533f", shade: "#a8352a", belly: "#ffd29a", bellyShade: "#e6a964", wing: "#ff9a5c", wingShade: "#c8613a", accent: "#ffd34d", spot: "#e0533f" },
  },
  {
    id: "nutrition",
    name: "Nutrition",
    dragonName: "Verdantfang",
    palette: { ...shared, outline: "#11300f", body: "#4fb548", shade: "#347d31", belly: "#e3f5b0", bellyShade: "#b9d77a", wing: "#93dc6c", wingShade: "#5ea245", accent: "#ffcf4a", spot: "#4fb548" },
  },
  {
    id: "finance",
    name: "Finance",
    dragonName: "Aurumscale",
    palette: { ...shared, outline: "#3b2a06", body: "#e7b53a", shade: "#a8811e", belly: "#fff1b8", bellyShade: "#e3cc7c", wing: "#f6dc8a", wingShade: "#c19b3c", accent: "#19c38c", spot: "#e7b53a" },
  },
  {
    id: "study",
    name: "Study",
    dragonName: "Runewing",
    palette: { ...shared, outline: "#1d1240", body: "#8261e6", shade: "#5a40b4", belly: "#e0d6fb", bellyShade: "#b3a3ea", wing: "#ad93f4", wingShade: "#7a5fd0", accent: "#6ff0bd", spot: "#8261e6" },
  },
  {
    id: "reading",
    name: "Reading",
    dragonName: "Inkwyrm",
    palette: { ...shared, outline: "#0d1b3d", body: "#3f72dd", shade: "#2a4ea1", belly: "#cfe0fd", bellyShade: "#93b2e8", wing: "#7da7f3", wingShade: "#4a75c4", accent: "#f6db8d", spot: "#3f72dd" },
  },
  {
    id: "sleep",
    name: "Sleep",
    dragonName: "Moonveil",
    palette: { ...shared, outline: "#1b1d3a", body: "#8e96cf", shade: "#636ba5", belly: "#eceef9", bellyShade: "#c3c7e6", wing: "#bac0ea", wingShade: "#8a91c8", accent: "#f6db8d", spot: "#8e96cf" },
  },
  {
    id: "habits",
    name: "Habits",
    dragonName: "Jadeheart",
    palette: { ...shared, outline: "#032a1e", body: "#15bd85", shade: "#0a7f59", belly: "#cdf7e5", bellyShade: "#8fdcbc", wing: "#43d8a1", wingShade: "#159a6c", accent: "#ffcf4a", spot: "#15bd85" },
  },
  {
    id: "other",
    name: "Other",
    dragonName: "Ashsilver",
    palette: { ...shared, outline: "#1c1f26", body: "#9199a8", shade: "#646b78", belly: "#f1f3f7", bellyShade: "#c9ced8", wing: "#cdd2dc", wingShade: "#959cab", accent: "#d4ac2e", spot: "#9199a8" },
  },
];

const OTHER = AREAS[AREAS.length - 1];

/** Map a free-text action category to its area; unknown categories feed "Other". */
export function areaForCategory(category: string): Area {
  const key = category.trim().toLowerCase();
  return AREAS.find((a) => a.name.toLowerCase() === key) ?? OTHER;
}
