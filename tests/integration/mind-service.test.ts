import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStreakBonusByCategory } from "@/features/honour/server/service";
import {
  addBook,
  addCard,
  getCardStats,
  getFocusStats,
  getMindRewards,
  getReflections,
  listBooks,
  logFocus,
  logPages,
  reviewCard,
  saveReflection,
  seedStarterDeck,
} from "@/features/mind/server/service";
import { STARTER_DECK } from "@/features/mind/starter-deck";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("mind");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const TODAY = "2026-11-19";

describe("mind service", () => {
  it("tracks a book to the finish, capping pages", async () => {
    const b = await addBook(db, { title: "Dune", author: "Frank Herbert", totalPages: 100 });
    expect((await logPages(db, b.id, 60, "2026-11-18")).finished).toBe(false);
    expect((await logPages(db, b.id, 60, TODAY)).finished).toBe(true);
    const [book] = await listBooks(db);
    expect(book).toMatchObject({ pagesRead: 100, percent: 100, finishedOn: TODAY });
    await expect(logPages(db, b.id, 5, TODAY)).rejects.toThrow(/already finished/);
    await expect(addBook(db, { title: "", author: "", totalPages: 10 })).rejects.toThrow();
  });

  it("seeds the starter deck once and reviews with spaced repetition", async () => {
    expect(await seedStarterDeck(db, TODAY)).toBe(STARTER_DECK.length);
    expect(await seedStarterDeck(db, TODAY)).toBe(0);
    const own = await addCard(db, { front: "What is a WAF?", back: "Web application firewall", topic: "" }, TODAY);
    let stats = await getCardStats(db, TODAY);
    expect(stats.due.length).toBe(STARTER_DECK.length + 1);

    expect(await reviewCard(db, own.id, true, TODAY)).toEqual({ box: 2, dueOn: "2026-11-21" });
    await expect(reviewCard(db, own.id, true, TODAY)).rejects.toThrow(/isn't due/);
    for (const c of stats.due.filter((c) => c.id !== own.id).slice(0, 9)) await reviewCard(db, c.id, false, TODAY);

    stats = await getCardStats(db, TODAY);
    expect(stats.reviewedToday).toBe(10);
    expect(stats.correctToday).toBe(1);
    expect(stats.byBox[1]).toBe(1);
  });

  it("saves one reflection per day with mood validation", async () => {
    await saveReflection(db, TODAY, 4, "Good gym session.");
    await saveReflection(db, TODAY, 5, "Even better.");
    await saveReflection(db, "2026-11-18", 2, "");
    await expect(saveReflection(db, TODAY, 7, "")).rejects.toThrow(/1 to 5/);
    const r = await getReflections(db, TODAY);
    expect(r.today).toMatchObject({ mood: 5, entry: "Even better." });
    expect(r.series).toHaveLength(14);
    expect(r.average).toBe(3.5);
    expect(r.entries).toHaveLength(1);
  });

  it("logs focus sessions with allowed lengths only", async () => {
    await logFocus(db, TODAY, 25, "Domain 2");
    await logFocus(db, TODAY, 25, "");
    await expect(logFocus(db, TODAY, 7, "")).rejects.toThrow(/length/);
    expect((await getFocusStats(db, TODAY)).todayMinutes).toBe(50);
  });

  it("feeds Reading, Study and Habits dragons", async () => {
    const r = await getMindRewards(db);
    expect(r.get("Reading")).toBe(2 * 5 + 50);
    expect(r.get("Study")).toBe(5 + 2 * 5); // 10 reviews today + 50 focus minutes
    expect(r.get("Habits")).toBe(3);
    const bonus = await getStreakBonusByCategory(db, new Date(`${TODAY}T12:00:00Z`));
    expect(bonus.get("Reading")).toBeGreaterThanOrEqual(60);
  });
});
