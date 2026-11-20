import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addTransaction } from "@/features/finance/server/service";
import { createAction, listActions, logAction, moveAction, setEntryNote } from "@/features/honour/server/service";
import { addBook, saveReflection } from "@/features/mind/server/service";
import { getWeeklyReport } from "@/features/report/server/service";
import { normaliseQuery, search } from "@/features/search/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("batch6");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

const at = (d: number) => new Date(Date.UTC(2026, 10, d, 12));

describe("reorder actions", () => {
  it("moves an action up and down, stopping at the ends", async () => {
    const a = await createAction(db, { name: "Alpha", kind: "good", points: 5, icon: "🅰️", category: "Habits" });
    const b = await createAction(db, { name: "Bravo", kind: "good", points: 5, icon: "🅱️", category: "Habits" });
    const c = await createAction(db, { name: "Charlie", kind: "bad", points: 5, icon: "©️", category: "Habits" });
    const names = async () => (await listActions(db)).map((x) => x.name);
    expect(await names()).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(await moveAction(db, c.id, "up")).toBe(true);
    expect(await names()).toEqual(["Alpha", "Charlie", "Bravo"]);
    expect(await moveAction(db, a.id, "up")).toBe(false);
    await moveAction(db, a.id, "down");
    expect(await names()).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(await moveAction(db, b.id, "down")).toBe(false);
    await expect(moveAction(db, "nope", "up")).rejects.toThrow();
  });
});

describe("search", () => {
  it("finds things across areas, case-insensitively", async () => {
    const alpha = (await listActions(db)).find((a) => a.name === "Alpha")!;
    const entry = await logAction(db, { actionId: alpha.id, idempotencyKey: randomUUID() }, at(17));
    await setEntryNote(db, entry.id, "Dragonfire training");
    await addTransaction(db, { occurredOn: "2026-11-17", amountPence: 1250, description: "DRAGON TAVERN", categoryId: null });
    await addBook(db, { title: "The Dragon Book", author: "A. Writer", totalPages: 100 });
    await saveReflection(db, "2026-11-17", 4, "Thought about dragons all day.");

    const hits = await search(db, "dragon");
    expect(new Set(hits.map((h) => h.kind))).toEqual(new Set(["deeds", "money", "books", "journal"]));
    expect(hits.find((h) => h.kind === "money")).toMatchObject({ href: "/money?m=2026-11", detail: "−£12.50" });
    expect(await search(db, "d")).toEqual([]);
    expect(await search(db, "dragon", ["books"])).toHaveLength(1);
    expect(normaliseQuery("  two   words ")).toBe("two words");
    expect(normaliseQuery(["x"])).toBe("");
  });
});

describe("weekly report", () => {
  it("rolls up the week", async () => {
    const r = await getWeeklyReport(db, "2026-11-16");
    expect(r.weekEnd).toBe("2026-11-22");
    expect(r.honour.goodDeeds).toBe(1);
    expect(r.money.spentPence).toBe(1250);
    expect(r.mind).toMatchObject({ moodAvg: 4, journalDays: 1 });
    const empty = await getWeeklyReport(db, "2026-11-09");
    expect(empty.honour.goodDeeds).toBe(0);
    expect(empty.body.sleepAvgMinutes).toBeNull();
  });
});
