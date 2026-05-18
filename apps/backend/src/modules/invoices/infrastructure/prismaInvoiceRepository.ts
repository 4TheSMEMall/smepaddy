import { Prisma } from "@prisma/client";

import { AppError } from "../../../shared/application/AppError.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type {
  CreateInvoiceData,
  InvoiceRecord,
  InvoiceRepository,
  RecordInvoicePaymentData,
} from "../domain/invoiceRepository.js";

const invoiceSelect = {
  id: true,
  customerName: true,
  customerPhone: true,
  status: true,
  subtotalKobo: true,
  amountPaidKobo: true,
  balanceKobo: true,
  dueDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      stockItemId: true,
      description: true,
      quantity: true,
      unitPriceKobo: true,
      totalKobo: true,
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amountKobo: true,
      paymentMethod: true,
      note: true,
      createdAt: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

export class PrismaInvoiceRepository implements InvoiceRepository {
  async createInvoice(input: CreateInvoiceData): Promise<InvoiceRecord> {
    const subtotalKobo = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceKobo,
      0,
    );

    return prisma.invoice.create({
      data: {
        businessProfileId: input.businessProfileId,
        customerId: input.customerId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        subtotalKobo,
        amountPaidKobo: 0,
        balanceKobo: subtotalKobo,
        dueDate: input.dueDate,
        notes: input.notes,
        status: "PENDING",
        items: {
          create: input.items.map((item) => ({
            stockItemId: item.stockItemId,
            description: item.description,
            quantity: item.quantity,
            unitPriceKobo: item.unitPriceKobo,
            totalKobo: item.quantity * item.unitPriceKobo,
          })),
        },
      },
      select: invoiceSelect,
    });
  }

  async listInvoices(input: {
    businessProfileId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ invoices: InvoiceRecord[]; nextCursor: string | null }> {
    const invoices = await prisma.invoice.findMany({
      where: { businessProfileId: input.businessProfileId },
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: invoiceSelect,
    });

    const hasNextPage = invoices.length > input.limit;
    const page = hasNextPage ? invoices.slice(0, input.limit) : invoices;

    return {
      invoices: page,
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async getInvoice(input: {
    businessProfileId: string;
    invoiceId: string;
  }): Promise<InvoiceRecord | null> {
    return prisma.invoice.findFirst({
      where: {
        id: input.invoiceId,
        businessProfileId: input.businessProfileId,
      },
      select: invoiceSelect,
    });
  }

  async recordPayment(input: RecordInvoicePaymentData): Promise<InvoiceRecord> {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id: input.invoiceId,
          businessProfileId: input.businessProfileId,
        },
        select: {
          id: true,
          balanceKobo: true,
          amountPaidKobo: true,
          dueDate: true,
        },
      });

      if (!invoice) {
        throw new AppError("Invoice not found", 404, "INVOICE_NOT_FOUND");
      }

      if (input.amountKobo > invoice.balanceKobo) {
        throw new AppError(
          "Payment amount cannot exceed invoice balance",
          422,
          "PAYMENT_EXCEEDS_BALANCE",
        );
      }

      const nextAmountPaidKobo = invoice.amountPaidKobo + input.amountKobo;
      const nextBalanceKobo = Math.max(0, invoice.balanceKobo - input.amountKobo);

      await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          businessProfileId: input.businessProfileId,
          amountKobo: input.amountKobo,
          paymentMethod: input.paymentMethod,
          note: input.note,
        },
        select: { id: true },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaidKobo: nextAmountPaidKobo,
          balanceKobo: nextBalanceKobo,
          status: resolveInvoiceStatus(nextBalanceKobo, invoice.dueDate),
        },
        select: invoiceSelect,
      });

      // Keep linked sale transactions in sync. Their paymentStatus and
      // balanceKobo are set at creation time and never updated otherwise,
      // so they go stale the moment an invoice payment is recorded.
      if (nextBalanceKobo <= 0) {
        await tx.saleTransaction.updateMany({
          where: { invoiceId: invoice.id },
          data: { paymentStatus: "PAID", balanceKobo: 0 },
        });
      } else {
        // Lift WILL_PAY_LATER → PART_PAYMENT now that a payment has come in
        await tx.saleTransaction.updateMany({
          where: { invoiceId: invoice.id, paymentStatus: "WILL_PAY_LATER" },
          data: { paymentStatus: "PART_PAYMENT" },
        });
      }

      return updatedInvoice;
    });
  }
}

function resolveInvoiceStatus(balanceKobo: number, dueDate: Date) {
  if (balanceKobo <= 0) return "PAID";
  return dueDate.getTime() < Date.now() ? "OVERDUE" : "PENDING";
}
