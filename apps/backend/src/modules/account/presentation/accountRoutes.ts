import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, sendJson } from "../../../shared/presentation/http.js";
import { AccountService } from "../application/accountService.js";

export function createAccountHandler() {
  const service = new AccountService();

  return async function accountHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/me") {
        const context = await requireAuth(request);
        sendJson(response, 200, service.getMe(context));
        return;
      }

      if (request.method === "GET" && url.pathname === "/business/current") {
        const context = await requireAuth(request);
        sendJson(response, 200, service.getCurrentBusiness(context));
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
