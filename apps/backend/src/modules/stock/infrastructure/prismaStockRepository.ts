import { Prisma, StockMovementType } from "@prisma/client";

import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type {
  CreateSupplierData,
  CreateStockItemData,
  StockItemFilters,
  StockRepository,
  UpdateStockItemData,
} from "../domain/stockRepository.js";

const stockItemSelect = {
  id: true,
  businessProfileId: true,
  sku: true,
  name: true,
  description: true,
  category: true,
  itemType: true,
  ownershipType: true,
  unitType: true,
  buyingPriceKobo: true,
  sellingPriceKobo: true,
  wholesalePriceKobo: true,
  ownerCostPerUnitKobo: true,
  quantity: true,
  lowStockAlertQuantity: true,
  preferredReorderAmount: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  supplier: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      address: true,
      notes: true,
    },
  },
} satisfies Prisma.StockItemSelect;

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
} satisfies Prisma.SupplierSelect;

const stockMovementSelect = {
  id: true,
  stockItemId: true,
  businessProfileId: true,
  type: true,
  quantityChange: true,
  quantityBefore: true,
  quantityAfter: true,
  note: true,
  createdAt: true,
} satisfies Prisma.StockMovementSelect;

export class PrismaStockRepository implements StockRepository {
  async createSupplier(input: CreateSupplierData) {
    return prisma.supplier.create({
      data: {
        businessProfileId: input.businessProfileId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        bankName: input.bankName,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        address: input.address,
        notes: input.notes,
      },
      select: supplierSelect,
    });
  }

  async listSuppliers(input: { businessProfileId: string }) {
    return prisma.supplier.findMany({
      where: { businessProfileId: input.businessProfileId },
      orderBy: { name: "asc" },
      select: supplierSelect,
    });
  }

  async createItem(input: CreateStockItemData) {
    return prisma.$transaction(async (tx) => {
      const supplierId =
        input.ownershipType === "CONSIGNMENT" && input.supplierId
          ? (
              await tx.supplier.findFirstOrThrow({
                where: {
                  id: input.supplierId,
                  businessProfileId: input.businessProfileId,
                },
                select: { id: true },
              })
            ).id
          : input.ownershipType === "CONSIGNMENT" && input.supplierName
            ? (
                await tx.supplier.upsert({
                where: {
                  businessProfileId_name: {
                    businessProfileId: input.businessProfileId,
                    name: input.supplierName,
                  },
                },
                update: {
                  phone: input.supplierPhone,
                },
                create: {
                  businessProfileId: input.businessProfileId,
                  name: input.supplierName,
                  phone: input.supplierPhone,
                },
                select: { id: true },
              })
            ).id
          : null;

      const sku = await nextSku(tx, input.businessProfileId);
      const item = await tx.stockItem.create({
        data: {
          businessProfileId: input.businessProfileId,
          supplierId,
          sku,
          name: input.name,
          description: input.description,
          category: input.category,
          itemType: input.itemType,
          ownershipType: input.ownershipType,
          unitType: input.unitType,
          buyingPriceKobo: input.buyingPriceKobo,
          sellingPriceKobo: input.sellingPriceKobo,
          wholesalePriceKobo: input.wholesalePriceKobo,
          ownerCostPerUnitKobo: input.ownerCostPerUnitKobo,
          quantity: input.quantity,
          lowStockAlertQuantity: input.lowStockAlertQuantity,
          preferredReorderAmount: input.preferredReorderAmount,
        },
        select: stockItemSelect,
      });

      if (input.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            stockItemId: item.id,
            businessProfileId: input.businessProfileId,
            type: StockMovementType.OPENING_STOCK,
            quantityChange: input.quantity,
            quantityBefore: 0,
            quantityAfter: input.quantity,
            note: "Initial quantity on item creation",
          },
        });
      }

