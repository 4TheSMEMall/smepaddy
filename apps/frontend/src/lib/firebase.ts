"use client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushResult =
  | { ok: true; token: string; subscription: string }
  | { ok: false; reason: string };

/**
 * Requests notification permission, registers the service worker,
 * subscribes to web-push using VAPID, and returns the endpoint (token)
 * and full subscription JSON.
 */
export async function requestPushPermission(): Promise<PushResult> {
  if (typeof window === "undefined") return { ok: false, reason: "Not in browser" };
  if (!("Notification" in window)) return { ok: false, reason: "Notifications not supported on this browser" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "Service workers not supported" };
  if (!("PushManager" in window)) return { ok: false, reason: "Push notifications not supported on this browser" };

  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "VAPID key not configured — check env vars" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: `Permission ${permission}` };

  try {
    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    // Subscribe using the Web Push API
    const subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const subJson = JSON.stringify(subscription);
    const token = subscription.endpoint; // endpoint is the unique identifier

    return { ok: true, token, subscription: subJson };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Listen for foreground messages via BroadcastChannel from the service worker.
 */
export function onForegroundMessage(
  handler: (title: string, body: string) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const channel = new BroadcastChannel("smepaddy-push");
  channel.onmessage = (event) => {
    const { title, body } = event.data ?? {};
    if (title) handler(title, body ?? "");
  };

  return () => channel.close();
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
