import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, sendJson } from "../../../shared/presentation/http.js";
import { DashboardService } from "../application/dashboardService.js";

export function createDashboardHandler() {
  const service = new DashboardService();

  return async function dashboardHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/dashboard/summary") {
        const context = await requireAuth(request);
        const result = await service.getSummary(context);
        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, {
          error: error.message,
          code: error.code,
        });
        return;
      }

      throw error;
    }
  };
}
