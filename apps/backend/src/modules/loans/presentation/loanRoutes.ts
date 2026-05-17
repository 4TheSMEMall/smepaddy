import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { loanService } from "../application/loanService.js";

export function createLoanHandler() {
  return async function loanHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") { handleOptions(response); return; }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const detailMatch = url.pathname.match(/^\/loans\/([^/]+)$/);
      const repayMatch = url.pathname.match(/^\/loans\/([^/]+)\/repay$/);

      // GET /loans/eligibility
      if (request.method === "GET" && url.pathname === "/loans/eligibility") {
        const context = await requireAuth(request);
        sendJson(response, 200, await loanService.getEligibility(context));
        return;
      }

      // GET /loans
      if (request.method === "GET" && url.pathname === "/loans") {
        const context = await requireAuth(request);
        sendJson(response, 200, await loanService.listLoans(context));
        return;
      }

      // POST /loans
      if (request.method === "POST" && url.pathname === "/loans") {
        const context = await requireAuth(request);
        const body = await readJson<{ amount?: number; tenureDays?: number }>(request);
        sendJson(response, 201, await loanService.apply(context, body));
        return;
      }

      // GET /loans/:id
      if (request.method === "GET" && detailMatch && !repayMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await loanService.getLoan(context, detailMatch[1]!));
        return;
      }

      // POST /loans/:id/repay
      if (request.method === "POST" && repayMatch) {
        const context = await requireAuth(request);
        const body = await readJson<{ amount?: number; paymentMethod?: string; note?: string; coinsToUse?: number }>(request);
        sendJson(response, 200, await loanService.repay(context, repayMatch[1]!, body));
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled loan route error", {
        method: request.method, url: request.url,
        error: error instanceof Error ? error.message : "Unknown",
      });
      throw error;
    }
  };
}
