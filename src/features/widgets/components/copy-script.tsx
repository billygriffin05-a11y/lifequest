"use client";

import { useState } from "react";

/** Copy the widget script to the clipboard (falls back to selecting the text). */
export function CopyScript({ script }: { script: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(script);
            setCopied("done");
          } catch {
            setCopied("failed");
          }
        }}
        className="min-h-11 rounded-lg bg-gold-500 px-4 text-sm font-semibold text-obsidian-950 hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        Copy widget script
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-emerald-300">
        {copied === "done" ? "Copied — now paste it into Scriptable." : copied === "failed" ? "Couldn't copy: press and hold the script below, then Select All → Copy." : ""}
      </p>
      <label htmlFor="widget-script" className="sr-only">
        Widget script
      </label>
      <textarea
        id="widget-script"
        readOnly
        value={script}
        rows={8}
        className="block w-full rounded-lg border border-obsidian-600 bg-obsidian-950 p-3 font-mono text-xs text-silver-300"
      />
    </div>
  );
}
