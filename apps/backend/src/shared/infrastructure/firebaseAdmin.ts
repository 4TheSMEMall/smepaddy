import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import "./loadEnv.js";

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Firebase is optional — the app runs without it.
// Only push notifications and Firebase Auth will be unavailable.
let firebaseAuth: ReturnType<typeof getAuth> | null = null;

if (projectId && clientEmail && privateKey) {
  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  firebaseAuth = getAuth();
} else {
  console.warn(
    "[firebaseAdmin] FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set. " +
    "Firebase Auth is disabled. Push notifications use web-push instead.",
  );
}

export { firebaseAuth };
