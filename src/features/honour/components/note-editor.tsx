"use client";

import { useId, useState, useTransition } from "react";
import { MAX_NOTE } from "../schemas";
import { setEntryNoteAction } from "../server/actions";

/** Inline "Add note / Edit note" for a logged deed. */
export function NoteEditor({ entryId, name, note }: { entryId: string; name: string; note: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${note ? "Edit" : "Add"} note for ${name}`}
        className="min-h-11 rounded-lg px-2 text-sm text-emerald-300 hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        {note ? "Edit note" : "+ Note"}
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await setEntryNoteAction({ entryId, note: text });
          setMessage(r.ok ? null : (r.message ?? "Could not save."));
          if (r.ok) setOpen(false);
        });
      }}
    >
      <label htmlFor={id} className="sr-only">
        Note for {name}
      </label>
      <input
        id={id}
        autoFocus
        value={text}
        maxLength={MAX_NOTE}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. 5k in 28 min"
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-sm text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-emerald-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-gold-500 px-3 text-sm font-semibold text-obsidian-950 hover:bg-gold-400 disabled:opacity-60"
      >
        Save
      </button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm text-silver-300 hover:text-silver-100">
        Cancel
      </button>
      {message && (
        <p role="alert" className="w-full text-sm text-ember-300">
          {message}
        </p>
      )}
    </form>
  );
}
