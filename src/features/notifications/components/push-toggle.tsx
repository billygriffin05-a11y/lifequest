"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "../server/actions";

type Status = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

/** Turn push notifications on/off for this device. iPhone needs the app on the Home Screen first. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      let next: Status;
      if (!supported) next = ios && !standalone ? "needs-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        next = sub ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = () =>
    start(async () => {
      setMessage(null);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscriptionAction({ endpoint: json.endpoint, keys: json.keys });
      setMessage(r.message);
      setStatus(r.ok ? "on" : "off");
    });

  const turnOff = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Notifications are off for this device.");
    });

  const test = () =>
    start(async () => {
      const r = await sendTestPushAction();
      setMessage(r.message);
    });

  return (
    <div className="grid gap-2" data-testid="push-toggle" data-status={status}>
      {status === "checking" && <p className="text-sm text-silver-300">Checking this device…</p>}
      {status === "needs-install" && (
        <p className="text-sm text-gold-300">
          On iPhone, add LIFEQUEST to your Home Screen first (Share → Add to Home Screen), then open it from there and come back here.
        </p>
      )}
      {status === "unsupported" && <p className="text-sm text-silver-300">This browser can&apos;t receive notifications.</p>}
      {status === "denied" && (
        <p className="text-sm text-ember-300">Notifications are blocked for LIFEQUEST in this device&apos;s settings. Allow them there, then reload.</p>
      )}
      {status === "off" && (
        <button type="button" onClick={turnOn} disabled={pending} className={`${btn} bg-gold-500 text-obsidian-950 hover:bg-gold-400`}>
          Turn on notifications on this device
        </button>
      )}
      {status === "on" && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-11 items-center text-sm text-emerald-300">✓ On for this device</span>
          <button type="button" onClick={test} disabled={pending} className={`${btn} border border-emerald-500/50 text-emerald-300`}>
            Send a test
          </button>
          <button type="button" onClick={turnOff} disabled={pending} className={`${btn} border border-silver-500/40 text-silver-300`}>
            Turn off
          </button>
        </div>
      )}
      <p aria-live="polite" className="min-h-5 text-sm text-silver-300" data-testid="push-message">
        {message}
      </p>
    </div>
  );
}
