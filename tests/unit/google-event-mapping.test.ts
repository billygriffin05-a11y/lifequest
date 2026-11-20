import { describe, expect, it } from "vitest";
import { groupByDay, mapEvent, safeColour } from "@/features/calendar/google/event-mapping";

const FROM = "2026-10-26";
const TO = "2026-12-06";

describe("Google event mapping", () => {
  it("maps an all-day event like 'Pay rent' to its day only (end is exclusive)", () => {
    const out = mapEvent({ id: "rent", summary: "Pay rent", start: { date: "2026-12-01" }, end: { date: "2026-12-02" } }, "Personal", "#7986cb", FROM, TO);
    expect(out).toEqual([
      { id: "rent:2026-12-01", title: "Pay rent", calendar: "Personal", colour: "#7986cb", day: "2026-12-01", allDay: true, start: null, end: null },
    ]);
  });

  it("spreads multi-day all-day events and clips to the range", () => {
    const out = mapEvent({ id: "h", summary: "Holiday", start: { date: "2026-12-05" }, end: { date: "2026-12-09" } }, "P", null, FROM, TO);
    expect(out.map((e) => e.day)).toEqual(["2026-12-05", "2026-12-06"]);
  });

  it("shows timed events in London time, including across BST", () => {
    const winter = mapEvent({ id: "a", summary: "Gym", start: { dateTime: "2026-11-20T18:00:00Z" }, end: { dateTime: "2026-11-20T19:00:00Z" } }, "P", null, FROM, TO);
    expect(winter[0]).toMatchObject({ day: "2026-11-20", start: "18:00", end: "19:00", allDay: false });
    const summer = mapEvent({ id: "b", summary: "BBQ", start: { dateTime: "2026-07-01T17:00:00Z" }, end: { dateTime: "2026-07-01T18:00:00Z" } }, "P", null, "2026-07-01", "2026-07-01");
    expect(summer[0]).toMatchObject({ start: "18:00", end: "19:00" });
  });

  it("handles late-night events that cross midnight, but not ones ending at midnight", () => {
    const late = mapEvent({ id: "c", summary: "Party", start: { dateTime: "2026-11-20T22:00:00Z" }, end: { dateTime: "2026-11-21T01:00:00Z" } }, "P", null, FROM, TO);
    expect(late.map((e) => [e.day, e.start, e.end])).toEqual([
      ["2026-11-20", "22:00", null],
      ["2026-11-21", null, "01:00"],
    ]);
    const toMidnight = mapEvent({ id: "m", summary: "Late", start: { dateTime: "2026-11-20T23:00:00Z" }, end: { dateTime: "2026-11-21T00:00:00Z" } }, "P", null, FROM, TO);
    expect(toMidnight.map((e) => e.day)).toEqual(["2026-11-20"]);
  });

  it("skips cancelled events and names untitled ones", () => {
    expect(mapEvent({ id: "x", status: "cancelled", start: { date: "2026-11-20" } }, "P", null, FROM, TO)).toEqual([]);
    expect(mapEvent({ id: "y", start: { date: "2026-11-20" } }, "P", null, FROM, TO)[0].title).toBe("(No title)");
  });

  it("only accepts real hex colours", () => {
    expect(safeColour("#a1b2c3")).toBe("#a1b2c3");
    expect(safeColour("red; background:url(x)")).toBeNull();
    expect(safeColour(undefined)).toBeNull();
  });

  it("groups by day with all-day first then by time", () => {
    const g = groupByDay([
      ...mapEvent({ id: "1", summary: "Late", start: { dateTime: "2026-11-20T20:00:00Z" } }, "P", null, FROM, TO),
      ...mapEvent({ id: "2", summary: "Early", start: { dateTime: "2026-11-20T08:00:00Z" } }, "P", null, FROM, TO),
      ...mapEvent({ id: "3", summary: "Rent", start: { date: "2026-11-20" } }, "P", null, FROM, TO),
    ]);
    expect(g.get("2026-11-20")?.map((e) => e.title)).toEqual(["Rent", "Early", "Late"]);
  });
});
