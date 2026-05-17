import { AppError } from "../../../shared/application/AppError.js";
import {
  businessCacheKey,
  getCached,
  invalidateBusinessCache,
} from "../../../shared/infrastructure/cache.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { coinService } from "../../coins/application/coinService.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";
import type {
  CreateInvoiceData,
  InvoiceRecord,
  InvoiceRepository,
  RecordInvoicePaymentData,
} from "../domain/invoiceRepository.js";

type CreateInvoiceInput = {
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

type RecordPaymentInput = {
  amount?: number;
  paymentMethod?: string;
  note?: string;
};

export class InvoiceService {
  constructor(private readonly repository: InvoiceRepository) {}

  async createInvoice(context: AuthenticatedContext, input: CreateInvoiceInput) {
    const businessProfileId = this.requireBusiness(context);
    const invoice = await this.repository.createInvoice(
      this.validateCreateInvoiceInput(businessProfileId, input),
    );
    invalidateBusinessCache(businessProfileId, [
      "dashboard-summary",
      "invoices",
      "sales",
    ]);

    coinService.awardCoins(businessProfileId, "INVOICE_CREATED", invoice.id)
      .catch((err) => logger.warn("coin award failed", { err }));

    return { invoice: toInvoiceDto(invoice) };
  }

  async listInvoices(
    context: AuthenticatedContext,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const businessProfileId = this.requireBusiness(context);
    const limit = clampLimit(options.limit);
    const cursor = normalizeOptionalText(options.cursor);

    return getCached(
      businessCacheKey(businessProfileId, "invoices", [limit, cursor]),
      30_000,
      async () => {
        const result = await this.repository.listInvoices({
          businessProfileId,
          limit,
          cursor,
        });

        return {
          invoices: result.invoices.map(toInvoiceDto),
          summary: buildSummary(result.invoices),
          nextCursor: result.nextCursor,
        };
      },
    );
  }

  async getInvoice(context: AuthenticatedContext, invoiceId: string | undefined) {
    const businessProfileId = this.requireBusiness(context);
    const invoice = await this.repository.getInvoice({
      businessProfileId,
      invoiceId: requireText(invoiceId, "Invoice"),
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "INVOICE_NOT_FOUND");
    }

    return { invoice: toInvoiceDto(invoice) };
  }

  async recordPayment(
    context: AuthenticatedContext,
    invoiceId: string | undefined,
    input: RecordPaymentInput,
  ) {
    const businessProfileId = this.requireBusiness(context);
    const data = this.validateRecordPaymentInput(businessProfileId, invoiceId, input);
    const invoice = await this.repository.recordPayment(data);
    invalidateBusinessCache(businessProfileId, [
      "dashboard-summary",
      "invoices",
      "sales",
    ]);

    // Award coins only when invoice is fully paid
    if (invoice.balanceKobo <= 0) {
      coinService.awardCoins(businessProfileId, "INVOICE_PAID", invoice.id)
        .catch((err) => logger.warn("coin award failed", { err }));
    }

    return { invoice: toInvoiceDto(invoice) };
  }

  private validateCreateInvoiceInput(
    businessProfileId: string,
    input: CreateInvoiceInput,
  ): CreateInvoiceData {
    const dueDate = parseDate(input.dueDate, "Due date");
    const items = input.items ?? [];

    if (items.length === 0) {
      throw new AppError("Add at least one invoice item", 422, "INVOICE_ITEM_REQUIRED");
    }

    return {
      businessProfileId,
      customerName: requireText(input.customerName, "Customer name"),
      customerPhone: normalizeOptionalText(input.customerPhone),
      dueDate,
      notes: normalizeOptionalText(input.notes),
      items: items.map((item) => ({
        stockItemId: normalizeOptionalText(item.stockItemId),
        description: requireText(item.description, "Item description"),
        quantity: toPositiveInt(item.quantity, "Quantity"),
        unitPriceKobo: toMoneyKobo(item.unitPrice, "Price"),
      })),
    };
  }

  private validateRecordPaymentInput(
    businessProfileId: string,
    invoiceId: string | undefined,
    input: RecordPaymentInput,
  ): RecordInvoicePaymentData {
    const amountKobo = toMoneyKobo(input.amount, "Payment amount");
    if (amountKobo <= 0) {
      throw new AppError("Payment amount must be greater than zero", 422, "INVALID_PAYMENT_AMOUNT");
    }

    return {
      businessProfileId,
      invoiceId: requireText(invoiceId, "Invoice"),
      amountKobo,
      paymentMethod: parsePaymentMethod(input.paymentMethod),
      note: normalizeOptionalText(input.note),
    };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before using invoices",
        403,
        "BUSINESS_REQUIRED",
      );
    }

    return context.business.id;
  }
}

function toInvoiceDto(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    status: getDisplayStatus(invoice),
    subtotal: fromKobo(invoice.subtotalKobo),
    amountPaid: fromKobo(invoice.amountPaidKobo),
    balance: fromKobo(invoice.balanceKobo),
    dueDate: invoice.dueDate.toISOString(),
    notes: invoice.notes,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    items: invoice.items.map((item) => ({
      id: item.id,
      stockItemId: item.stockItemId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: fromKobo(item.unitPriceKobo),
      total: fromKobo(item.totalKobo),
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: fromKobo(payment.amountKobo),
      paymentMethod: payment.paymentMethod,
      note: payment.note,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

function buildSummary(invoices: InvoiceRecord[]) {
  return invoices.reduce(
    (summary, invoice) => {
      const status = getDisplayStatus(invoice);
      if (status === "PAID") summary.paid += fromKobo(invoice.subtotalKobo);
      if (status === "PENDING") summary.pending += fromKobo(invoice.balanceKobo);
      if (status === "OVERDUE") summary.overdue += fromKobo(invoice.balanceKobo);
      return summary;
    },
    { paid: 0, pending: 0, overdue: 0 },
  );
}

function getDisplayStatus(invoice: InvoiceRecord) {
  if (invoice.balanceKobo <= 0 || invoice.status === "PAID") return "PAID";
  if (invoice.dueDate.getTime() < Date.now()) return "OVERDUE";
  return "PENDING";
}

function parseDate(value: string | undefined, label: string) {
  if (!value) throw new AppError(`${label} is required`, 422, "REQUIRED_FIELD");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} is invalid`, 422, "INVALID_DATE");
  }
  return date;
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

function toPositiveInt(value: number | undefined, label: string) {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    throw new AppError(`${label} must be a positive whole number`, 422, "INVALID_NUMBER");
  }
  return value;
}

function toMoneyKobo(value: number | undefined, label: string) {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    throw new AppError(`${label} is invalid`, 422, "INVALID_MONEY");
  }
  return Math.round(value * 100);
}

function parsePaymentMethod(value: string | undefined) {
  if (value === "CASH" || value === "TRANSFER" || value === "CARD") return value;
  throw new AppError("Invalid payment method", 422, "INVALID_PAYMENT_METHOD");
}

function fromKobo(value: number) {
  return value / 100;
}

function clampLimit(value: number | undefined) {
  if (value === undefined || !Number.isInteger(value)) return 50;
  return Math.min(Math.max(value, 1), 100);
}
