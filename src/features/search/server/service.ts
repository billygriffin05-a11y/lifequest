/**
 * Local search across the owner's data. Read-only; runs entirely in the local
 * SQLite database (Prisma `contains` = parameterised LIKE, case-insensitive for
 * ASCII). The query itself is never logged.
 */
import type { PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient;

export const SEARCH_KINDS = ["actions", "deeds", "money", "books", "cards", "journal"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export const KIND_LABELS: Record<SearchKind, string> = {
  actions: "Actions",
  deeds: "Deeds & notes",
  money: "Money",
  books: "Books",
  cards: "Cards",
  journal: "Journal",
};

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  detail: string;
  day: string | null;
  href: string;
}

export const MIN_QUERY = 2;
export const MAX_QUERY = 60;
const LIMIT = 25;

export function normaliseQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY) : "";
}

export async function search(db: Db, q: string, kinds: readonly SearchKind[] = SEARCH_KINDS): Promise<SearchHit[]> {
  if (q.length < MIN_QUERY) return [];
  const want = new Set(kinds);
  const has = (k: SearchKind) => want.has(k);

  const [actions, deeds, money, books, cards, journal] = await Promise.all([
    has("actions")
      ? db.pointAction.findMany({
          where: { deletedAt: null, OR: [{ name: { contains: q } }, { category: { contains: q } }] },
          orderBy: { createdAt: "desc" },
          take: LIMIT,
        })
      : [],
    has("deeds")
      ? db.pointEntry.findMany({
          where: { reversesEntryId: null, OR: [{ actionName: { contains: q } }, { note: { contains: q } }] },
          orderBy: { occurredAt: "desc" },
          take: LIMIT,
        })
      : [],
    has("money")
      ? db.transaction.findMany({ where: { deletedAt: null, description: { contains: q } }, orderBy: { occurredOn: "desc" }, take: LIMIT })
      : [],
    has("books")
      ? db.book.findMany({ where: { archivedAt: null, OR: [{ title: { contains: q } }, { author: { contains: q } }] }, take: LIMIT })
      : [],
    has("cards")
      ? db.flashcard.findMany({
          where: { archivedAt: null, OR: [{ front: { contains: q } }, { back: { contains: q } }, { topic: { contains: q } }] },
          take: LIMIT,
        })
      : [],
    has("journal")
      ? db.reflection.findMany({ where: { entry: { contains: q } }, orderBy: { day: "desc" }, take: LIMIT })
      : [],
  ]);

  const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const snippet = (text: string) => {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0 || text.length <= 120) return text.slice(0, 120);
    const start = Math.max(0, i - 40);
    return `${start ? "…" : ""}${text.slice(start, start + 120)}…`;
  };

  return [
    ...actions.map((a) => ({
      kind: "actions" as const,
      id: a.id,
      title: `${a.icon} ${a.name}`,
      detail: `${a.category} · ${a.kind === "good" ? "+" : "−"}${a.points}${a.archivedAt ? " · archived" : ""}`,
      day: null,
      href: "/honour#manage-heading",
    })),
    ...deeds.map((e) => ({
      kind: "deeds" as const,
      id: e.id,
      title: `${e.actionIcon} ${e.actionName}`,
      detail: e.note ? snippet(e.note) : `${e.honourDelta >= 0 ? "+" : ""}${e.honourDelta} Honour`,
      day: e.occurredOn,
      href: "/honour",
    })),
    ...money.map((t) => ({
      kind: "money" as const,
      id: t.id,
      title: t.description,
      detail: `${t.amountPence > 0 ? "−" : "+"}${gbp.format(Math.abs(t.amountPence) / 100)}`,
      day: t.occurredOn,
      href: `/money?m=${t.occurredOn.slice(0, 7)}`,
    })),
    ...books.map((b) => ({
      kind: "books" as const,
      id: b.id,
      title: `📖 ${b.title}`,
      detail: [b.author, b.finishedOn ? "finished" : "reading"].filter(Boolean).join(" · "),
      day: b.finishedOn,
      href: "/mind#reading",
    })),
    ...cards.map((c) => ({
      kind: "cards" as const,
      id: c.id,
      title: c.front,
      detail: snippet(c.back),
      day: null,
      href: "/mind/cards#all-cards",
    })),
    ...journal.map((r) => ({
      kind: "journal" as const,
      id: r.day,
      title: "✍️ Journal",
      detail: snippet(r.entry ?? ""),
      day: r.day,
      href: "/mind#reflect",
    })),
  ];
}
