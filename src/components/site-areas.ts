import type { IconName } from "@/components/ui/pixel-icon";

export interface SiteArea {
  href: string;
  icon: IconName;
  label: string;
}

/** Every main area of the app, in menu order. Shared by the home tabs and the ☰ menu. */
export const AREAS: readonly SiteArea[] = [
  { href: "/honour", icon: "honour", label: "Honour" },
  { href: "/dragons", icon: "dragons", label: "Dragons" },
  { href: "/money", icon: "money", label: "Money" },
  { href: "/body", icon: "body", label: "Body" },
  { href: "/mind", icon: "mind", label: "Mind" },
  { href: "/report", icon: "report", label: "Weekly report" },
  { href: "/shop", icon: "shop", label: "Shop" },
  { href: "/achievements", icon: "achievements", label: "Achievements" },
  { href: "/calendar", icon: "calendar", label: "Calendar" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

/** Extra pages that only appear in the ☰ menu. */
export const MORE_AREAS: readonly SiteArea[] = [
  { href: "/search", icon: "search", label: "Search" },
  { href: "/honour/history", icon: "heatmap", label: "Habit heatmap" },
  { href: "/mind/cards", icon: "mind", label: "Security+ cards" },
  { href: "/dragons/gallery", icon: "dragons", label: "Dragon gallery" },
];
