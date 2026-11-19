import { describe, expect, it } from "vitest";
import { detectColumns, guessCategory, parseBankDate, parseCsv, rowsFromCsv } from "@/features/finance/csv-import";
import { budgetStatus, formatPence, monthRange, monthUnderBudget, parsePounds, shiftMonth } from "@/features/finance/money";

describe("money", () => {
  it("parses pounds to integer pence, rejecting junk", () => {
    expect(parsePounds("12")).toBe(1200);
    expect(parsePounds("12.3")).toBe(1230);
    expect(parsePounds("£1,234.56")).toBe(123456);
    expect(parsePounds("-4.99")).toBe(-499);
    expect(parsePounds("0.1")).toBe(10);
    expect(parsePounds("1.234")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
    expect(parsePounds("")).toBeNull();
  });

  it("formats pence as GBP", () => {
    expect(formatPence(123456)).toBe("£1,234.56");
    expect(formatPence(-499)).toBe("-£4.99");
  });

  it("month helpers", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("budget status warns at 80% and flags overspend", () => {
    expect(budgetStatus(5000, 10000)).toMatchObject({ state: "ok", percent: 50, remaining: 5000 });
    expect(budgetStatus(8000, 10000).state).toBe("warn");
    expect(budgetStatus(10001, 10000)).toMatchObject({ state: "over", remaining: -1 });
    expect(budgetStatus(5000, 0).state).toBe("none");
  });

  it("a month is under budget only with spending and every limit respected", () => {
    const limits = new Map([["food", 100], ["fun", 50], ["bills", 0]]);
    expect(monthUnderBudget(new Map([["food", 90], ["fun", 50], ["bills", 999]]), limits)).toBe(true);
    expect(monthUnderBudget(new Map([["food", 101]]), limits)).toBe(false);
    expect(monthUnderBudget(new Map(), limits)).toBe(false);
    expect(monthUnderBudget(new Map([["food", 1]]), new Map([["food", 0]]))).toBe(false);
  });
});

describe("bank CSV import", () => {
  it("parses quoted cells, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""q"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'd "q"'],
      ["1", "2", "3"],
    ]);
  });

  it("reads UK day-first dates and ISO dates, rejecting impossible ones", () => {
    expect(parseBankDate("19/11/2026")).toBe("2026-11-19");
    expect(parseBankDate("05-03-26")).toBe("2026-03-05");
    expect(parseBankDate("2026-11-19T10:00:00Z")).toBe("2026-11-19");
    expect(parseBankDate("31/02/2026")).toBeNull();
    expect(parseBankDate("yesterday")).toBeNull();
  });

  it("detects Monzo-style (single signed amount) columns", () => {
    expect(detectColumns(["Transaction ID", "Date", "Time", "Type", "Name", "Emoji", "Category", "Amount"])).toEqual({
      date: 1,
      description: 4,
      amount: 7,
    });
  });

  it("imports signed-amount exports: negative = money out", () => {
    const csv = "Date,Description,Amount\n19/11/2026,TESCO STORES,-23.45\n20/11/2026,Salary,1500.00\n21/11/2026,bad row,\n";
    const r = rowsFromCsv(csv);
    expect(r.rows.map((x) => [x.occurredOn, x.amountPence, x.description])).toEqual([
      ["2026-11-19", 2345, "TESCO STORES"],
      ["2026-11-20", -150000, "Salary"],
    ]);
    expect(r.skipped).toBe(1);
  });

  it("imports debit/credit column exports", () => {
    const csv = "Date,Description,Paid out,Paid in\n19/11/2026,NETFLIX,10.99,\n19/11/2026,REFUND,,5.00\n";
    expect(rowsFromCsv(csv).rows.map((x) => x.amountPence)).toEqual([1099, -500]);
  });

  it("gives identical same-day rows different fingerprints, stable across re-imports", () => {
    const csv = "Date,Description,Amount\n19/11/2026,COSTA,-3.00\n19/11/2026,COSTA,-3.00\n";
    const a = rowsFromCsv(csv).rows.map((x) => x.importHash);
    const b = rowsFromCsv(csv).rows.map((x) => x.importHash);
    expect(new Set(a).size).toBe(2);
    expect(a).toEqual(b);
  });

  it("reports files it can't understand", () => {
    expect(rowsFromCsv("just one line").error).toBe("no-header");
    expect(rowsFromCsv("foo,bar\n1,2\n").error).toBe("unrecognised-columns");
  });

  it("guesses categories only when that category exists", () => {
    expect(guessCategory("TESCO STORES 1234", ["Groceries", "Bills"])).toBe("Groceries");
    expect(guessCategory("UBER EATS", ["Eating out", "Transport"])).toBe("Eating out");
    expect(guessCategory("UBER TRIP", ["Eating out", "Transport"])).toBe("Transport");
    expect(guessCategory("TESCO", ["Bills"])).toBeNull();
  });
});
