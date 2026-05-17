import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import {
  handleOptions,
  readJson,
  sendJson,
} from "../../../shared/presentation/http.js";
import { ConsignmentService } from "../application/consignmentService.js";

type SettlementBody = {
  supplierId?: string;
  stockItemId?: string;
  amount?: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
};

export function createConsignmentHandler() {
  const service = new ConsignmentService();

  return async function consignmentHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/consignment") {
        const context = await requireAuth(request);
        const result = await service.listSuppliers(context);
        sendJson(response, 200, result);
        return;
      }

      const supplierId = getSupplierId(url.pathname);
      if (request.method === "GET" && supplierId) {
        const context = await requireAuth(request);
        const result = await service.getSupplier(context, supplierId);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/consignment/settlements") {
        const context = await requireAuth(request);
        const body = await readJson<SettlementBody>(request);
        const result = await service.createSettlement(context, body);
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

function getSupplierId(pathname: string) {
  const match = pathname.match(/^\/consignment\/suppliers\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
