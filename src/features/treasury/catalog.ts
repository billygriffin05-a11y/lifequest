/**
 * Treasure shop catalogue: pixel-art cosmetics for dragons.
 * `pixels` rows are drawn centred on top of the dragon's head (bottom row
 * sits just above the head). Letters map to `COLOURS`; "." is transparent.
 * `lift` raises the item further (e.g. a floating halo).
 */
export const COLOURS: Record<string, string> = {
  g: "#ffcf4a", // gold
  G: "#c99a1a", // dark gold
  r: "#e5482a", // ruby
  b: "#3f72dd", // sapphire
  p: "#7d4fc9", // purple
  y: "#fff1a8", // pale star
  k: "#1b1b22", // black
  w: "#f2efe6", // bone white
  s: "#b8c0cc", // steel
  P: "#ff8fc2", // pink
  L: "#4fb548", // leaf
  o: "#ff9a3c", // orange
};

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  description: string;
  pixels: readonly string[];
  lift?: number;
}

export const CATALOG: readonly ShopItem[] = [
  { id: "party-hat", name: "Party Hat", icon: "🥳", price: 80, description: "For every small victory.", pixels: ["..r..", ".rbr.", "rbrbr"] },
  { id: "flower-crown", name: "Flower Crown", icon: "🌸", price: 90, description: "A crown of spring blossoms.", pixels: ["PyPyP", "LLLLL"] },
  { id: "royal-crown", name: "Royal Crown", icon: "👑", price: 120, description: "Gold and gems, fit for a dragon king.", pixels: ["g.g.g", "ggggg", "grgbg"] },
  { id: "wizard-hat", name: "Wizard Hat", icon: "🧙", price: 150, description: "Spellcraft for study dragons.", pixels: ["...p...", "..ppp..", "..pyp..", ".ppppp.", "ppppppp"] },
  { id: "pirate-hat", name: "Pirate Hat", icon: "🏴‍☠️", price: 150, description: "Plunder bad habits.", pixels: ["..kkk..", ".kkwkk.", "kkkkkkk"] },
  { id: "viking-helm", name: "Viking Helm", icon: "🪖", price: 180, description: "Horned steel for battle.", pixels: ["w.....w", "w.sss.w", ".sssss."] },
  { id: "halo", name: "Halo", icon: "😇", price: 200, description: "A glowing ring of pure Honour.", pixels: [".yyyy.", "y....y", ".yyyy."], lift: 2 },
  { id: "flame-crest", name: "Flame Crest", icon: "🔥", price: 220, description: "A living crown of fire.", pixels: [".o.o.o.", "oroooro", ".rrrrr."] },
];

export function itemById(id: string | null | undefined): ShopItem | undefined {
  return CATALOG.find((i) => i.id === id);
}
