import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { redemptionService } from "../application/redemptionService.js";

export function createRedemptionHandler() {
  return async function redemptionHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") { handleOptions(response); return; }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      // GET /redemptions — tiers + history + balance
      if (request.method === "GET" && url.pathname === "/redemptions") {
        const context = await requireAuth(request);
        sendJson(response, 200, await redemptionService.getTiers(context));
        return;
      }

      // POST /redemptions — redeem a tier
      if (request.method === "POST" && url.pathname === "/redemptions") {
        const context = await requireAuth(request);
        const body = await readJson<{ tierId?: string }>(request);
        if (!body.tierId?.trim()) throw new AppError("tierId is required", 422, "REQUIRED_FIELD");
        sendJson(response, 201, await redemptionService.redeem(context, body.tierId));
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled redemption route error", { error: error instanceof Error ? error.message : "Unknown" });
      throw error;
    }
  };
}
