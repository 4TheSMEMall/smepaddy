import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
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

      if (request.method === "PATCH" && url.pathname === "/business") {
        const context = await requireAuth(request);
        const body = await readJson<{ businessName?: string; businessType?: string; location?: string }>(request);
        const result = await service.updateBusiness(context, body);
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
