import type { PaymentMethod } from "@prisma/client";

import { AppError } from "../../../shared/application/AppError.js";
import {
  businessCacheKey,
  getCached,
  invalidateBusinessCache,
} from "../../../shared/infrastructure/cache.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";

type SettlementInput = {
  supplierId?: string;
  stockItemId?: string;
  amount?: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
};

type ConsignmentItem = {
  id: string;
  name: string;
  quantity: number;
  ownerCost: number;
  sellingPrice: number;
  unitsSold: number;
  totalOwed: number;
  totalSettled: number;
  outstanding: number;
  createdAt: string;
  updatedAt: string;
};

export class ConsignmentService {
  async listSuppliers(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);

    return getCached(
      businessCacheKey(businessProfileId, "consignment-overview"),
      60_000,
      async () => {
        // Run both queries in parallel — we don't need supplier IDs before
        // fetching items because we filter items by businessProfileId +
        // ownershipType, which already scopes them to this business.
        const [suppliers, allItems] = await Promise.all([
          prisma.supplier.findMany({
            where: {
              businessProfileId,
              stockItems: {
                some: { ownershipType: "CONSIGNMENT", archivedAt: null },
              },
            },
            orderBy: { name: "asc" },
            select: supplierSelect,
          }),
          prisma.stockItem.findMany({
            where: {
              businessProfileId,
              ownershipType: "CONSIGNMENT",
              archivedAt: null,
            },
            select: {
              id: true,
              supplierId: true,
              ownerCostPerUnitKobo: true,
              saleLineItems: { select: { quantity: true } },
              consignmentSettlements: { select: { amountKobo: true } },
            },
          }),
        ]);

        // Group items by supplierId in a single pass — O(n), no extra DB calls.
        const itemsBySupplierId = new Map<string, typeof allItems>();
        for (const item of allItems) {
          if (!item.supplierId) continue;
          const bucket = itemsBySupplierId.get(item.supplierId) ?? [];
          bucket.push(item);
          itemsBySupplierId.set(item.supplierId, bucket);
        }

        const rows = suppliers.map((supplier) => {
          const items = itemsBySupplierId.get(supplier.id) ?? [];
          const totals = items.reduce(
            (total, item) => {
              const ownerCostKobo = item.ownerCostPerUnitKobo ?? 0;
              const unitsSold = item.saleLineItems.reduce((s, l) => s + l.quantity, 0);
              const totalOwedKobo = unitsSold * ownerCostKobo;
              const totalSettledKobo = item.consignmentSettlements.reduce(
                (s, c) => s + c.amountKobo,
                0,
              );
              return {
                itemCount: total.itemCount + 1,
                totalOwed: total.totalOwed + fromKobo(totalOwedKobo),
                totalSettled: total.totalSettled + fromKobo(totalSettledKobo),
                outstanding:
                  total.outstanding +
                  fromKobo(Math.max(totalOwedKobo - totalSettledKobo, 0)),
              };
            },
            { itemCount: 0, totalOwed: 0, totalSettled: 0, outstanding: 0 },
          );

          return {
            ...supplierToDto(supplier),
            ...totals,
            status: totals.outstanding > 0 ? "PARTIAL" : "SETTLED",
          };
        });

        const summary = rows.reduce(
          (total, row) => ({
            supplierCount: total.supplierCount + 1,
            itemCount: total.itemCount + row.itemCount,
            totalOwed: total.totalOwed + row.totalOwed,
            totalSettled: total.totalSettled + row.totalSettled,
            outstanding: total.outstanding + row.outstanding,
          }),
          { supplierCount: 0, itemCount: 0, totalOwed: 0, totalSettled: 0, outstanding: 0 },
        );

        return { summary, suppliers: rows };
      },
    );
  }

  async getSupplier(context: AuthenticatedContext, supplierId: string) {
    const businessProfileId = this.requireBusiness(context);

    return getCached(
      businessCacheKey(businessProfileId, "consignment-supplier", [supplierId]),
      60_000,
      async () => {
        const supplier = await prisma.supplier.findFirst({
          where: { id: supplierId, businessProfileId },
          select: supplierSelect,
        });

        if (!supplier) {
          throw new AppError("Supplier not found", 404, "SUPPLIER_NOT_FOUND");
        }

        const items = await this.listSupplierItems(businessProfileId, supplierId);
        const settlements = await prisma.consignmentSettlement.findMany({
          where: { businessProfileId, supplierId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            amountKobo: true,
            paymentMethod: true,
            reference: true,
            notes: true,
            createdAt: true,
            stockItem: { select: { id: true, name: true } },
          },
        });

        const summary = items.reduce(
          (total, item) => ({
            itemCount: total.itemCount + 1,
            totalOwed: total.totalOwed + item.totalOwed,
            totalSettled: total.totalSettled + item.totalSettled,
            outstanding: total.outstanding + item.outstanding,
          }),
          { itemCount: 0, totalOwed: 0, totalSettled: 0, outstanding: 0 },
        );

        return {
          supplier: supplierToDto(supplier),
          summary,
          items,
          settlements: settlements.map((settlement) => ({
            id: settlement.id,
            amount: fromKobo(settlement.amountKobo),
            paymentMethod: settlement.paymentMethod,
            reference: settlement.reference,
            notes: settlement.notes,
            item: settlement.stockItem
              ? {
                  id: settlement.stockItem.id,
                  name: settlement.stockItem.name,
                }
              : null,
            createdAt: settlement.createdAt.toISOString(),
          })),
        };
      },
    );
  }

  async createSettlement(context: AuthenticatedContext, input: SettlementInput) {
    const businessProfileId = this.requireBusiness(context);
    const supplierId = requireText(input.supplierId, "Supplier");
    const amountKobo = toMoneyKobo(input.amount, "Amount");
    const paymentMethod = parsePaymentMethod(input.paymentMethod);
    const stockItemId = normalizeOptionalText(input.stockItemId);

    const supplierDetails = await this.getSupplier(context, supplierId);
    const matchingItem = stockItemId
      ? supplierDetails.items.find((item) => item.id === stockItemId)
      : null;
    const maxPayable = matchingItem
      ? matchingItem.outstanding
      : supplierDetails.summary.outstanding;

    if (amountKobo <= 0) {
      throw new AppError("Settlement amount must be greater than zero", 422, "INVALID_AMOUNT");
    }

    if (fromKobo(amountKobo) > maxPayable) {
      throw new AppError(
        "Settlement amount cannot exceed outstanding balance",
        422,
        "SETTLEMENT_EXCEEDS_BALANCE",
      );
    }

    if (stockItemId && !matchingItem) {
      throw new AppError(
        "Settlement item must belong to this consignment supplier",
        422,
        "INVALID_SETTLEMENT_ITEM",
      );
    }

    const settlement = await prisma.consignmentSettlement.create({
      data: {
        businessProfileId,
        supplierId,
        stockItemId,
        amountKobo,
        paymentMethod,
        reference: normalizeOptionalText(input.reference),
        notes: normalizeOptionalText(input.notes),
      },
      select: {
        id: true,
        amountKobo: true,
        paymentMethod: true,
        reference: true,
        notes: true,
        createdAt: true,
      },
    });

    invalidateBusinessCache(businessProfileId, [
      "consignment-overview",
      "consignment-supplier",
      "stock-item-sales",
      "stock-item",
      "dashboard-summary",
    ]);

    return {
      settlement: {
        id: settlement.id,
        amount: fromKobo(settlement.amountKobo),
        paymentMethod: settlement.paymentMethod,
        reference: settlement.reference,
        notes: settlement.notes,
        createdAt: settlement.createdAt.toISOString(),
      },
    };
  }

  private async listSupplierItems(
    businessProfileId: string,
    supplierId: string,
  ): Promise<ConsignmentItem[]> {
    const items = await prisma.stockItem.findMany({
      where: {
        businessProfileId,
        supplierId,
        ownershipType: "CONSIGNMENT",
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        quantity: true,
        ownerCostPerUnitKobo: true,
        sellingPriceKobo: true,
        createdAt: true,
        updatedAt: true,
        saleLineItems: {
          select: { quantity: true },
        },
        consignmentSettlements: {
          select: { amountKobo: true },
        },
      },
    });

    return items.map((item) => {
      const ownerCostKobo = item.ownerCostPerUnitKobo ?? 0;
      const unitsSold = item.saleLineItems.reduce(
        (total, line) => total + line.quantity,
        0,
      );
      const totalOwedKobo = unitsSold * ownerCostKobo;
      const totalSettledKobo = item.consignmentSettlements.reduce(
        (total, settlement) => total + settlement.amountKobo,
        0,
      );

      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        ownerCost: fromKobo(ownerCostKobo),
        sellingPrice: fromKobo(item.sellingPriceKobo),
        unitsSold,
        totalOwed: fromKobo(totalOwedKobo),
        totalSettled: fromKobo(totalSettledKobo),
        outstanding: fromKobo(Math.max(totalOwedKobo - totalSettledKobo, 0)),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before managing consignments",
        403,
        "BUSINESS_REQUIRED",
      );
    }

    return context.business.id;
  }
}

const supplierSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  bankName: true,
  accountName: true,
  accountNumber: true,
  address: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SupplierRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function supplierToDto(supplier: SupplierRecord) {
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
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

function parsePaymentMethod(value: string | undefined): PaymentMethod {
  if (value === "CASH" || value === "TRANSFER" || value === "CARD") return value;
  throw new AppError("Invalid payment method", 422, "INVALID_PAYMENT_METHOD");
}

function requireText(value: string | undefined, label: string) {
  const text = normalizeOptionalText(value);
  if (!text) throw new AppError(`${label} is required`, 422, "REQUIRED_FIELD");
  return text;
}

function normalizeOptionalText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

function toMoneyKobo(value: number | undefined, label: string) {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    throw new AppError(`${label} is invalid`, 422, "INVALID_MONEY");
  }
  return Math.round(value * 100);
}

function fromKobo(value: number) {
  return value / 100;
}
