import { Prisma, StockMovementType } from "@prisma/client";

import { AppError } from "../../../shared/application/AppError.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { CreateSaleData, SalesRepository } from "../domain/salesRepository.js";

const saleSelect = {
  id: true,
  invoiceId: true,
  customerName: true,
  paymentStatus: true,
  paymentMethod: true,
  subtotalKobo: true,
  amountPaidKobo: true,
  balanceKobo: true,
  createdAt: true,
} satisfies Prisma.SaleTransactionSelect;

export class PrismaSalesRepository implements SalesRepository {
  async listSales(input: { businessProfileId: string; limit: number; cursor?: string }) {
    const sales = await prisma.saleTransaction.findMany({
      where: { businessProfileId: input.businessProfileId },
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        ...saleSelect,
        lineItems: {
          select: {
            stockItem: {
              select: { name: true },
            },
          },
        },
      },
    });

    const hasNextPage = sales.length > input.limit;
    const page = hasNextPage ? sales.slice(0, input.limit) : sales;

    return {
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
      sales: page.map((sale) => ({
      id: sale.id,
      invoiceId: sale.invoiceId,
      customerName: sale.customerName,
      paymentStatus: sale.paymentStatus,
      paymentMethod: sale.paymentMethod,
      subtotalKobo: sale.subtotalKobo,
      amountPaidKobo: sale.amountPaidKobo,
      balanceKobo: sale.balanceKobo,
      createdAt: sale.createdAt,
      itemNames: sale.lineItems.map((lineItem) => lineItem.stockItem.name),
      })),
    };
  }

  async createSale(input: CreateSaleData) {
    return prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findFirst({
        where: {
          id: input.stockItemId,
          businessProfileId: input.businessProfileId,
          archivedAt: null,
        },
        select: {
          id: true,
          name: true,
          quantity: true,
        },
      });

      if (!stockItem) {
        throw new AppError("Stock item not found", 404, "STOCK_ITEM_NOT_FOUND");
      }

      if (stockItem.quantity < input.quantity) {
        throw new AppError("Not enough stock available", 422, "INSUFFICIENT_STOCK");
      }

      const subtotalKobo = input.unitPriceKobo * input.quantity;
      const balanceKobo = subtotalKobo - input.amountPaidKobo;
      let invoiceId = input.invoiceId;

      if (input.createInvoice) {
        const invoice = await tx.invoice.create({
          data: {
            businessProfileId: input.businessProfileId,
            customerId: input.createInvoice.customerId ?? null,
            customerName: input.createInvoice.customerName,
            customerPhone: input.createInvoice.customerPhone,
            subtotalKobo,
            amountPaidKobo: input.amountPaidKobo,
            balanceKobo,
            dueDate: input.createInvoice.dueDate,
            notes: input.createInvoice.notes,
            status: balanceKobo <= 0 ? "PAID" : "PENDING",
            items: {
              create: {
                stockItemId: stockItem.id,
                description: stockItem.name,
                quantity: input.quantity,
                unitPriceKobo: input.unitPriceKobo,
                totalKobo: subtotalKobo,
              },
            },
          },
          select: { id: true },
        });
        invoiceId = invoice.id;
      } else if (invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            businessProfileId: input.businessProfileId,
          },
          select: {
            id: true,
            subtotalKobo: true,
            amountPaidKobo: true,
            balanceKobo: true,
            dueDate: true,
          },
        });

        if (!invoice) {
          throw new AppError("Invoice not found", 404, "INVOICE_NOT_FOUND");
        }

        const nextSubtotalKobo = invoice.subtotalKobo + subtotalKobo;
        const nextAmountPaidKobo = invoice.amountPaidKobo + input.amountPaidKobo;
        const nextBalanceKobo = Math.max(0, invoice.balanceKobo + balanceKobo);

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotalKobo: nextSubtotalKobo,
            amountPaidKobo: nextAmountPaidKobo,
            balanceKobo: nextBalanceKobo,
            status: resolveInvoiceStatus(nextBalanceKobo, invoice.dueDate),
            items: {
              create: {
                stockItemId: stockItem.id,
                description: stockItem.name,
                quantity: input.quantity,
                unitPriceKobo: input.unitPriceKobo,
                totalKobo: subtotalKobo,
              },
            },
          },
          select: { id: true },
        });
      }

      const sale = await tx.saleTransaction.create({
        data: {
          businessProfileId: input.businessProfileId,
          customerId: input.customerId ?? null,
          invoiceId,
          customerName: input.customerName,
          paymentStatus: input.paymentStatus,
          paymentMethod: input.paymentMethod,
          subtotalKobo,
          amountPaidKobo: input.amountPaidKobo,
          balanceKobo,
          lineItems: {
            create: {
              stockItemId: stockItem.id,
              quantity: input.quantity,
              unitPriceKobo: input.unitPriceKobo,
              totalKobo: subtotalKobo,
            },
          },
        },
        select: saleSelect,
      });

      const nextQuantity = stockItem.quantity - input.quantity;
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: {
          quantity: nextQuantity,
          version: { increment: 1 },
        },
        select: { id: true },
      });

      await tx.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          businessProfileId: input.businessProfileId,
          type: StockMovementType.SALE,
          quantityChange: -input.quantity,
          quantityBefore: stockItem.quantity,
          quantityAfter: nextQuantity,
          note: `Sale ${sale.id}`,
        },
      });

      return sale;
    });
  }
}

function resolveInvoiceStatus(balanceKobo: number, dueDate: Date) {
  if (balanceKobo <= 0) return "PAID";
  return dueDate.getTime() < Date.now() ? "OVERDUE" : "PENDING";
}
