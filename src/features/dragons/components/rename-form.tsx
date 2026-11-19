"use client";

import { useActionState } from "react";
import { renameDragonAction, type RenameState } from "../server/actions";
import { MAX_DRAGON_NAME } from "../timeline";

export function RenameForm({ areaId, current, defaultName }: { areaId: string; current: string | null; defaultName: string }) {
  const [state, action, pending] = useActionState<RenameState, FormData>(renameDragonAction, { ok: true });
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" aria-label="Rename dragon">
      <input type="hidden" name="areaId" value={areaId} />
      <div className="min-w-0 flex-1">
        <label htmlFor="dragon-name" className="block text-sm text-silver-300">
          Name your dragon
        </label>
        <input
          id="dragon-name"
          name="name"
          defaultValue={current ?? ""}
          placeholder={defaultName}
          maxLength={MAX_DRAGON_NAME}
          className="mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-gold-500 px-4 font-semibold text-obsidian-950 hover:bg-gold-400 disabled:opacity-60"
      >
        Save name
      </button>
      <p aria-live="polite" className={`w-full text-sm ${state.ok ? "text-emerald-300" : "text-ember-300"}`}>
        {state.message}
      </p>
    </form>
  );
}
