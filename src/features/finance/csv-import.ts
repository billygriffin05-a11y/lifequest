/**
 * Bank statement CSV import (pure; tests: tests/unit/finance.test.ts).
 *
 * Works with common UK exports (Monzo, Starling, Barclays, HSBC, Nationwide,
 * Lloyds…): finds the date / amount (or debit+credit) / description columns
 * from the header, reads DD/MM/YYYY or YYYY-MM-DD dates, and normalises to
 * amountPence > 0 = money out. Nothing is stored except the parsed rows; the
 * raw file is never written to disk.
 */
import crypto from "node:crypto";
import { parsePounds } from "./money";

/** RFC 4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z]/g, "");

export interface ColumnMap {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
  /** Amount column where money out is positive (e.g. some banks' "Debit Amount"-only exports). */
}

const DATE_KEYS = ["date", "transactiondate", "posteddate", "completeddate", "bookingdate"];
const DESC_KEYS = ["description", "name", "merchant", "payee", "counterparty", "memo", "reference", "details", "transactiondescription"];
const AMOUNT_KEYS = ["amount", "value", "amountgbp", "localamount", "transactionamount"];
const DEBIT_KEYS = ["debit", "debitamount", "paidout", "moneyout", "out"];
const CREDIT_KEYS = ["credit", "creditamount", "paidin", "moneyin", "in"];

export function detectColumns(header: readonly string[]): ColumnMap | null {
  const h = header.map(norm);
  const find = (keys: string[]) => {
    for (const k of keys) {
      const i = h.indexOf(k);
      if (i >= 0) return i;
    }
    return -1;
  };
  const date = find(DATE_KEYS);
  const description = find(DESC_KEYS);
  const amount = find(AMOUNT_KEYS);
  const debit = find(DEBIT_KEYS);
  const credit = find(CREDIT_KEYS);
  if (date < 0 || description < 0) return null;
  if (amount >= 0) return { date, description, amount };
  if (debit >= 0 || credit >= 0) return { date, description, debit: debit >= 0 ? debit : undefined, credit: credit >= 0 ? credit : undefined };
  return null;
}

/** DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, YYYY-MM-DD (optionally with time) → YYYY-MM-DD. UK day-first. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(y, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export interface ImportedRow {
  occurredOn: string;
  /** > 0 = money out (spending), < 0 = money in. */
  amountPence: number;
  description: string;
  importHash: string;
}

export interface ImportResult {
  rows: ImportedRow[];
  skipped: number;
  error?: "no-header" | "unrecognised-columns";
}

export function rowsFromCsv(text: string): ImportResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0, error: "no-header" };
  const cols = detectColumns(table[0]);
  if (!cols) return { rows: [], skipped: 0, error: "unrecognised-columns" };
  const seen = new Map<string, number>();
  const rows: ImportedRow[] = [];
  let skipped = 0;
  for (const r of table.slice(1)) {
    const occurredOn = parseBankDate(r[cols.date] ?? "");
    const description = (r[cols.description] ?? "").trim().slice(0, 200);
    let amountPence: number | null = null;
    if (cols.amount !== undefined) {
      const v = parsePounds(r[cols.amount] ?? "");
      amountPence = v === null ? null : -v; // bank exports: negative = money out
    } else {
      const out = cols.debit !== undefined ? parsePounds((r[cols.debit] ?? "").replace(/^-/, "") || "0") : 0;
      const inn = cols.credit !== undefined ? parsePounds((r[cols.credit] ?? "").replace(/^-/, "") || "0") : 0;
      amountPence = out === null || inn === null ? null : (out ?? 0) - (inn ?? 0);
    }
    if (!occurredOn || amountPence === null || amountPence === 0 || !description) {
      skipped++;
      continue;
    }
    // Identical rows on the same day (e.g. two £3 coffees) get an occurrence index so both import.
    const base = `${occurredOn}|${amountPence}|${description.toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    rows.push({ occurredOn, amountPence, description, importHash: crypto.createHash("sha256").update(`${base}|${n}`).digest("hex") });
  }
  return { rows, skipped };
}

// ── Auto-categorise ──────────────────────────────────────────────────────────

/** Keyword → default category name. Applied only if a category with that name exists. */
export const KEYWORD_RULES: readonly [RegExp, string][] = [
  [/tesco|sainsbury|asda|aldi|lidl|morrisons|co-?op|waitrose|iceland|m&s food|ocado/i, "Groceries"],
  [/deliveroo|uber ?eats|just ?eat|mcdonald|kfc|nando|greggs|domino|pizza|burger|starbucks|costa|pret|cafe|restaurant/i, "Eating out"],
  [/tfl|trainline|national rail|northern|uber(?! ?eats)|bolt|shell|bp |esso|texaco|parking|stagecoach|first bus/i, "Transport"],
  [/netflix|spotify|disney|amazon prime|apple\.com|icloud|youtube|xbox|playstation|now tv/i, "Subscriptions"],
  [/council tax|octopus|british gas|edf|eon|e\.on|ovo|water|thames|severn|ee |vodafone|o2|three|bt |sky |virgin media|tv licen/i, "Bills"],
  [/amazon|ebay|argos|asos|next |primark|john lewis|currys|ikea/i, "Shopping"],
  [/gym|puregym|the gym|david lloyd|nuffield|sports direct/i, "Fitness"],
];

export function guessCategory(description: string, categoryNames: readonly string[]): string | null {
  const lower = new Map(categoryNames.map((n) => [n.toLowerCase(), n]));
  for (const [re, name] of KEYWORD_RULES) if (re.test(description) && lower.has(name.toLowerCase())) return lower.get(name.toLowerCase())!;
  return null;
}

export const DEFAULT_CATEGORIES: readonly { name: string; icon: string; limitPence: number }[] = [
  { name: "Groceries", icon: "🛒", limitPence: 25000 },
  { name: "Eating out", icon: "🍔", limitPence: 8000 },
  { name: "Transport", icon: "🚆", limitPence: 10000 },
  { name: "Bills", icon: "🧾", limitPence: 0 },
  { name: "Subscriptions", icon: "📺", limitPence: 3000 },
  { name: "Shopping", icon: "🛍️", limitPence: 10000 },
  { name: "Fitness", icon: "🏋️", limitPence: 4000 },
  { name: "Other", icon: "💷", limitPence: 0 },
];
