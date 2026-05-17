import { postJson } from "@/lib/api";

export function registerDeviceToken(token: string, authToken: string) {
  return postJson<{ ok: boolean }>("/notifications/token", { token }, authToken);
}

export function sendTestNotification(authToken: string) {
  return postJson<{ ok: boolean; reason?: string; tokenCount?: number }>(
    "/notifications/test",
    {},
    authToken,
  );
}
