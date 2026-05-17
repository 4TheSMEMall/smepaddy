import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { notificationService } from "../application/notificationService.js";

export function createNotificationHandler() {
  return async function notificationHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      // POST /notifications/token — register device token
      if (request.method === "POST" && url.pathname === "/notifications/token") {
        const context = await requireAuth(request);
        if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");

        const body = await readJson<{ token?: string; subscription?: string }>(request);
        if (!body.token?.trim()) {
          throw new AppError("Token (endpoint) is required", 422, "REQUIRED_FIELD");
        }

        await notificationService.registerToken(
          context.business.id,
          body.token.trim(),
          body.subscription,
        );
        sendJson(response, 200, { ok: true });
        return;
      }

      // DELETE /notifications/token — unregister (e.g. on logout)
      if (request.method === "DELETE" && url.pathname === "/notifications/token") {
        const body = await readJson<{ token?: string }>(request);
        if (body.token?.trim()) {
          await notificationService.deregisterToken(body.token.trim());
        }
        sendJson(response, 200, { ok: true });
        return;
      }

      // POST /notifications/test — sends a real notification to all registered devices
      if (request.method === "POST" && url.pathname === "/notifications/test") {
        const context = await requireAuth(request);
        if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");

        const tokens = await prisma.deviceToken.findMany({
          where: { businessProfileId: context.business.id, isActive: true },
          select: { token: true },
        });

        if (tokens.length === 0) {
          sendJson(response, 200, { ok: false, reason: "No device tokens registered. Enable notifications in Settings first." });
          return;
        }

        await notificationService.send(context.business.id, {
          title: "Test Notification 🎉",
          body: "SME Paddy push notifications are working!",
          data: { type: "TEST" },
        });

        sendJson(response, 200, { ok: true, tokenCount: tokens.length });
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled notification route error", {
        method: request.method,
        url: request.url,
        error: error instanceof Error ? error.message : "Unknown",
      });
      throw error;
    }
  };
}
