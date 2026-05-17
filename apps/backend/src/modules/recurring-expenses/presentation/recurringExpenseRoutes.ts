import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { RecurringExpenseService } from "../application/recurringExpenseService.js";
import { PrismaRecurringExpenseRepository } from "../infrastructure/prismaRecurringExpenseRepository.js";

export function createRecurringExpenseHandler() {
  const service = new RecurringExpenseService(new PrismaRecurringExpenseRepository());

  return {
    handler: async function recurringExpenseHandler(
      request: IncomingMessage,
      response: ServerResponse,
    ) {
      if (request.method === "OPTIONS") {
        handleOptions(response);
        return;
      }

      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        const detailMatch = url.pathname.match(/^\/recurring-expenses\/([^/]+)$/);

        // GET /recurring-expenses
        if (request.method === "GET" && url.pathname === "/recurring-expenses") {
          const context = await requireAuth(request);
          const result = await service.list(context);
          sendJson(response, 200, result);
          return;
        }

        // POST /recurring-expenses
        if (request.method === "POST" && url.pathname === "/recurring-expenses") {
          const context = await requireAuth(request);
          const body = await readJson<Record<string, unknown>>(request);
          const result = await service.create(context, body as Parameters<typeof service.create>[1]);
          sendJson(response, 201, result);
          return;
        }

        // PATCH /recurring-expenses/:id
        if (request.method === "PATCH" && detailMatch) {
          const context = await requireAuth(request);
          const body = await readJson<Record<string, unknown>>(request);
          const result = await service.update(
            context,
            detailMatch[1],
            body as Parameters<typeof service.update>[2],
          );
          sendJson(response, 200, result);
          return;
        }

        // DELETE /recurring-expenses/:id
        if (request.method === "DELETE" && detailMatch) {
          const context = await requireAuth(request);
          const result = await service.remove(context, detailMatch[1]);
          sendJson(response, 200, result);
          return;
        }

        sendJson(response, 404, { error: "Route not found" });
      } catch (error) {
        if (error instanceof AppError) {
          sendJson(response, error.statusCode, { error: error.message, code: error.code });
          return;
        }
        logger.error("Unhandled recurring expense route error", {
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : "Unknown",
        });
        throw error;
      }
    },
    service,
  };
}
