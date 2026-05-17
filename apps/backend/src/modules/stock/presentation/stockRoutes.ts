import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import {
  handleOptions,
  readJson,
  sendJson,
} from "../../../shared/presentation/http.js";
import { StockService } from "../application/stockService.js";
import { PrismaStockRepository } from "../infrastructure/prismaStockRepository.js";

type StockItemBody = {
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  name?: string;
  description?: string;
  category?: string;
  itemType?: string;
  ownershipType?: string;
  unitType?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  wholesalePrice?: number;
  ownerCostPerUnit?: number;
  quantity?: number;
  lowStockAlertQuantity?: number;
  preferredReorderAmount?: number;
};

type SupplierBody = {
  name?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  address?: string;
  notes?: string;
};

export function createStockHandler() {
  const service = new StockService(new PrismaStockRepository());

  return async function stockHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && url.pathname === "/stock/suppliers") {
        const context = await requireAuth(request);
        const result = await service.listSuppliers(context);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/stock/suppliers") {
        const context = await requireAuth(request);
        const body = await readJson<SupplierBody>(request);
        const result = await service.createSupplier(context, body);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/stock/items") {
        const context = await requireAuth(request);
        const body = await readJson<StockItemBody>(request);
        const result = await service.createItem(context, body);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/stock/items") {
        const context = await requireAuth(request);
        const result = await service.listItems(context, {
          search: optionalQuery(url, "search"),
          category: optionalQuery(url, "category"),
          ownershipType: parseOwnershipQuery(optionalQuery(url, "ownershipType")),
          itemType: parseItemTypeQuery(optionalQuery(url, "itemType")),
          restockOnly: optionalQuery(url, "filter") === "restock",
          limit: parseLimit(url.searchParams.get("limit")),
          cursor: optionalQuery(url, "cursor"),
        });
        sendJson(response, 200, result);
        return;
      }

      const itemId = getItemId(url.pathname);
      const movementItemId = getMovementItemId(url.pathname);
      const salesItemId = getSalesItemId(url.pathname);
      if (salesItemId && request.method === "GET") {
        const context = await requireAuth(request);
        const result = await service.listItemSales(context, salesItemId);
        sendJson(response, 200, result);
        return;
      }

      if (movementItemId && request.method === "GET") {
        const context = await requireAuth(request);
        const result = await service.listMovements(context, movementItemId);
        sendJson(response, 200, result);
        return;
      }

      if (itemId && request.method === "GET") {
        const context = await requireAuth(request);
        const result = await service.getItem(context, itemId);
        sendJson(response, 200, result);
        return;
      }

      if (itemId && request.method === "PATCH") {
        const context = await requireAuth(request);
        const body = await readJson<StockItemBody>(request);
        const result = await service.updateItem(context, itemId, body);
        sendJson(response, 200, result);
        return;
      }

      if (itemId && request.method === "DELETE") {
        const context = await requireAuth(request);
        const result = await service.archiveItem(context, itemId);
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

function getItemId(pathname: string) {
  const match = pathname.match(/^\/stock\/items\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getMovementItemId(pathname: string) {
  const match = pathname.match(/^\/stock\/items\/([^/]+)\/movements$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getSalesItemId(pathname: string) {
  const match = pathname.match(/^\/stock\/items\/([^/]+)\/sales$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function optionalQuery(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value || undefined;
}

function parseOwnershipQuery(value: string | undefined) {
  if (!value) return undefined;
  if (value === "OWNED" || value === "CONSIGNMENT") return value;
  throw new AppError("Invalid ownership filter", 422, "INVALID_FILTER");
}

function parseItemTypeQuery(value: string | undefined) {
  if (!value) return undefined;
  if (value === "PRODUCT" || value === "SERVICE") return value;
  throw new AppError("Invalid item type filter", 422, "INVALID_FILTER");
}

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
