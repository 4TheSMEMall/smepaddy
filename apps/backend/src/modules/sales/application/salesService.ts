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
  CreateSaleData,
  PaymentMethod,
  PaymentStatus,
  SalesRepository,
} from "../domain/salesRepository.js";

type CreateSaleInput = {
  stockItemId?: string;
  quantity?: number;
  unitPrice?: number;
  customerId?: string;
  customerName?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  amountPaid?: number;
  invoiceId?: string;
  createInvoice?: {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    dueDate?: string;
    notes?: string;
  };
};

export class SalesService {
  constructor(private readonly repository: SalesRepository) {}

  async createSale(context: AuthenticatedContext, input: CreateSaleInput) {
    const businessProfileId = this.requireBusiness(context);
    const data = this.validateCreateSaleInput(businessProfileId, input);
    const sale = await this.repository.createSale(data);
    invalidateBusinessCache(businessProfileId, [
      "dashboard-summary",
      "sales",
      "invoices",
      "stock-items",
      "stock-item",
      "stock-movements",
      "stock-item-sales",
    ]);

    coinService.awardCoins(businessProfileId, "SALE_RECORDED", sale.id)
      .catch((err) => logger.warn("coin award failed", { err }));

    return {
      sale: {
        id: sale.id,
        invoiceId: sale.invoiceId,
        customerName: sale.customerName,
        paymentStatus: sale.paymentStatus,
        paymentMethod: sale.paymentMethod,
        subtotal: fromKobo(sale.subtotalKobo),
        amountPaid: fromKobo(sale.amountPaidKobo),
        balance: fromKobo(sale.balanceKobo),
        createdAt: sale.createdAt.toISOString(),
      },
    };
  }

  async listSales(
    context: AuthenticatedContext,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const businessProfileId = this.requireBusiness(context);
    const limit = clampLimit(options.limit);
    const cursor = normalizeOptionalText(options.cursor);

    return getCached(
      businessCacheKey(businessProfileId, "sales", [limit, cursor]),
      30_000,
      async () => {
        const result = await this.repository.listSales({
          businessProfileId,
          limit,
          cursor,
        });

        return {
          nextCursor: result.nextCursor,
          sales: result.sales.map((sale) => ({
            id: sale.id,
            invoiceId: sale.invoiceId,
            customerName: sale.customerName,
            itemNames: sale.itemNames,
            paymentStatus: sale.paymentStatus,
            paymentMethod: sale.paymentMethod,
            subtotal: fromKobo(sale.subtotalKobo),
            amountPaid: fromKobo(sale.amountPaidKobo),
            balance: fromKobo(sale.balanceKobo),
            createdAt: sale.createdAt.toISOString(),
          })),
        };
      },
    );
  }

  private validateCreateSaleInput(
    businessProfileId: string,
    input: CreateSaleInput,
  ): CreateSaleData {
    const paymentStatus = parsePaymentStatus(input.paymentStatus);
    const quantity = toPositiveInt(input.quantity, "quantity");
    const unitPriceKobo = toMoneyKobo(input.unitPrice, "Unit price");
    const subtotalPreview = unitPriceKobo * quantity;
    const amountPaid =
      paymentStatus === "WILL_PAY_LATER"
        ? 0
        : paymentStatus === "PAID"
          ? subtotalPreview
          : toMoneyKobo(input.amountPaid, "Amount paid");

    if (amountPaid > subtotalPreview) {
      throw new AppError("Amount paid cannot exceed sale total", 422, "INVALID_AMOUNT_PAID");
    }

    if (paymentStatus === "PART_PAYMENT" && amountPaid <= 0) {
      throw new AppError("Part payment amount is required", 422, "AMOUNT_PAID_REQUIRED");
    }

    if (paymentStatus === "PART_PAYMENT" && amountPaid >= subtotalPreview) {
      throw new AppError(
        "Use paid status when the full amount has been received",
        422,
        "INVALID_PAYMENT_STATUS",
      );
    }

    const requiresInvoice = paymentStatus !== "PAID";
    if (requiresInvoice && !input.invoiceId && !input.createInvoice) {
      throw new AppError(
        "Credit sales must be linked to an invoice",
        422,
        "INVOICE_REQUIRED",
      );
    }

    return {
      businessProfileId,
      stockItemId: requireText(input.stockItemId, "Stock item"),
      quantity,
      unitPriceKobo,
      customerId: normalizeOptionalText(input.customerId),
      customerName: normalizeOptionalText(input.customerName),
      paymentStatus,
      paymentMethod:
        paymentStatus === "WILL_PAY_LATER"
          ? undefined
          : parsePaymentMethod(input.paymentMethod),
      amountPaidKobo: amountPaid,
      invoiceId: normalizeOptionalText(input.invoiceId),
      createInvoice: input.createInvoice
        ? validateInvoiceInput(input.createInvoice)
        : undefined,
    };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before recording sales",
        403,
        "BUSINESS_REQUIRED",
      );
    }

    return context.business.id;
  }
}

function validateInvoiceInput(input: NonNullable<CreateSaleInput["createInvoice"]>): CreateInvoiceData {
  if (!input.dueDate) {
    throw new AppError("Invoice due date is required", 422, "DUE_DATE_REQUIRED");
  }

  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new AppError("Invoice due date is invalid", 422, "INVALID_DUE_DATE");
  }

  return {
    customerName: requireText(input.customerName, "Customer name"),
    customerPhone: normalizeOptionalText(input.customerPhone),
    dueDate,
    notes: normalizeOptionalText(input.notes),
  };
}

function parsePaymentStatus(value: string | undefined): PaymentStatus {
  if (value === "PAID" || value === "PART_PAYMENT" || value === "WILL_PAY_LATER") {
    return value;
  }
  throw new AppError("Invalid payment status", 422, "INVALID_PAYMENT_STATUS");
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

function fromKobo(value: number) {
  return value / 100;
}

function clampLimit(value: number | undefined) {
  if (value === undefined || !Number.isInteger(value)) return 50;
  return Math.min(Math.max(value, 1), 100);
}
