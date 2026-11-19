"use client";

import { useActionState, useId, useState } from "react";
import { createActionAction, updateActionAction, type FormState } from "../server/actions";
import { MAX_POINTS, SUGGESTED_CATEGORIES } from "../schemas";
import { EmojiPicker } from "./emoji-picker";

interface Initial {
  id?: string;
  name: string;
  kind: "good" | "bad";
  points: number;
  icon: string;
  category: string;
  weeklyTarget?: number | null;
}

const EMPTY: Initial = { name: "", kind: "good", points: 10, icon: "⭐", category: "Habits", weeklyTarget: null };

const input =
  "mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400";

function IconField({
  inputProps,
  start,
  idPrefix,
}: {
  inputProps: Record<string, unknown>;
  start: string;
  idPrefix: string;
}) {
  const [icon, setIcon] = useState(start);
  return (
    <>
      <input {...inputProps} className={input} value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={16} required />
      <EmojiPicker value={icon} onPick={setIcon} idPrefix={idPrefix} />
    </>
  );
}

export function ActionForm({ initial = EMPTY, mode = "create" }: { initial?: Initial; mode?: "create" | "edit" }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === "create" ? createActionAction : updateActionAction,
    { ok: true },
  );
  const uid = useId();
  const v = state.values;
  const err = state.fieldErrors ?? {};
  const field = (name: keyof NonNullable<FormState["fieldErrors"]>) => ({
    id: `${uid}-${name}`,
    name,
    "aria-invalid": err[name] ? true : undefined,
    "aria-describedby": err[name] ? `${uid}-${name}-error` : undefined,
  });
  const errorText = (name: keyof NonNullable<FormState["fieldErrors"]>) =>
    err[name] ? (
      <p id={`${uid}-${name}-error`} className="mt-1 text-sm text-ember-300">
        {err[name]}
      </p>
    ) : null;
  const kind = v?.kind ?? initial.kind;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2" aria-label={mode === "create" ? "Create action" : `Edit ${initial.name}`}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="sm:col-span-2">
        <label htmlFor={`${uid}-name`} className="text-sm text-silver-300">
          Name
        </label>
        <input {...field("name")} className={input} defaultValue={v?.name ?? initial.name} maxLength={40} required placeholder="e.g. Gym session" />
        {errorText("name")}
      </div>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm text-silver-300">Type</legend>
        <div className="mt-1 flex gap-3">
          {(["good", "bad"] as const).map((k) => (
            <label
              key={k}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-emerald-400 ${
                k === "good"
                  ? "border-emerald-500/40 has-[:checked]:bg-emerald-700/30 has-[:checked]:text-emerald-300"
                  : "border-ember-500/40 has-[:checked]:bg-ember-700/30 has-[:checked]:text-ember-300"
              }`}
            >
              <input type="radio" name="kind" value={k} defaultChecked={kind === k} className="sr-only" />
              {k === "good" ? "Good (adds Honour + XP)" : "Bad (costs Honour)"}
            </label>
          ))}
        </div>
        {errorText("kind")}
      </fieldset>

      <div>
        <label htmlFor={`${uid}-points`} className="text-sm text-silver-300">
          Points
        </label>
        <input
          {...field("points")}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_POINTS}
          step={1}
          required
          className={input}
          defaultValue={v?.points ?? String(initial.points)}
        />
        {errorText("points")}
      </div>

      <div>
        <label htmlFor={`${uid}-icon`} className="text-sm text-silver-300">
          Icon (emoji)
        </label>
        {/* Remounts after each submission, so it resets after "Add" and keeps typed values after an error. */}
        <IconField
          key={JSON.stringify(state)}
          inputProps={field("icon")}
          start={mode === "create" && state.ok && state.message ? EMPTY.icon : (v?.icon ?? initial.icon)}
          idPrefix={uid}
        />
        {errorText("icon")}
      </div>

      <div>
        <label htmlFor={`${uid}-weeklyTarget`} className="text-sm text-silver-300">
          Weekly goal (optional)
        </label>
        <input
          {...field("weeklyTarget")}
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          step={1}
          placeholder="e.g. 3 times a week"
          className={input}
          defaultValue={v?.weeklyTarget ?? (initial.weeklyTarget ? String(initial.weeklyTarget) : "")}
        />
        <p className="mt-1 text-xs text-silver-300">Good actions only. +15 XP for every week you hit it.</p>
        {errorText("weeklyTarget")}
      </div>

      <div>
        <label htmlFor={`${uid}-category`} className="text-sm text-silver-300">
          Category
        </label>
        <input
          {...field("category")}
          list={`${uid}-categories`}
          className={input}
          defaultValue={v?.category ?? initial.category}
          maxLength={30}
          required
        />
        <datalist id={`${uid}-categories`}>
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {errorText("category")}
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-gold-500 px-5 font-semibold text-obsidian-950 hover:bg-gold-400 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
        >
          {pending ? "Saving…" : mode === "create" ? "Add action" : "Save changes"}
        </button>
        <p aria-live="polite" className={`text-sm ${state.ok ? "text-emerald-300" : "text-ember-300"}`}>
          {state.message}
        </p>
      </div>
    </form>
  );
}
