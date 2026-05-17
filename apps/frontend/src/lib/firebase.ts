"use client";

import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
}

let messagingInstance: Messaging | null = null;

function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(getFirebaseApp());
  }
  return messagingInstance;
}

export type PushResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/**
 * Requests notification permission, registers the service worker, and returns
 * the FCM token — or a reason string explaining why it failed.
 */
export async function requestPushPermission(): Promise<PushResult> {
  if (typeof window === "undefined") return { ok: false, reason: "Not in browser" };
  if (!("Notification" in window)) return { ok: false, reason: "Notifications not supported on this browser" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "Service workers not supported" };

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return { ok: false, reason: "VAPID key not configured — check .env.local" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: `Permission ${permission}` };

  try {
    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const messaging = getFirebaseMessaging();
    if (!messaging) return { ok: false, reason: "Firebase messaging failed to initialise" };

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw });
    if (!token) return { ok: false, reason: "Firebase returned an empty token" };

    return { ok: true, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}

/**
 * Listen for foreground messages while the app is open.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  handler: (title: string, body: string) => void,
): () => void {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "SME Paddy";
    const body = payload.notification?.body ?? "";
    handler(title, body);
  });
}
