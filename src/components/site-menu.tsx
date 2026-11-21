"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AREAS, MORE_AREAS, type SiteArea } from "./site-areas";
import { PixelIcon } from "./ui/pixel-icon";

/** Slim top bar with the app name and a ☰ drop-down menu of every area. */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  // Read the current page when the menu opens (no runtime hook during prerender).
  const [pathname, setPathname] = useState("");
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Close on Escape (focus back to the button) and on clicks outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const item = (a: SiteArea) => {
    const current = pathname === a.href;
    return (
      <li key={a.href}>
        <Link
          href={a.href}
          aria-current={current ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${
            current ? "bg-gold-500/15 text-gold-300" : "text-silver-100 hover:bg-obsidian-700 hover:text-emerald-300"
          } focus-visible:outline-2 focus-visible:outline-emerald-400`}
        >
          <PixelIcon name={a.icon} className="h-6 w-6 shrink-0" />
          {a.label}
        </Link>
      </li>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-obsidian-600/70 bg-obsidian-950/80 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div ref={wrap} className="relative mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-lg font-bold text-gold-300" onClick={() => setOpen(false)}>
          LIFEQUEST
        </Link>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => {
            setPathname(window.location.pathname);
            setOpen((v) => !v);
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-obsidian-600 text-silver-100 hover:border-emerald-400 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          {/* Three pixel bars that turn into an X when open. */}
          <svg viewBox="0 0 12 12" className="h-5 w-5" shapeRendering="crispEdges" aria-hidden="true">
            {open ? (
              <g className="fill-current">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <g key={i}>
                    <rect x={i} y={i} width={1.4} height={1.4} />
                    <rect x={11 - i} y={i} width={1.4} height={1.4} />
                  </g>
                ))}
              </g>
            ) : (
              <g className="fill-current">
                <rect x={1} y={2} width={10} height={2} />
                <rect x={1} y={5} width={10} height={2} />
                <rect x={1} y={8} width={10} height={2} />
              </g>
            )}
          </svg>
        </button>

        {open && (
          <nav
            id={panelId}
            aria-label="Main menu"
            className="absolute right-4 top-full mt-2 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gold-500/40 bg-obsidian-900 p-2 shadow-[0_0_40px_-10px_var(--color-gold-500)]"
          >
            <ul className="grid gap-0.5">
              {item({ href: "/", icon: "dragons", label: "Home" })}
              {AREAS.map(item)}
            </ul>
            <p className="mt-2 border-t border-obsidian-600 px-3 pt-2 text-xs uppercase tracking-wider text-silver-300">More</p>
            <ul className="mt-1 grid gap-0.5">{MORE_AREAS.map(item)}</ul>
          </nav>
        )}
      </div>
    </header>
  );
}
