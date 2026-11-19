import { describe, expect, it } from "vitest";
import { csvCell, ledgerToCsv } from "@/features/honour/csv";

describe("CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('5k, "fast"\nfun')).toBe('"5k, ""fast""\nfun"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(-15)).toBe("-15");
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("writes a header and one row per entry, with a BOM for Excel", () => {
    const csv = ledgerToCsv([
      {
        id: "1",
        actionName: "Gym",
        actionIcon: "🏋️",
        actionCategory: "Fitness",
        kind: "good",
        xpDelta: 20,
        honourDelta: 20,
        occurredOn: "2026-11-19",
        occurredAt: new Date("2026-11-19T08:30:00Z"),
        note: "chest day",
        undone: false,
        isReversal: false,
      },
    ]);
    expect(csv.startsWith("﻿date,time_utc,action")).toBe(true);
    expect(csv).toContain("2026-11-19,08:30:00,Gym,🏋️,good,Fitness,20,20,chest day,false,false");
  });
});
