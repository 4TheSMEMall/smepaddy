import { AppError } from "../../../shared/application/AppError.js";
import {
  businessCacheKey,
  getCached,
  invalidateBusinessCache,
} from "../../../shared/infrastructure/cache.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";
import { coinService } from "../../coins/application/coinService.js";
import type {
  CreateSupplierData,
  CreateStockItemData,
  StockItemFilters,
  StockItemRecord,
  StockMovementRecord,
  StockItemSaleRecord,
  StockItemType,
  StockOwnershipType,
  StockRepository,
  UpdateStockItemData,
} from "../domain/stockRepository.js";

type CreateStockItemInput = {
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

type UpdateStockItemInput = Partial<CreateStockItemInput>;

type CreateSupplierInput = {
  name?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  address?: string;
  notes?: string;
};

export class StockService {
  constructor(private readonly repository: StockRepository) {}

  async createSupplier(context: AuthenticatedContext, input: CreateSupplierInput) {
    const businessProfileId = this.requireBusiness(context);
    const supplier = await this.repository.createSupplier(
      this.validateSupplierInput(businessProfileId, input),
    );
    invalidateBusinessCache(businessProfileId, ["stock-suppliers", "stock-items"]);
    return { supplier: this.supplierToDto(supplier) };
  }

  async listSuppliers(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    return getCached(
      businessCacheKey(businessProfileId, "stock-suppliers"),
      60_000,
      async () => {
        const suppliers = await this.repository.listSuppliers({ businessProfileId });
        return { suppliers: suppliers.map((supplier) => this.supplierToDto(supplier)) };
      },
    );
  }

  async createItem(context: AuthenticatedContext, input: CreateStockItemInput) {
    const businessProfileId = this.requireBusiness(context);
    const data = this.validateCreateInput(businessProfileId, input);
    const item = await this.repository.createItem(data);
    invalidateBusinessCache(businessProfileId, [
      "dashboard-summary",
      "stock-items",
      "stock-item",
      "stock-movements",
      "stock-item-sales",
    ]);

    try {
      await coinService.awardCoins(businessProfileId, "STOCK_CREATED", item.id);
    } catch (err) {
      logger.warn("Failed to award coins for stock creation", { itemId: item.id, err });
    }

    return { item: this.toDto(item) };
  }

  async listMovements(context: AuthenticatedContext, itemId: string) {
    const businessProfileId = this.requireBusiness(context);
    await this.ensureItemExists(businessProfileId, itemId);
    return getCached(
      businessCacheKey(businessProfileId, "stock-movements", [itemId]),
      60_000,
      async () => {
        const movements = await this.repository.listMovements({
          businessProfileId,
          stockItemId: itemId,
        });
        return { movements: movements.map((movement) => this.movementToDto(movement)) };
      },
    );
  }

  async listItemSales(context: AuthenticatedContext, itemId: string) {
    const businessProfileId = this.requireBusiness(context);
    const item = await this.repository.findItemById({
      businessProfileId,
      id: itemId,
    });

    if (!item) {
      throw new AppError("Stock item not found", 404, "STOCK_ITEM_NOT_FOUND");
    }

    return getCached(
      businessCacheKey(businessProfileId, "stock-item-sales", [itemId]),
      60_000,
      async () => {
        const [sales, settlements] = await Promise.all([
          this.repository.listItemSales({
            businessProfileId,
            stockItemId: itemId,
          }),
          this.repository.listItemSettlements({
            businessProfileId,
            stockItemId: itemId,
          }),
        ]);
        const unitsSold = sales.reduce((sum, sale) => sum + sale.quantity, 0);
        const revenueKobo = sales.reduce((sum, sale) => sum + sale.totalKobo, 0);
        const ownerPayableKobo =
          item.ownershipType === "CONSIGNMENT" && item.ownerCostPerUnitKobo
            ? unitsSold * item.ownerCostPerUnitKobo
            : 0;
        const totalSettledKobo = settlements.reduce(
          (sum, settlement) => sum + settlement.amountKobo,
          0,
        );

        return {
          summary: {
            unitsSold,
            revenue: fromKobo(revenueKobo),
            ownerPayable: fromKobo(ownerPayableKobo),
            totalSettled: fromKobo(totalSettledKobo),
            outstandingBalance: fromKobo(
              Math.max(ownerPayableKobo - totalSettledKobo, 0),
            ),
          },
          sales: sales.map((sale) => this.saleToDto(sale)),
        };
      },
    );
  }

  async listItems(
    context: AuthenticatedContext,
    filters: Omit<StockItemFilters, "businessProfileId" | "limit"> & {
      limit?: number;
    },
  ) {
    const businessProfileId = this.requireBusiness(context);
    const limit = clampLimit(filters.limit);
    return getCached(
      businessCacheKey(businessProfileId, "stock-items", [
        filters.search,
        filters.ownershipType,
        filters.category,
        filters.itemType,
        filters.restockOnly,
        limit,
        filters.cursor,
      ]),
      60_000,
      async () => {
        const result = await this.repository.listItems({
          ...filters,
          businessProfileId,
          limit,
        });
        return {
          items: result.items.map((item) => this.toDto(item)),
          nextCursor: result.nextCursor,
        };
      },
    );
  }

  async getItem(context: AuthenticatedContext, itemId: string) {
    const businessProfileId = this.requireBusiness(context);
    return getCached(
      businessCacheKey(businessProfileId, "stock-item", [itemId]),
      60_000,
      async () => {
        const item = await this.repository.findItemById({
          businessProfileId,
          id: itemId,
        });

        if (!item) {
          throw new AppError("Stock item not found", 404, "STOCK_ITEM_NOT_FOUND");
        }

        return { item: this.toDto(item) };
      },
    );
  }

  async updateItem(
    context: AuthenticatedContext,
    itemId: string,
    input: UpdateStockItemInput,
  ) {
    const businessProfileId = this.requireBusiness(context);
    await this.ensureItemExists(businessProfileId, itemId);
    const data = this.validateUpdateInput(businessProfileId, itemId, input);
    const item = await this.repository.updateItem(data);
    invalidateBusinessCache(businessProfileId, [
      "dashboard-summary",
      "stock-items",
      "stock-item",
      "stock-movements",
      "stock-item-sales",
      "sales",
    ]);
    return { item: this.toDto(item) };
  }

  async archiveItem(context: AuthenticatedContext, itemId: string) {
    const businessProfileId = this.requireBusiness(context);
    await this.ensureItemExists(businessProfileId, itemId);
    await this.repository.archiveItem({ businessProfileId, id: itemId });
    invalidateBusinessCache(businessProfileId, [
      "dashboard-summary",
      "stock-items",
      "stock-item",
      "stock-movements",
      "stock-item-sales",
    ]);
    return { ok: true };
  }

  private validateCreateInput(
    businessProfileId: string,
    input: CreateStockItemInput,
  ): CreateStockItemData {
    const itemType = parseItemType(input.itemType);
    const ownershipType = parseOwnershipType(input.ownershipType);
    const quantity = itemType === "SERVICE" ? 0 : toNonNegativeInt(input.quantity, "quantity");

    const data: CreateStockItemData = {
      businessProfileId,
      supplierId: normalizeOptionalText(input.supplierId),
      supplierName: normalizeOptionalText(input.supplierName),
      supplierPhone: normalizeOptionalText(input.supplierPhone),
      name: requireText(input.name, "Item name"),
      description: normalizeOptionalText(input.description),
      category: requireText(input.category, "Category"),
      itemType,
      ownershipType,
      unitType: normalizeOptionalText(input.unitType) ?? "Pieces",
      buyingPriceKobo: toKobo(input.buyingPrice, "Buying price"),
      sellingPriceKobo: toKobo(input.sellingPrice, "Selling price"),
      wholesalePriceKobo: toKobo(input.wholesalePrice, "Wholesale price"),
      ownerCostPerUnitKobo:
        input.ownerCostPerUnit === undefined
          ? undefined
          : toKobo(input.ownerCostPerUnit, "Owner cost per unit"),
      quantity,
      lowStockAlertQuantity:
        input.lowStockAlertQuantity === undefined
          ? undefined
          : toNonNegativeInt(input.lowStockAlertQuantity, "lowStockAlertQuantity"),
      preferredReorderAmount:
        input.preferredReorderAmount === undefined
          ? undefined
          : toNonNegativeInt(input.preferredReorderAmount, "preferredReorderAmount"),
    };

    validateStockRules(data);
    return data;
  }

  private validateUpdateInput(
    businessProfileId: string,
    itemId: string,
    input: UpdateStockItemInput,
  ): UpdateStockItemData {
    const data: UpdateStockItemData = {
      id: itemId,
      businessProfileId,
      ...(input.name !== undefined
        ? { name: requireText(input.name, "Item name") }
        : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalText(input.description) }
        : {}),
      ...(input.category !== undefined
        ? { category: requireText(input.category, "Category") }
        : {}),
      ...(input.itemType !== undefined
        ? { itemType: parseItemType(input.itemType) }
        : {}),
      ...(input.ownershipType !== undefined
        ? { ownershipType: parseOwnershipType(input.ownershipType) }
        : {}),
      ...(input.unitType !== undefined
        ? { unitType: normalizeOptionalText(input.unitType) ?? "Pieces" }
        : {}),
      ...(input.buyingPrice !== undefined
        ? { buyingPriceKobo: toKobo(input.buyingPrice, "Buying price") }
        : {}),
      ...(input.sellingPrice !== undefined
        ? { sellingPriceKobo: toKobo(input.sellingPrice, "Selling price") }
        : {}),
      ...(input.wholesalePrice !== undefined
        ? { wholesalePriceKobo: toKobo(input.wholesalePrice, "Wholesale price") }
        : {}),
      ...(input.ownerCostPerUnit !== undefined
        ? {
            ownerCostPerUnitKobo: toKobo(
              input.ownerCostPerUnit,
              "Owner cost per unit",
            ),
          }
        : {}),
      ...(input.quantity !== undefined
        ? { quantity: toNonNegativeInt(input.quantity, "quantity") }
        : {}),
      ...(input.lowStockAlertQuantity !== undefined
        ? {
            lowStockAlertQuantity: toNonNegativeInt(
              input.lowStockAlertQuantity,
              "lowStockAlertQuantity",
            ),
          }
        : {}),
      ...(input.preferredReorderAmount !== undefined
        ? {
            preferredReorderAmount: toNonNegativeInt(
              input.preferredReorderAmount,
              "preferredReorderAmount",
            ),
          }
        : {}),
      ...(input.supplierName !== undefined
        ? { supplierName: normalizeOptionalText(input.supplierName) }
        : {}),
      ...(input.supplierId !== undefined
        ? { supplierId: normalizeOptionalText(input.supplierId) }
        : {}),
      ...(input.supplierPhone !== undefined
        ? { supplierPhone: normalizeOptionalText(input.supplierPhone) }
        : {}),
    };

    validateStockRules(data);
    return data;
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before managing stock",
        403,
        "BUSINESS_REQUIRED",
      );
    }

    return context.business.id;
  }

  private validateSupplierInput(
    businessProfileId: string,
    input: CreateSupplierInput,
  ): CreateSupplierData {
    return {
      businessProfileId,
      name: requireText(input.name, "Supplier name"),
      phone: normalizeOptionalText(input.phone),
      email: normalizeOptionalText(input.email),
      bankName: normalizeOptionalText(input.bankName),
      accountName: normalizeOptionalText(input.accountName),
      accountNumber: normalizeOptionalText(input.accountNumber),
      address: normalizeOptionalText(input.address),
      notes: normalizeOptionalText(input.notes),
    };
  }

  private async ensureItemExists(businessProfileId: string, itemId: string) {
    const item = await this.repository.findItemById({ businessProfileId, id: itemId });
    if (!item) {
      throw new AppError("Stock item not found", 404, "STOCK_ITEM_NOT_FOUND");
    }
  }

  private toDto(item: StockItemRecord) {
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      itemType: item.itemType,
      ownershipType: item.ownershipType,
      unitType: item.unitType,
      buyingPrice: fromKobo(item.buyingPriceKobo),
      sellingPrice: fromKobo(item.sellingPriceKobo),
      wholesalePrice: fromKobo(item.wholesalePriceKobo),
      ownerCostPerUnit:
        item.ownerCostPerUnitKobo === null
          ? null
          : fromKobo(item.ownerCostPerUnitKobo),
      quantity: item.quantity,
      lowStockAlertQuantity: item.lowStockAlertQuantity,
      preferredReorderAmount: item.preferredReorderAmount,
      stockStatus: getStockStatus(item.quantity, item.lowStockAlertQuantity),
      supplier: item.supplier,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private movementToDto(movement: StockMovementRecord) {
    return {
      id: movement.id,
      stockItemId: movement.stockItemId,
      type: movement.type,
      quantityChange: movement.quantityChange,
      quantityBefore: movement.quantityBefore,
      quantityAfter: movement.quantityAfter,
      note: movement.note,
      createdAt: movement.createdAt.toISOString(),
    };
  }

  private saleToDto(sale: StockItemSaleRecord) {
    return {
      id: sale.id,
      saleTransactionId: sale.saleTransactionId,
      customerName: sale.customerName,
      paymentStatus: sale.paymentStatus,
      quantity: sale.quantity,
      unitPrice: fromKobo(sale.unitPriceKobo),
      total: fromKobo(sale.totalKobo),
      createdAt: sale.createdAt.toISOString(),
    };
  }

  private supplierToDto(supplier: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    address: string | null;
    notes: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      bankName: supplier.bankName,
      accountName: supplier.accountName,
      accountNumber: supplier.accountNumber,
      address: supplier.address,
      notes: supplier.notes,
      createdAt: supplier.createdAt?.toISOString(),
      updatedAt: supplier.updatedAt?.toISOString(),
    };
  }
}

