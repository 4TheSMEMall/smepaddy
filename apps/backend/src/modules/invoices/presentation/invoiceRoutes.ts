import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { InvoiceService } from "../application/invoiceService.js";
import { PrismaInvoiceRepository } from "../infrastructure/prismaInvoiceRepository.js";

type CreateInvoiceBody = {
  customerName?: string;
  customerPhone?: string;
  dueDate?: string;
  notes?: string;
  items?: {
    stockItemId?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
  }[];
};

type RecordPaymentBody = {
  amount?: number;
  paymentMethod?: string;
  note?: string;
};

export function createInvoiceHandler() {
  const service = new InvoiceService(new PrismaInvoiceRepository());

  return async function invoiceHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/invoices") {
        const context = await requireAuth(request);
        const result = await service.listInvoices(context, {
          limit: parseLimit(url.searchParams.get("limit")),
          cursor: url.searchParams.get("cursor") ?? undefined,
        });
        sendJson(response, 200, result);
        return;
      }

      const invoiceDetailMatch = url.pathname.match(/^\/invoices\/([^/]+)$/);
      if (request.method === "GET" && invoiceDetailMatch) {
        const context = await requireAuth(request);
        const result = await service.getInvoice(context, invoiceDetailMatch[1]);
        sendJson(response, 200, result);
        return;
      }

      const invoicePaymentMatch = url.pathname.match(/^\/invoices\/([^/]+)\/payments$/);
      if (request.method === "POST" && invoicePaymentMatch) {
        const context = await requireAuth(request);
        const body = await readJson<RecordPaymentBody>(request);
        const result = await service.recordPayment(
          context,
          invoicePaymentMatch[1],
          body,
        );
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/invoices") {
        const context = await requireAuth(request);
        const body = await readJson<CreateInvoiceBody>(request);
        const result = await service.createInvoice(context, body);
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

      throw error;
    }
  };
}

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
