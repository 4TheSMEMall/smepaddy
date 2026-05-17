import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { SalesService } from "../application/salesService.js";
import { PrismaSalesRepository } from "../infrastructure/prismaSalesRepository.js";

type CreateSaleBody = {
  stockItemId?: string;
  quantity?: number;
  unitPrice?: number;
  customerName?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  amountPaid?: number;
  invoiceId?: string;
  createInvoice?: {
    customerName?: string;
    customerPhone?: string;
    dueDate?: string;
    notes?: string;
  };
};

export function createSalesHandler() {
  const service = new SalesService(new PrismaSalesRepository());

  return async function salesHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/sales") {
        const context = await requireAuth(request);
        const result = await service.listSales(context, {
          limit: parseLimit(url.searchParams.get("limit")),
          cursor: url.searchParams.get("cursor") ?? undefined,
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/sales") {
        const context = await requireAuth(request);
        const body = await readJson<CreateSaleBody>(request);
        const result = await service.createSale(context, body);
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

      logger.error("Unhandled sales route error", {
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
