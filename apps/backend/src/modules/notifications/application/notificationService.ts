import { getMessaging } from "firebase-admin/messaging";

import "../../../shared/infrastructure/firebaseAdmin.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export class NotificationService {
  async registerToken(businessProfileId: string, token: string): Promise<void> {
    await prisma.deviceToken.upsert({
      where: { token },
      create: { businessProfileId, token },
      update: { businessProfileId, isActive: true },
    });
  }

  async deregisterToken(token: string): Promise<void> {
    await prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }

  /** Send a push notification to all active devices for a business. Fire-and-forget safe. */
  async send(businessProfileId: string, payload: PushPayload): Promise<void> {
    const tokens = await prisma.deviceToken.findMany({
      where: { businessProfileId, isActive: true },
      select: { id: true, token: true },
    });

    if (tokens.length === 0) return;

    const messaging = getMessaging();

    const results = await Promise.allSettled(
      tokens.map(({ token }) =>
        messaging.send({
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          webpush: {
            notification: {
              title: payload.title,
              body: payload.body,
              icon: "/icon-192.png",
              badge: "/badge-72.png",
            },
          },
        }),
      ),
    );

    // Deactivate stale or invalid tokens so they don't get retried
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        const code = (result.reason as { errorInfo?: { code?: string } })?.errorInfo?.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          logger.info("Deactivating stale FCM token", { tokenId: tokens[i]!.id });
          await prisma.deviceToken.update({
            where: { id: tokens[i]!.id },
            data: { isActive: false },
          });
        } else {
          logger.warn("FCM send failed", { code, tokenId: tokens[i]!.id });
        }
      }
    }
  }
}

export const notificationService = new NotificationService();
