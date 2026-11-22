/**
 * Seasons (UK, meteorological): each has a festival and a limited cosmetic
 * that can only be bought while it's running. Pure. Tests: tests/unit/habits-b.test.ts
 */
export type Season = "winter" | "spring" | "summer" | "autumn";

export const SEASONS: Record<Season, { festival: string; icon: string; months: readonly number[] }> = {
  winter: { festival: "Frost Festival", icon: "❄️", months: [12, 1, 2] },
  spring: { festival: "Bloom Trial", icon: "🌸", months: [3, 4, 5] },
  summer: { festival: "Sun Tournament", icon: "☀️", months: [6, 7, 8] },
  autumn: { festival: "Harvest Hunt", icon: "🍂", months: [9, 10, 11] },
};

export function seasonFor(dayKey: string): Season {
  const m = Number(dayKey.slice(5, 7));
  return (Object.keys(SEASONS) as Season[]).find((s) => SEASONS[s].months.includes(m))!;
}

/** Last day (YYYY-MM-DD) of the season containing `dayKey`. */
export function seasonEnds(dayKey: string): string {
  const y = Number(dayKey.slice(0, 4));
  const m = Number(dayKey.slice(5, 7));
  const lastMonth = SEASONS[seasonFor(dayKey)].months[2];
  const year = lastMonth < m ? y + 1 : y; // winter wraps into next year
  const last = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  return `${year}-${String(lastMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}