      return item;
    });
  }

  async listItems(filters: StockItemFilters) {
    const where: Prisma.StockItemWhereInput = {
      businessProfileId: filters.businessProfileId,
      archivedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.ownershipType ? { ownershipType: filters.ownershipType } : {}),
      ...(filters.itemType ? { itemType: filters.itemType } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { sku: { contains: filters.search, mode: "insensitive" } },
              { category: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.restockOnly ? { lowStockAlertQuantity: { not: null } } : {}),
    };

    // Prisma's type-safe API cannot express column-to-column comparisons
    // (quantity <= lowStockAlertQuantity). For restockOnly we fetch all items
    // that have an alert threshold set (already a bounded subset), apply the
    // comparison in memory, then paginate manually. This keeps cursor pagination
    // correct — the previous approach broke it by taking limit+1 before filtering.
    if (filters.restockOnly) {
      const all = await prisma.stockItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: stockItemSelect,
      });

      const filtered = all.filter(
        (item) =>
          item.lowStockAlertQuantity !== null &&
          item.quantity <= item.lowStockAlertQuantity,
      );

      const startIdx = filters.cursor
        ? filtered.findIndex((i) => i.id === filters.cursor) + 1
        : 0;
      const page = filtered.slice(startIdx, startIdx + filters.limit + 1);
      const hasNextPage = page.length > filters.limit;
      const items = hasNextPage ? page.slice(0, filters.limit) : page;
      return { items, nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null };
    }

    const items = await prisma.stockItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      select: stockItemSelect,
    });

    const hasNextPage = items.length > filters.limit;
    const page = hasNextPage ? items.slice(0, filters.limit) : items;
    return {
      items: page,
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async findItemById(input: { businessProfileId: string; id: string }) {
    return prisma.stockItem.findFirst({
      where: {
        id: input.id,
        businessProfileId: input.businessProfileId,
        archivedAt: null,
      },
      select: stockItemSelect,
    });
  }

  async listMovements(input: { businessProfileId: string; stockItemId: string }) {
    return prisma.stockMovement.findMany({
      where: {
        businessProfileId: input.businessProfileId,
        stockItemId: input.stockItemId,
      },
      orderBy: { createdAt: "desc" },
      select: stockMovementSelect,
    });
  }

  async listItemSales(input: { businessProfileId: string; stockItemId: string }) {
    const lineItems = await prisma.saleLineItem.findMany({
      where: {
        stockItemId: input.stockItemId,
        saleTransaction: {
          businessProfileId: input.businessProfileId,
        },
      },
      orderBy: {
        saleTransaction: {
          createdAt: "desc",
        },
      },
      take: 50,
      select: {
        id: true,
        saleTransactionId: true,
        quantity: true,
        unitPriceKobo: true,
        totalKobo: true,
        saleTransaction: {
          select: {
            customerName: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    return lineItems.map((lineItem) => ({
      id: lineItem.id,
      saleTransactionId: lineItem.saleTransactionId,
      customerName: lineItem.saleTransaction.customerName,
      paymentStatus: lineItem.saleTransaction.paymentStatus,
      quantity: lineItem.quantity,
      unitPriceKobo: lineItem.unitPriceKobo,
      totalKobo: lineItem.totalKobo,
      createdAt: lineItem.saleTransaction.createdAt,
    }));
  }

  async listItemSettlements(input: {
    businessProfileId: string;
    stockItemId: string;
  }) {
    return prisma.consignmentSettlement.findMany({
      where: {
        businessProfileId: input.businessProfileId,
        stockItemId: input.stockItemId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountKobo: true,
        createdAt: true,
      },
    });
  }

  async updateItem(input: UpdateStockItemData) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.stockItem.findFirstOrThrow({
        where: {
          id: input.id,
          businessProfileId: input.businessProfileId,
          archivedAt: null,
        },
        select: { id: true, quantity: true },
      });

      const supplierId =
        input.ownershipType === "CONSIGNMENT" && input.supplierId
          ? (
              await tx.supplier.findFirstOrThrow({
                where: {
                  id: input.supplierId,
                  businessProfileId: input.businessProfileId,
                },
                select: { id: true },
              })
            ).id
          : input.ownershipType === "CONSIGNMENT" && input.supplierName
            ? (
              await tx.supplier.upsert({
                where: {
                  businessProfileId_name: {
                    businessProfileId: input.businessProfileId,
                    name: input.supplierName,
                  },
                },
                update: { phone: input.supplierPhone },
                create: {
                  businessProfileId: input.businessProfileId,
                  name: input.supplierName,
                  phone: input.supplierPhone,
                },
                select: { id: true },
              })
            ).id
          : input.ownershipType === "OWNED"
            ? null
            : undefined;

      const updated = await tx.stockItem.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
          ...(input.ownershipType !== undefined
            ? { ownershipType: input.ownershipType }
            : {}),
          ...(input.unitType !== undefined ? { unitType: input.unitType } : {}),
          ...(input.buyingPriceKobo !== undefined
            ? { buyingPriceKobo: input.buyingPriceKobo }
            : {}),
          ...(input.sellingPriceKobo !== undefined
            ? { sellingPriceKobo: input.sellingPriceKobo }
            : {}),
          ...(input.wholesalePriceKobo !== undefined
            ? { wholesalePriceKobo: input.wholesalePriceKobo }
            : {}),
          ...(input.ownerCostPerUnitKobo !== undefined
            ? { ownerCostPerUnitKobo: input.ownerCostPerUnitKobo }
            : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.lowStockAlertQuantity !== undefined
            ? { lowStockAlertQuantity: input.lowStockAlertQuantity }
            : {}),
          ...(input.preferredReorderAmount !== undefined
            ? { preferredReorderAmount: input.preferredReorderAmount }
            : {}),
          ...(supplierId !== undefined ? { supplierId } : {}),
          version: { increment: 1 },
        },
        select: stockItemSelect,
      });

      if (input.quantity !== undefined && input.quantity !== existing.quantity) {
        await tx.stockMovement.create({
          data: {
            stockItemId: input.id,
            businessProfileId: input.businessProfileId,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantityChange: input.quantity - existing.quantity,
            quantityBefore: existing.quantity,
            quantityAfter: input.quantity,
            note: "Manual quantity update",
          },
        });
      }

      return updated;
    });
  }

  async archiveItem(input: { businessProfileId: string; id: string }) {
    await prisma.stockItem.updateMany({
      where: {
        id: input.id,
        businessProfileId: input.businessProfileId,
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }
}

async function nextSku(
  tx: Prisma.TransactionClient,
  businessProfileId: string,
) {
  const count = await tx.stockItem.count({
    where: { businessProfileId },
  });
  return `STK-${String(count + 1).padStart(4, "0")}`;
}
