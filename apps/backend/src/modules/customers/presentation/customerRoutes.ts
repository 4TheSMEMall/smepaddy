import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { customerService } from "../application/customerService.js";

export function createCustomerHandler() {
  return async function customerHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") { handleOptions(response); return; }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const p = url.pathname;
      const detailMatch = p.match(/^\/customers\/([^/]+)$/);
      const unpaidMatch = p.match(/^\/customers\/([^/]+)\/unpaid-invoices$/);

      // GET /customers
      if (request.method === "GET" && p === "/customers") {
        const context = await requireAuth(request);
        const search = url.searchParams.get("search") ?? undefined;
        sendJson(response, 200, await customerService.list(context, { search }));
        return;
      }

      // POST /customers
      if (request.method === "POST" && p === "/customers") {
        const context = await requireAuth(request);
        const body = await readJson<{ name?: string; phone?: string; email?: string; address?: string; notes?: string }>(request);
        sendJson(response, 201, await customerService.create(context, body));
        return;
      }

      // GET /customers/:id/unpaid-invoices
      if (request.method === "GET" && unpaidMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await customerService.getUnpaidInvoices(context, unpaidMatch[1]!));
        return;
      }

      // GET /customers/:id
      if (request.method === "GET" && detailMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await customerService.getById(context, detailMatch[1]!));
        return;
      }

      // PATCH /customers/:id
      if (request.method === "PATCH" && detailMatch) {
        const context = await requireAuth(request);
        const body = await readJson<{ name?: string; phone?: string; email?: string; address?: string; notes?: string }>(request);
        sendJson(response, 200, await customerService.update(context, detailMatch[1]!, body));
        return;
      }

      // DELETE /customers/:id
      if (request.method === "DELETE" && detailMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await customerService.remove(context, detailMatch[1]!));
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled customer route error", { error: error instanceof Error ? error.message : "Unknown" });
      throw error;
    }
  };
}
