import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { ExpenseService } from "../application/expenseService.js";
import { PrismaExpenseRepository } from "../infrastructure/prismaExpenseRepository.js";

type CreateExpenseBody = {
  category?: string;
  amount?: number;
  description?: string;
  paymentMethod?: string;
};

export function createExpenseHandler() {
  const service = new ExpenseService(new PrismaExpenseRepository());

  return async function expenseHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const detailMatch = url.pathname.match(/^\/expenses\/([^/]+)$/);

      if (request.method === "DELETE" && detailMatch) {
        const context = await requireAuth(request);
        const result = await service.deleteExpense(context, detailMatch[1]);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/expenses") {
        const context = await requireAuth(request);
        const result = await service.listExpenses(context, {
          limit: parseLimit(url.searchParams.get("limit")),
          cursor: url.searchParams.get("cursor") ?? undefined,
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/expenses") {
        const context = await requireAuth(request);
        const body = await readJson<CreateExpenseBody>(request);
        const result = await service.createExpense(context, body);
        sendJson(response, 201, result);
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

      logger.error("Unhandled expense route error", {
        method: request.method,
        url: request.url,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  };
}

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