function validateStockRules(input: Partial<CreateStockItemData>) {
  if (
    input.ownershipType === "CONSIGNMENT" &&
    ((!input.supplierId && !input.supplierName) ||
      input.ownerCostPerUnitKobo === undefined)
  ) {
    throw new AppError(
      "Consignment stock requires supplier and owner cost per unit",
      422,
      "CONSIGNMENT_DETAILS_REQUIRED",
    );
  }

  if (input.itemType === "SERVICE" && input.quantity && input.quantity > 0) {
    throw new AppError("Services cannot have stock quantity", 422, "SERVICE_QUANTITY");
  }
}

function requireText(value: string | undefined, label: string) {
  const text = normalizeOptionalText(value);
  if (!text) {
    throw new AppError(`${label} is required`, 422, "REQUIRED_FIELD");
  }
  return text;
}

function normalizeOptionalText(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

function parseItemType(value: string | undefined): StockItemType {
  if (!value || value === "PRODUCT") return "PRODUCT";
  if (value === "SERVICE") return "SERVICE";
  throw new AppError("Invalid stock item type", 422, "INVALID_ITEM_TYPE");
}

function parseOwnershipType(value: string | undefined): StockOwnershipType {
  if (!value || value === "OWNED") return "OWNED";
  if (value === "CONSIGNMENT") return "CONSIGNMENT";
  throw new AppError("Invalid stock ownership type", 422, "INVALID_OWNERSHIP_TYPE");
}

function toKobo(value: number | undefined, label: string) {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) {
    throw new AppError(`${label} cannot be negative`, 422, "INVALID_MONEY");
  }
  return Math.round(value * 100);
}

function fromKobo(value: number) {
  return value / 100;
}

function toNonNegativeInt(value: number | undefined, label: string) {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(`${label} must be a non-negative whole number`, 422, "INVALID_NUMBER");
  }
  return value;
}

function getStockStatus(quantity: number, lowStockAlertQuantity: number | null) {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (lowStockAlertQuantity !== null && quantity <= lowStockAlertQuantity) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

function clampLimit(value: number | undefined) {
  if (value === undefined || !Number.isInteger(value)) return 50;
  return Math.min(Math.max(value, 1), 100);
}
