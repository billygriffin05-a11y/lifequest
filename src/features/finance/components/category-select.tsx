"use client";

import { useTransition } from "react";
import { setTransactionCategoryAction } from "../server/actions";

/** Re-categorise a transaction as soon as a new category is picked. */
export function CategorySelect({
  id,
  value,
  options,
  label,
}: {
  id: string;
  value: string | null;
  options: { id: string; name: string; icon: string }[];
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={label}
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => start(() => setTransactionCategoryAction({ id, categoryId: e.target.value || null }))}
      className="min-h-11 max-w-40 rounded-lg border border-obsidian-600 bg-obsidian-950 px-2 text-sm text-silver-100"
    >
      <option value="">Uncategorised</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.icon} {o.name}
        </option>
      ))}
    </select>
  );
}
