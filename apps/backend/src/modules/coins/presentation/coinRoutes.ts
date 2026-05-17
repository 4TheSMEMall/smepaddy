import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, sendJson } from "../../../shared/presentation/http.js";
import { coinService } from "../application/coinService.js";

export function createCoinHandler() {
  return async function coinHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      // GET /wallet — returns balance, level, streak
      if (request.method === "GET" && url.pathname === "/wallet") {
        const context = await requireAuth(request);
        if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");
        const info = await coinService.getWalletInfo(context.business.id);
        sendJson(response, 200, { wallet: info });
        return;
      }

      // POST /wallet/login — awards daily login bonus (idempotent)
      if (request.method === "POST" && url.pathname === "/wallet/login") {
        const context = await requireAuth(request);
        if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");
        const result = await coinService.awardDailyLogin(context.business.id);
        const info = await coinService.getWalletInfo(context.business.id);
        sendJson(response, 200, { awarded: result?.awarded ?? 0, wallet: info });
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled coin route error", {
        method: request.method,
        url: request.url,
        error: error instanceof Error ? error.message : "Unknown",
      });
      throw error;
    }
  };
}
