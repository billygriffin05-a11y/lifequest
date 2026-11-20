/** Pure CSV export of the ledger (tests: tests/unit/csv.test.ts). */
import type { LedgerItem } from "./server/service";

/** RFC 4180 quoting + spreadsheet formula-injection guard (= + - @ prefixes). */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = ["date", "time_utc", "action", "icon", "kind", "category", "honour", "xp", "note", "undone", "is_undo"];

export function ledgerToCsv(items: readonly LedgerItem[]): string {
  const rows = items.map((e) =>
    [
      e.occurredOn,
      e.occurredAt.toISOString().slice(11, 19),
      e.actionName,
      e.actionIcon,
      e.kind,
      e.actionCategory,
      e.honourDelta,
      e.xpDelta,
      e.note,
      e.undone,
      e.isReversal,
    ]
      .map(csvCell)
      .join(","),
  );
  // BOM so Excel opens UTF-8 (emoji) correctly.
  return `﻿${[CSV_HEADER.join(","), ...rows].join("\r\n")}\r\n`;
}
