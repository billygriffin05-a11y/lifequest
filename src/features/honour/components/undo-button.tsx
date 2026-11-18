"use client";

import { useState, useTransition } from "react";
import { undoEntryAction } from "../server/actions";

export function UndoButton({ entryId, name }: { entryId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-label={`Undo ${name}`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await undoEntryAction({ entryId, idempotencyKey: crypto.randomUUID() });
            if (!result.ok) setError(result.message ?? "Could not undo.");
          })
        }
        className="min-h-11 rounded-lg border border-silver-500/40 px-3 text-sm text-silver-300 hover:border-gold-500/60 hover:text-gold-300 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        Undo
      </button>
      {error && (
        <span role="alert" className="ml-2 text-sm text-ember-300">
          {error}
        </span>
      )}
    </>
  );
}
