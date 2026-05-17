import webpush from "web-push";

import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";

// ─── VAPID setup ──────────────────────────────────────────────────────────────

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL        ?? "mailto:admin@smepaddy.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ─── NotificationService ──────────────────────────────────────────────────────

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export class NotificationService {
  async registerToken(
    businessProfileId: string,
    token: string,
    subscription?: string,
  ): Promise<void> {
    await prisma.deviceToken.upsert({
      where: { token },
      create: { businessProfileId, token, subscription: subscription ?? null },
      update: { businessProfileId, isActive: true, subscription: subscription ?? undefined },
    });
  }

  async deregisterToken(token: string): Promise<void> {
    await prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }

  /** Send a push notification to all active devices for a business. */
  async send(businessProfileId: string, payload: PushPayload): Promise<void> {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      logger.warn("VAPID keys not configured — push notification skipped", { businessProfileId });
      return;
    }

    const tokens = await prisma.deviceToken.findMany({
      where: { businessProfileId, isActive: true },
      select: { id: true, token: true, subscription: true },
    });

    if (tokens.length === 0) return;

    const payloadStr = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    });

    const results = await Promise.allSettled(
      tokens
        .filter((t) => t.subscription) // only tokens with full subscription
        .map((t) => {
          const sub = JSON.parse(t.subscription!) as webpush.PushSubscription;
          return webpush.sendNotification(sub, payloadStr);
        }),
    );

    // Deactivate expired/invalid subscriptions
    let i = 0;
    for (const result of results) {
      if (result.status === "rejected") {
        const status = (result.reason as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          // Gone / not found — subscription expired
          logger.info("Deactivating expired push subscription", { tokenId: tokens[i]?.id });
          if (tokens[i]) {
            await prisma.deviceToken.update({
              where: { id: tokens[i]!.id },
              data: { isActive: false },
            });
          }
        } else {
          logger.warn("Push notification failed", { status, tokenId: tokens[i]?.id });
        }
      }
      i++;
    }
  }
}

export const notificationService = new NotificationService();
