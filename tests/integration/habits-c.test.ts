import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getRecurring, addTransaction } from "@/features/finance/server/service";
import { addCard, examPaper, listExams, reviewCard, saveExam } from "@/features/mind/server/service";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("habits-c");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

describe("FSRS reviews", () => {
  it("stores memory state and the grade; old true/false still works", async () => {
    const c = await addCard(db, { front: "What is MFA?", back: "Two or more factor types.", topic: "1 · General" }, "2026-11-21");
    const r = await reviewCard(db, c.id, 3, "2026-11-21");
    const row = await db.flashcard.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.stability).toBeGreaterThan(0);
    expect(row.lastReviewOn).toBe("2026-11-21");
    expect(r.dueOn > "2026-11-21").toBe(true);
    expect((await db.cardReview.findFirstOrThrow({ where: { cardId: c.id } })).grade).toBe(3);
    await expect(reviewCard(db, c.id, false, "2026-11-21")).rejects.toThrow(/isn't due/);
  });
});

describe("mock exam", () => {
  it("saves an attempt using topics from the database", async () => {
    const paper = await examPaper(db, 7);
    expect(paper.length).toBeGreaterThan(0);
    await saveExam(db, paper.map((q) => ({ cardId: q.id, correct: true })), 120, "2026-11-21");
    const [last] = await listExams(db);
    expect(last).toMatchObject({ total: paper.length, correct: paper.length, byTopic: [{ topic: "1 · General", total: 1, correct: 1 }] });
    await expect(saveExam(db, [{ cardId: "nope", correct: true }], 10, "2026-11-21")).rejects.toThrow(/No answers/);
    await expect(saveExam(db, [], 10, "2026-11-21")).rejects.toThrow();
  });
});

describe("recurring payments", () => {
  it("detects a monthly bill from transactions", async () => {
    for (const d of ["2026-09-01", "2026-10-01", "2026-11-01"]) {
      await addTransaction(db, { occurredOn: d, amountPence: 65000, description: "Pay rent", categoryId: null });
    }
    const r = await getRecurring(db, "2026-11-21");
    expect(r).toEqual([expect.objectContaining({ payee: "Pay rent", cadence: "monthly", nextOn: "2026-12-01", yearlyPence: 780000 })]);
  });
});
