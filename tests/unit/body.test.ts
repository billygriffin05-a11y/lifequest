import { describe, expect, it } from "vitest";
import {
  bodyXp,
  formatDuration,
  formatHours,
  formatKg,
  formatPace,
  liftPbs,
  paceSecondsPerKm,
  parseDuration,
  parseKg,
  parseKm,
  runPbs,
  sleepMinutes,
} from "@/features/body/rules";

describe("body parsing", () => {
  it("parses kg to grams", () => {
    expect(parseKg("80")).toBe(80000);
    expect(parseKg("62.5")).toBe(62500);
    expect(parseKg("80.45")).toBe(80450);
    expect(parseKg("80.456")).toBeNull();
    expect(parseKg("-5")).toBeNull();
    expect(parseKg("999")).toBeNull();
    expect(formatKg(62500)).toBe("62.5 kg");
    expect(formatKg(80000)).toBe("80 kg");
  });

  it("parses km to metres", () => {
    expect(parseKm("5")).toBe(5000);
    expect(parseKm("5.25")).toBe(5250);
    expect(parseKm("0")).toBeNull();
    expect(parseKm("abc")).toBeNull();
  });

  it("parses run times", () => {
    expect(parseDuration("28:15")).toBe(1695);
    expect(parseDuration("1:05:30")).toBe(3930);
    expect(parseDuration("45")).toBe(2700);
    expect(parseDuration("1:75:00")).toBeNull();
    expect(parseDuration("10:61")).toBeNull();
    expect(parseDuration("0")).toBeNull();
    expect(formatDuration(3930)).toBe("1:05:30");
    expect(formatDuration(1695)).toBe("28:15");
  });

  it("works out pace", () => {
    expect(paceSecondsPerKm(5000, 1500)).toBe(300);
    expect(formatPace(300)).toBe("5:00 /km");
  });

  it("works out sleep across midnight", () => {
    expect(sleepMinutes("23:30", "07:00")).toBe(450);
    expect(sleepMinutes("01:00", "08:15")).toBe(435);
    expect(sleepMinutes("07:00", "07:00")).toBeNull();
    expect(sleepMinutes("25:00", "07:00")).toBeNull();
    expect(formatHours(450)).toBe("7h 30m");
  });
});

describe("personal bests and rewards", () => {
  it("finds the heaviest lift per exercise, ignoring case", () => {
    const pbs = liftPbs([
      { occurredOn: "2026-11-01", exercise: "Squat", reps: 5, weightGrams: 100000 },
      { occurredOn: "2026-11-05", exercise: "squat ", reps: 3, weightGrams: 110000 },
      { occurredOn: "2026-11-06", exercise: "Squat", reps: 5, weightGrams: 110000 },
      { occurredOn: "2026-11-02", exercise: "Push-up", reps: 20, weightGrams: 0 },
    ]);
    expect(pbs).toEqual([
      { exercise: "Push-up", weightGrams: 0, reps: 20, occurredOn: "2026-11-02" },
      { exercise: "Squat", weightGrams: 110000, reps: 5, occurredOn: "2026-11-06" },
    ]);
  });

  it("finds run PBs", () => {
    const runs = [
      { occurredOn: "a", distanceMetres: 800, durationSeconds: 150 }, // too short for pace PB
      { occurredOn: "b", distanceMetres: 5000, durationSeconds: 1500 },
      { occurredOn: "c", distanceMetres: 10000, durationSeconds: 3300 },
      { occurredOn: "d", distanceMetres: 3000, durationSeconds: 840 },
    ];
    const p = runPbs(runs);
    expect(p.longest?.occurredOn).toBe("c");
    expect(p.fastestPace?.occurredOn).toBe("d");
    expect(p.fastest5k?.occurredOn).toBe("b");
    expect(runPbs([])).toEqual({ longest: null, fastestPace: null, fastest5k: null });
  });

  it("counts each active day once", () => {
    const xp = bodyXp({ activeDays: ["d1", "d1", "d2"], waterDays: ["d1"], sleepNights: [] });
    expect(xp.get("Fitness")).toBe(20);
    expect(xp.get("Nutrition")).toBe(5);
    expect(xp.has("Sleep")).toBe(false);
  });
});
