import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDragons } from "@/features/dragons/server/service";
import { createAction, getPlayerProgress, logAction } from "@/features/honour/server/service";
import { buyItem, equipItem, getFavouriteDragon, getTreasury, setFavouriteDragon } from "@/features/treasury/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("treasury");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 12));
const NOW = day(19);

describe("gold and the shop", () => {
  it("starts at zero and refuses unaffordable purchases", async () => {
    expect((await getTreasury(db, NOW)).balance).toBe(0);
    await expect(buyItem(db, "party-hat", NOW)).rejects.toThrow(/Not enough gold/);
  });

  it("earns gold from good deeds and buys an item once", async () => {
    const big = await createAction(db, { name: "Marathon", kind: "good", points: 100, icon: "🏃", category: "Fitness" });
    await logAction(db, { actionId: big.id, idempotencyKey: randomUUID() }, day(16));
    const t = await getTreasury(db, NOW);
    expect(t.earned).toBeGreaterThanOrEqual(100);
    await buyItem(db, "party-hat", NOW);
    const after = await getTreasury(db, NOW);
    expect(after.spent).toBe(80);
    expect(after.owned.has("party-hat")).toBe(true);
    await expect(buyItem(db, "party-hat", NOW)).rejects.toThrow(/already own/);
    await expect(buyItem(db, "made-up-item", NOW)).rejects.toThrow();
  });

  it("equips only owned items, and can remove them", async () => {
    await expect(equipItem(db, "fitness", "halo")).rejects.toThrow(/Buy it/);
    await equipItem(db, "fitness", "party-hat");
    expect((await getDragons(db, NOW)).find((d) => d.area.id === "fitness")?.accessory).toBe("party-hat");
    await equipItem(db, "fitness", null);
    expect((await getDragons(db, NOW)).find((d) => d.area.id === "fitness")?.accessory).toBeNull();
  });

  it("remembers a favourite dragon", async () => {
    expect(await getFavouriteDragon(db)).toBeNull();
    await setFavouriteDragon(db, "study");
    expect(await getFavouriteDragon(db)).toBe("study");
    await expect(setFavouriteDragon(db, "nope")).rejects.toThrow();
  });
});

describe("weekly boss", () => {
  it("is damaged by this week's good deeds and defeated at 300 net, paying XP and gold", async () => {
    const hero = await createAction(db, { name: "Epic deed", kind: "good", points: 300, icon: "⚔️", category: "Habits" });
    const before = await getPlayerProgress(db, NOW);
    const goldBefore = (await getTreasury(db, NOW)).earned;
    // Marathon (100) earlier this week + 300 now = 400 ≥ 300.
    await logAction(db, { actionId: hero.id, idempotencyKey: randomUUID() }, NOW);
    const after = await getPlayerProgress(db, NOW);
    expect(after.boss.defeated).toBe(true);
    expect(after.bossWins).toBe(before.bossWins + 1);
    expect(after.bonusXp - before.bonusXp).toBeGreaterThanOrEqual(100);
    expect((await getTreasury(db, NOW)).earned - goldBefore).toBeGreaterThanOrEqual(300 + 50);
  });
});
