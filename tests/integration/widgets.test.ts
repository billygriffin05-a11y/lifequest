import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWidgetFeed } from "@/features/widgets/server/feed";
import { createPrismaClient } from "@/server/db/factory";
import { makeTempDataDir, migrate } from "../support/temp-data-dir";

const { paths, cleanup } = makeTempDataDir("widgets");
let db: ReturnType<typeof createPrismaClient>;
beforeAll(() => {
  migrate(paths);
  db = createPrismaClient(paths.dbFile);
});
afterAll(async () => {
  await db.$disconnect();
  cleanup();
});

describe("widget feed", () => {
  it("summarises the day without Google and without money amounts", async () => {
    await db.transaction.createMany({
      data: ["2026-09-01", "2026-10-01", "2026-11-01"].map((d) => ({ occurredOn: d, amountPence: 65000, description: "Pay rent" })),
    });
    const f = await getWidgetFeed(db, { db, paths, cfg: null, fetchImpl: fetch }, new Date("2026-11-21T12:00:00Z"));
    expect(f.rank).toMatchObject({ title: expect.any(String), level: 1 });
    expect(f.quests.total).toBeGreaterThanOrEqual(0);
    expect(f.events).toEqual([{ day: "2026-12-01", time: null, title: "Pay rent" }]);
    expect(JSON.stringify(f)).not.toMatch(/65000|650\.00|£/);
  });
});
