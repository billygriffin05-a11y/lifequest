/**
 * The eight life areas, each raising an elemental dragon with its own
 * pixel-art palette and breath attack. Palette values are art data (sprite
 * colours), not UI styling tokens.
 */
export type PaletteRole =
  | "outline"
  | "body"
  | "shade"
  | "highlight"
  | "belly"
  | "bellyShade"
  | "wing"
  | "wingShade"
  | "horn"
  | "accent"
  | "eye"
  | "eyeShine"
  | "glow"
  | "spot"
  | "blush"
  | "aura"
  | "breathCore"
  | "breathMid"
  | "breathOuter";

export type Palette = Record<PaletteRole, string>;

export type Element = "fire" | "earth" | "lightning" | "plasma" | "water" | "ice" | "air" | "shadow";

export interface Area {
  id: string;
  /** Matches the Honour action category (case-insensitive). */
  name: string;
  dragonName: string;
  element: Element;
  elementName: string;
  palette: Palette;
}

const shared = { eye: "#0b0c10", eyeShine: "#ffffff", blush: "#ff9db0", aura: "#ffe68a" } as const;

export const AREAS: readonly Area[] = [
  {
    id: "fitness",
    name: "Fitness",
    dragonName: "Emberclaw",
    element: "fire",
    elementName: "Fire",
    palette: {
      ...shared,
      outline: "#2a0b07", body: "#b8332a", shade: "#7a1e18", highlight: "#e8604a", belly: "#f2a65a", bellyShade: "#c97a34",
      wing: "#d9532c", wingShade: "#5e160f", horn: "#ead9b8", accent: "#ffcf4a", glow: "#ffd34d", spot: "#b8332a",
      breathCore: "#fff3b0", breathMid: "#ffb43a", breathOuter: "#e5482a",
    },
  },
  {
    id: "nutrition",
    name: "Nutrition",
    dragonName: "Thornback",
    element: "earth",
    elementName: "Earth",
    palette: {
      ...shared,
      outline: "#141a08", body: "#5e7f32", shade: "#3d5520", highlight: "#8fb052", belly: "#cdb98a", bellyShade: "#a08c5e",
      wing: "#7d6243", wingShade: "#3e2e1c", horn: "#b5aa9c", accent: "#9fc25a", glow: "#ffcf4a", spot: "#5e7f32",
      breathCore: "#e3d6a8", breathMid: "#a3b86c", breathOuter: "#7a5c3a",
    },
  },
  {
    id: "finance",
    name: "Finance",
    dragonName: "Stormhoard",
    element: "lightning",
    elementName: "Lightning",
    palette: {
      ...shared,
      outline: "#1e1606", body: "#d9a92e", shade: "#94701a", highlight: "#f6d36a", belly: "#fff1b8", bellyShade: "#dcc278",
      wing: "#3b4170", wingShade: "#1c2040", horn: "#fff8dc", accent: "#8fc4ff", glow: "#ffffff", spot: "#d9a92e",
      breathCore: "#ffffff", breathMid: "#fff27a", breathOuter: "#7fb6ff",
    },
  },
  {
    id: "study",
    name: "Study",
    dragonName: "Arcflare",
    element: "plasma",
    elementName: "Plasma",
    palette: {
      ...shared,
      outline: "#140728", body: "#6b2fb3", shade: "#45207a", highlight: "#9a5ae0", belly: "#e0a8ff", bellyShade: "#b679dc",
      wing: "#c23fd9", wingShade: "#5c1470", horn: "#7af3ff", accent: "#6ff0ff", glow: "#ff7af0", spot: "#6b2fb3",
      breathCore: "#ffffff", breathMid: "#ff7af0", breathOuter: "#8a5cff",
    },
  },
  {
    id: "reading",
    name: "Reading",
    dragonName: "Tidewyrm",
    element: "water",
    elementName: "Water",
    palette: {
      ...shared,
      outline: "#06172e", body: "#2f6fbf", shade: "#1f4a85", highlight: "#5c9be0", belly: "#9fd8f0", bellyShade: "#6fb0d0",
      wing: "#3fa3d9", wingShade: "#123a66", horn: "#e8f4ff", accent: "#7ff0ff", glow: "#7ff0ff", spot: "#2f6fbf",
      breathCore: "#e8fbff", breathMid: "#6fd6ff", breathOuter: "#2a7fd4",
    },
  },
  {
    id: "sleep",
    name: "Sleep",
    dragonName: "Frostveil",
    element: "ice",
    elementName: "Ice",
    palette: {
      ...shared,
      outline: "#16283c", body: "#8fc3e3", shade: "#5f8fb3", highlight: "#cdeaff", belly: "#eef9ff", bellyShade: "#bcdcef",
      wing: "#bfe6fb", wingShade: "#4f7aa0", horn: "#ffffff", accent: "#ffffff", glow: "#5fe3ff", spot: "#8fc3e3",
      breathCore: "#ffffff", breathMid: "#bfefff", breathOuter: "#7cc9f0",
    },
  },
  {
    id: "habits",
    name: "Habits",
    dragonName: "Galewing",
    element: "air",
    elementName: "Air",
    palette: {
      ...shared,
      outline: "#0d2624", body: "#9cc7c0", shade: "#6c9a93", highlight: "#d6efeb", belly: "#f4fbfa", bellyShade: "#c9e3df",
      wing: "#dff3ef", wingShade: "#5f8f88", horn: "#ffffff", accent: "#5fe0cb", glow: "#2fe0c0", spot: "#9cc7c0",
      breathCore: "#ffffff", breathMid: "#d6f5ef", breathOuter: "#8fd9cc",
    },
  },
  {
    id: "other",
    name: "Other",
    dragonName: "Duskshade",
    element: "shadow",
    elementName: "Shadow",
    palette: {
      ...shared,
      outline: "#07060a", body: "#544870", shade: "#352c47", highlight: "#7e70a3", belly: "#8f82a8", bellyShade: "#6a5e82",
      wing: "#3b3150", wingShade: "#1a1424", horn: "#d4c6f0", accent: "#b44dff", glow: "#d070ff", spot: "#544870",
      breathCore: "#d070ff", breathMid: "#7b6a98", breathOuter: "#463c5a",
    },
  },
];

const OTHER = AREAS[AREAS.length - 1];

/** Map a free-text action category to its area; unknown categories feed "Other". */
export function areaForCategory(category: string): Area {
  const key = category.trim().toLowerCase();
  return AREAS.find((a) => a.name.toLowerCase() === key) ?? OTHER;
}
