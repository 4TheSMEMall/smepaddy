import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, sendJson } from "../../../shared/presentation/http.js";
import { analyticsService } from "../application/analyticsService.js";

const VALID_PERIODS = new Set(["THIS_WEEK", "THIS_MONTH", "THIS_QUARTER", "THIS_YEAR"]);

export function createAnalyticsHandler() {
  return async function analyticsHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") { handleOptions(response); return; }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/analytics") {
        const context = await requireAuth(request);
        const periodParam = url.searchParams.get("period") ?? "THIS_MONTH";
        const period = VALID_PERIODS.has(periodParam) ? periodParam as "THIS_WEEK" | "THIS_MONTH" | "THIS_QUARTER" | "THIS_YEAR" : "THIS_MONTH";
        const result = await analyticsService.getSummary(context, period);
        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled analytics route error", { error: error instanceof Error ? error.message : "Unknown" });
      throw error;
    }
  };
}
