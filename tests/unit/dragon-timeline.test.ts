import { describe, expect, it } from "vitest";
import { stageTimeline } from "@/features/dragons/timeline";

describe("dragon growth timeline", () => {
  it("dates each stage by the first day cumulative XP reached it", () => {
    const t = stageTimeline([
      { occurredOn: "2026-11-01", xpDelta: 10 },
      { occurredOn: "2026-11-02", xpDelta: 10 }, // 20 → Glowing Egg (15)
      { occurredOn: "2026-11-03", xpDelta: 25 }, // 45 → Hatching (40)
    ]);
    expect(t[0]).toMatchObject({ name: "Egg", reachedOn: "2026-11-01" });
    expect(t[1]).toMatchObject({ name: "Glowing Egg", reachedOn: "2026-11-02" });
    expect(t[2]).toMatchObject({ name: "Hatching", reachedOn: "2026-11-03" });
    expect(t[3].reachedOn).toBeNull();
    expect(t).toHaveLength(20);
  });

  it("undos on the same day net out", () => {
    const t = stageTimeline([
      { occurredOn: "2026-11-01", xpDelta: 20 },
      { occurredOn: "2026-11-01", xpDelta: -20 },
    ]);
    expect(t[1].reachedOn).toBeNull();
  });
});
