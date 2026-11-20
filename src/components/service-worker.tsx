"use client";

import { useEffect } from "react";

/** Registers the offline-shell service worker (production builds only). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline support is a nice-to-have; the app works without it.
    });
  }, []);
  return null;
}
