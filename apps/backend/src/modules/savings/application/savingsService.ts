import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import * as flw from "../../../shared/infrastructure/flutterwave.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";

const PAYMENT_ATTEMPT_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromDecimal(v: unknown): number {
  return Number(v ?? 0);
}

function entryDto(entry: Record<string, unknown>) {
  return {
    id: entry.id,
    amount: fromDecimal(entry.amount),
    note: entry.note ?? null,
    savedAt: (entry.savedAt as Date).toISOString(),
    status: entry.status,
    verifiedAt: entry.verifiedAt ? (entry.verifiedAt as Date).toISOString() : null,
    payoutStatus: entry.payoutStatus ?? null,
    payoutTransferredAt: entry.payoutTransferredAt ? (entry.payoutTransferredAt as Date).toISOString() : null,
    reconciledAt: entry.reconciledAt ? (entry.reconciledAt as Date).toISOString() : null,
    createdAt: (entry.createdAt as Date).toISOString(),
  };
}

function getReconciliationStatus(amount: number, available: number): "RECONCILED" | "DECLARED" {
  return amount <= available ? "RECONCILED" : "DECLARED";
}

// Period-aware date ranges (Lagos UTC+1)
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

function toLagosDay(date: Date) {
  const d = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dayRange(date: Date) {
  const lagosDate = new Date(date.getTime() + LAGOS_OFFSET_MS);
  lagosDate.setUTCHours(0, 0, 0, 0);
  const from = new Date(lagosDate.getTime() - LAGOS_OFFSET_MS);
  const to = new Date(from.getTime() + 86_400_000 - 1);
  return { from, to };
}

function weekRange() {
  const now = new Date();
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const day = lagosNow.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  lagosNow.setUTCDate(lagosNow.getUTCDate() - offset);
  lagosNow.setUTCHours(0, 0, 0, 0);
  const from = new Date(lagosNow.getTime() - LAGOS_OFFSET_MS);
  const to = new Date(from.getTime() + 7 * 86_400_000 - 1);
  return { from, to };
}

function monthRange() {
  const now = new Date();
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS);
  lagosNow.setUTCDate(1);
  lagosNow.setUTCHours(0, 0, 0, 0);
  const from = new Date(lagosNow.getTime() - LAGOS_OFFSET_MS);
  const next = new Date(lagosNow);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const to = new Date(next.getTime() - LAGOS_OFFSET_MS - 1);
  return { from, to };
}

function getTargetWindow(period: "DAILY" | "WEEKLY" | "MONTHLY") {
  if (period === "DAILY") { const r = dayRange(new Date()); return { label: "Today", ...r }; }
  if (period === "WEEKLY") { const r = weekRange(); return { label: "This week", ...r }; }
  const r = monthRange(); return { label: "This month", ...r };
}

// ─── Compute available-to-save for a given day ────────────────────────────────

async function getAvailableToSave(
  businessProfileId: string,
  savedAt: Date,
  excludeEntryId?: string,
): Promise<number> {
  const { from, to } = dayRange(savedAt);

  const [salesAgg, expensesAgg, savingsAgg] = await Promise.all([
    prisma.saleTransaction.aggregate({
      where: { businessProfileId, createdAt: { gte: from, lte: to } },
      _sum: { amountPaidKobo: true },
    }),
    prisma.expenseTransaction.aggregate({
      where: { businessProfileId, createdAt: { gte: from, lte: to } },
      _sum: { amountKobo: true },
    }),
    prisma.savingsEntry.aggregate({
      where: {
        businessProfileId,
        savedAt: { gte: from, lte: to },
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const inflow    = (savingsAgg._sum.amount !== null ? 0 : 0) + (salesAgg._sum.amountPaidKobo ?? 0) / 100;
  const outflow   = (expensesAgg._sum.amountKobo ?? 0) / 100;
  const alreadySaved = fromDecimal(savingsAgg._sum.amount);
  return Math.max(inflow - outflow - alreadySaved, 0);
}

// ─── SavingsService ───────────────────────────────────────────────────────────

export class SavingsService {

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(context: AuthenticatedContext, input: { amount?: number; savedAt?: string; note?: string }) {
    const businessProfileId = this.requireBusiness(context);
    const amount = toPositiveAmount(input.amount, "Amount");
    const savedAt = toDate(input.savedAt ?? new Date().toISOString(), "savedAt");
    const available = await getAvailableToSave(businessProfileId, savedAt);
    const status = getReconciliationStatus(amount, available);

    const entry = await prisma.savingsEntry.create({
      data: { businessProfileId, amount, note: input.note?.trim() || null, savedAt, status },
    });

    return { entry: entryDto(entry as Record<string, unknown>) };
  }

  async list(context: AuthenticatedContext, opts: { cursor?: string; pageSize?: number; from?: string; to?: string }) {
    const businessProfileId = this.requireBusiness(context);
    const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);

    const entries = await prisma.savingsEntry.findMany({
      where: {
        businessProfileId,
        ...(opts.from ? { savedAt: { gte: new Date(opts.from) } } : {}),
        ...(opts.to ? { savedAt: { lte: new Date(opts.to) } } : {}),
        ...(opts.cursor ? { savedAt: { lt: new Date(opts.cursor) } } : {}),
      },
      orderBy: { savedAt: "desc" },
      take: pageSize + 1,
    });

    const hasNextPage = entries.length > pageSize;
    if (hasNextPage) entries.pop();

    return {
      data: entries.map((e) => entryDto(e as unknown as Record<string, unknown>)),
      meta: {
        nextCursor: hasNextPage && entries.length > 0 ? (entries[entries.length - 1]!.savedAt as Date).toISOString() : null,
        hasNextPage,
        pageSize,
      },
    };
  }

  async update(context: AuthenticatedContext, id: string, input: { amount?: number; savedAt?: string; note?: string }) {
    const businessProfileId = this.requireBusiness(context);
    const existing = await prisma.savingsEntry.findFirst({ where: { id, businessProfileId } });
    if (!existing) throw new AppError("Savings entry not found", 404, "NOT_FOUND");
    if (existing.status === "VERIFIED") throw new AppError("Cannot edit a verified savings entry", 400, "ALREADY_VERIFIED");

    const amount = toPositiveAmount(input.amount, "Amount");
    const savedAt = toDate(input.savedAt ?? (existing.savedAt as Date).toISOString(), "savedAt");
    const available = await getAvailableToSave(businessProfileId, savedAt, id);
    const status = getReconciliationStatus(amount, available);

    const updated = await prisma.savingsEntry.update({
      where: { id },
      data: { amount, note: input.note?.trim() || null, savedAt, status },
    });
    return { entry: entryDto(updated as unknown as Record<string, unknown>) };
  }

  async remove(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const existing = await prisma.savingsEntry.findFirst({ where: { id, businessProfileId } });
    if (!existing) throw new AppError("Savings entry not found", 404, "NOT_FOUND");
    if (existing.status === "VERIFIED") throw new AppError("Cannot delete a verified savings entry", 400, "ALREADY_VERIFIED");
    await prisma.savingsEntry.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Target ────────────────────────────────────────────────────────────────

  async getTargetProgress(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    const target = await prisma.savingsTarget.findFirst({ where: { businessProfileId } });

    if (!target) return { target: null, currentSaved: 0, remaining: 0, progressPercent: 0, isCompleted: false, period: null };

    const window = getTargetWindow(target.period as "DAILY" | "WEEKLY" | "MONTHLY");
    const agg = await prisma.savingsEntry.aggregate({
      where: { businessProfileId, savedAt: { gte: window.from, lte: window.to } },
      _sum: { amount: true },
    });

    const currentSaved = fromDecimal(agg._sum.amount);
    const targetAmount = fromDecimal(target.amount);
    const remaining = Math.max(targetAmount - currentSaved, 0);
    const progressPercent = targetAmount > 0 ? Math.min(Math.round((currentSaved / targetAmount) * 1000) / 10, 100) : 0;

    return {
      target: { amount: targetAmount, period: target.period, updatedAt: (target.updatedAt as Date).toISOString() },
      currentSaved,
      remaining,
      progressPercent,
      isCompleted: currentSaved >= targetAmount,
      period: { label: window.label, from: window.from.toISOString(), to: window.to.toISOString() },
    };
  }

  async updateTarget(context: AuthenticatedContext, input: { amount?: number; period?: string }) {
    const businessProfileId = this.requireBusiness(context);
    const amount = toPositiveAmount(input.amount, "Amount");
    const period = parsePeriod(input.period);

    const target = await prisma.savingsTarget.upsert({
      where: { businessProfileId },
      create: { businessProfileId, amount, period },
      update: { amount, period },
    });
    return { target: { amount: fromDecimal(target.amount), period: target.period, updatedAt: (target.updatedAt as Date).toISOString() } };
  }

  // ── Savings account ───────────────────────────────────────────────────────

  async listBanks() {
    const banks = await flw.listBanks();
    return banks.filter((b) => b.code && b.name).sort((a, b) => a.name.localeCompare(b.name));
  }

  async resolveAccount(_context: AuthenticatedContext, input: { bankCode?: string; accountNumber?: string }) {
    if (!input.bankCode?.trim()) throw new AppError("Bank code is required", 422, "REQUIRED_FIELD");
    if (!input.accountNumber?.trim()) throw new AppError("Account number is required", 422, "REQUIRED_FIELD");
    const accountName = await flw.resolveAccount(input.accountNumber.trim(), input.bankCode.trim());
    return { accountName };
  }

  async getAccount(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    const acc = await prisma.savingsAccount.findFirst({ where: { businessProfileId } });
    if (!acc) return null;
    return { bankName: acc.bankName, bankCode: acc.bankCode, accountNumber: acc.accountNumber, accountName: acc.accountName, setupAt: (acc.setupAt as Date).toISOString() };
  }

  async updateAccount(context: AuthenticatedContext, input: { bankName?: string; bankCode?: string; accountNumber?: string; accountName?: string }) {
    const businessProfileId = this.requireBusiness(context);
    const bankName = requireText(input.bankName, "Bank name");
    const bankCode = requireText(input.bankCode, "Bank code");
    const accountNumber = requireText(input.accountNumber, "Account number");
    const accountName = requireText(input.accountName, "Account name");

    const acc = await prisma.savingsAccount.upsert({
      where: { businessProfileId },
      create: { businessProfileId, bankName, bankCode, accountNumber, accountName },
      update: { bankName, bankCode, accountNumber, accountName },
    });
    return { bankName: acc.bankName, bankCode: acc.bankCode, accountNumber: acc.accountNumber, accountName: acc.accountName, setupAt: (acc.setupAt as Date).toISOString() };
  }

  // ── Verification (Flutterwave payment) ────────────────────────────────────

  async getVerificationPreview(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const entry = await prisma.savingsEntry.findFirst({ where: { id, businessProfileId } });
    if (!entry) throw new AppError("Savings entry not found", 404, "NOT_FOUND");

    const account = await prisma.savingsAccount.findFirst({ where: { businessProfileId } });
    const latestAttempt = await prisma.savingsVerificationAttempt.findFirst({
      where: { savingsEntryId: id, businessProfileId },
      orderBy: { createdAt: "desc" },
    });

    return {
      entry: entryDto(entry as unknown as Record<string, unknown>),
      payoutDestination: account ? { bankName: account.bankName, accountNumber: account.accountNumber, accountName: account.accountName } : null,
      activeAttempt: latestAttempt ? attemptDto(latestAttempt as Record<string, unknown>) : null,
      canProceed: entry.status !== "VERIFIED",
      message: entry.status === "VERIFIED"
        ? "This savings entry has already been verified."
        : latestAttempt?.status === "PENDING"
          ? "A Flutterwave payment is active. Complete it using the link below."
          : "Initiate a Flutterwave payment to verify this savings entry.",
    };
  }

  async initiateVerification(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const entry = await prisma.savingsEntry.findFirst({ where: { id, businessProfileId } });
    if (!entry) throw new AppError("Savings entry not found", 404, "NOT_FOUND");
    if (entry.status === "VERIFIED") throw new AppError("Already verified", 400, "ALREADY_VERIFIED");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAYMENT_ATTEMPT_TTL_MS);

    // Reuse active pending attempt if it hasn't expired
    const existing = await prisma.savingsVerificationAttempt.findFirst({
      where: { savingsEntryId: id, businessProfileId, status: "PENDING", expiresAt: { gt: now } },
    });
    if (existing) {
      return { entry: entryDto(entry as unknown as Record<string, unknown>), attempt: attemptDto(existing as Record<string, unknown>), message: "Payment session is already active." };
    }

    // Build Flutterwave customer from business profile
    const bp = await prisma.businessProfile.findFirst({
      where: { id: businessProfileId },
      include: { user: { select: { phone: true, email: true } } },
    });
    const emailSeed = (bp?.user?.phone ?? businessProfileId).replace(/\D/g, "") || businessProfileId.replace(/-/g, "");
    const email = bp?.user?.email ?? `${emailSeed}@smepaddy.app`;
    const customerName = bp?.businessName ?? "SME Paddy Business";

    const reference = `svpay_${id.replace(/-/g, "").slice(0, 18)}_${Date.now()}`;
    const frontendUrl = process.env.FRONTEND_URL ?? "https://smepaddy-production.up.railway.app";
    const redirectUrl = `${frontendUrl}/savings?verifyEntryId=${id}&verifyRef=${reference}`;

    const payment = await flw.initializePayment({
      email,
      amount: fromDecimal(entry.amount),
      reference,
      redirectUrl,
      customerName,
      metadata: { businessProfileId, savingsEntryId: id, verificationType: "savings" },
    });

    const attempt = await prisma.savingsVerificationAttempt.create({
      data: {
        businessProfileId,
        savingsEntryId: id,
        reference: payment.reference,
        expectedAmount: entry.amount,
        authorizationUrl: payment.authorizationUrl,
        accessCode: payment.accessCode,
        paystackEmail: email,
        expiresAt,
      },
    });

    // Mark entry as verification in progress
    await prisma.savingsEntry.update({
      where: { id },
      data: { verificationReference: payment.reference },
    });

    logger.info("Savings verification initiated", { businessProfileId, entryId: id, reference });
    return { entry: entryDto(entry as unknown as Record<string, unknown>), attempt: attemptDto(attempt as Record<string, unknown>), message: "Flutterwave payment generated. Complete it to verify." };
  }

  async confirmVerification(context: AuthenticatedContext, id: string, input: { reference?: string }) {
    const businessProfileId = this.requireBusiness(context);
    if (!input.reference?.trim()) throw new AppError("reference is required", 422, "REQUIRED_FIELD");
    const reference = input.reference.trim();

    const entry = await prisma.savingsEntry.findFirst({ where: { id, businessProfileId } });
    if (!entry) throw new AppError("Savings entry not found", 404, "NOT_FOUND");

    if (entry.status === "VERIFIED") {
      return { verified: true, reference, status: "SUCCESS", entry: entryDto(entry as unknown as Record<string, unknown>), message: "Already verified." };
    }

    const payment = await flw.verifyTransaction(reference);
    logger.info("Savings verification checked", { businessProfileId, entryId: id, reference, paymentStatus: payment.status });

    if (payment.status === "successful") {
      const expected = fromDecimal(entry.amount);
      if (Math.abs(payment.amount - expected) > 0.01) {
        throw new AppError("Payment amount does not match savings entry", 400, "PAYMENT_AMOUNT_MISMATCH");
      }

      await prisma.savingsVerificationAttempt.updateMany({
        where: { reference, businessProfileId },
        data: { status: "SUCCESS", flwTransactionId: payment.transactionId, flwReference: reference, verifiedAt: payment.paidAt ?? new Date() },
      });

      await prisma.savingsEntry.update({
        where: { id },
        data: { status: "VERIFIED", verifiedAt: payment.paidAt ?? new Date(), payoutStatus: "READY_TO_WITHDRAW" },
      });
    }

    const updated = await prisma.savingsEntry.findFirst({ where: { id } });
    return {
      verified: updated?.status === "VERIFIED",
      reference,
      status: payment.status === "successful" ? "SUCCESS" : "PENDING",
      entry: entryDto((updated ?? entry) as unknown as Record<string, unknown>),
      message: updated?.status === "VERIFIED"
        ? "Savings verified! You can now withdraw to your bank account."
        : "Still waiting for Flutterwave to confirm.",
    };
  }

  // ── Withdrawal (Flutterwave transfer) ─────────────────────────────────────

  async withdraw(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const entry = await prisma.savingsEntry.findFirst({ where: { id, businessProfileId } });
    if (!entry) throw new AppError("Savings entry not found", 404, "NOT_FOUND");
    if (entry.status !== "VERIFIED") throw new AppError("Only verified savings can be withdrawn", 400, "NOT_VERIFIED");

    const payoutStatus = String(entry.payoutStatus ?? "").toUpperCase();
    if (payoutStatus === "SUCCESS") throw new AppError("Already withdrawn", 400, "ALREADY_WITHDRAWN");
    if (["NEW", "PENDING", "PROCESSING", "QUEUED"].includes(payoutStatus)) {
      throw new AppError("Withdrawal already processing", 400, "PAYOUT_IN_FLIGHT");
    }

    const account = await prisma.savingsAccount.findFirst({ where: { businessProfileId } });
    if (!account) throw new AppError("Set up a bank account before withdrawing", 400, "SAVINGS_ACCOUNT_REQUIRED");

    const frontendUrl = process.env.FRONTEND_URL ?? "https://smepaddy-production.up.railway.app";
    const payoutRef = `svpayout_${id.replace(/-/g, "").slice(0, 18)}_${Date.now()}`;

    try {
      const transfer = await flw.initiateTransfer({
        accountBank: account.bankCode,
        accountNumber: account.accountNumber,
        beneficiaryName: account.accountName,
        bankName: account.bankName,
        amount: fromDecimal(entry.amount),
        reference: payoutRef,
        callbackUrl: `${process.env.BACKEND_PUBLIC_URL ?? frontendUrl}/savings/webhook/provider-callback`,
        narration: `SME Paddy savings withdrawal for ${id}`,
      });

      await prisma.savingsEntry.update({
        where: { id },
        data: { payoutStatus: transfer.status, payoutReference: transfer.reference, payoutTransferId: transfer.transferId, payoutTransferredAt: transfer.status === "SUCCESS" ? new Date() : null },
      });

      logger.info("Savings withdrawal initiated", { businessProfileId, entryId: id, payoutRef, status: transfer.status });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Withdrawal failed";
      await prisma.savingsEntry.update({ where: { id }, data: { payoutStatus: "FAILED", payoutFailureReason: msg } });
      const failed = await prisma.savingsEntry.findFirst({ where: { id } });
      return { entry: entryDto((failed ?? entry) as unknown as Record<string, unknown>), message: msg };
    }

    const updated = await prisma.savingsEntry.findFirst({ where: { id } });
    return { entry: entryDto((updated ?? entry) as unknown as Record<string, unknown>), message: "Withdrawal request sent. Funds will arrive shortly." };
  }

  // ── Webhook handlers ──────────────────────────────────────────────────────

  async handleProviderCallback(
    input: { reference?: string; transferId?: string | null; status?: string },
    providedSecret?: string,
  ) {
    const expectedSecret = process.env.GATEWAY_CALLBACK_SECRET ?? "";
    if (expectedSecret && providedSecret !== expectedSecret) {
      throw new AppError("Invalid callback secret", 401, "INVALID_CALLBACK_SECRET");
    }
    if (!input.reference) return { accepted: true, updated: false };

    const entry = await prisma.savingsEntry.findFirst({ where: { payoutReference: input.reference } });
    if (!entry) return { accepted: true, updated: false };

    const normalized = String(input.status ?? "UNKNOWN").toUpperCase();
    const payoutStatus = normalized === "SUCCESSFUL" || normalized === "SUCCESS" ? "SUCCESS"
      : normalized === "FAILED" ? "FAILED"
      : normalized === "REVERSED" ? "REVERSED"
      : normalized;

    await prisma.savingsEntry.update({
      where: { id: entry.id },
      data: {
        payoutStatus,
        payoutTransferId: input.transferId ?? entry.payoutTransferId,
        payoutFailureReason: payoutStatus === "FAILED" ? "Provider reported payout failure" : null,
        payoutTransferredAt: payoutStatus === "SUCCESS" ? new Date() : null,
      },
    });

    logger.info("Savings payout callback processed", { entryId: entry.id, reference: input.reference, payoutStatus });
    return { accepted: true, updated: true };
  }

  async handleFlutterwaveWebhook(payload: Record<string, unknown>, signature?: string) {
    const expectedSecret = process.env.FLW_WEBHOOK_SECRET ?? "";
    const provided = String(signature ?? "");
    if (expectedSecret && provided !== expectedSecret) {
      throw new AppError("Invalid webhook signature", 401, "INVALID_WEBHOOK_SIGNATURE");
    }

    const eventType = String(payload.event ?? "unknown");
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const reference = data.reference ? String(data.reference) : null;

    logger.info("Savings Flutterwave webhook received", { eventType, reference });

    if (eventType === "transfer.success" || eventType === "transfer.failed" || eventType === "transfer.reversed") {
      if (reference) {
        const status = eventType === "transfer.success" ? "SUCCESS" : eventType === "transfer.failed" ? "FAILED" : "REVERSED";
        await this.handleProviderCallback({ reference, transferId: data.id ? String(data.id) : null, status });
      }
    }

    return { accepted: true };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");
    return context.business.id;
  }
}

export const savingsService = new SavingsService();

// ─── DTO helpers ──────────────────────────────────────────────────────────────

function attemptDto(a: Record<string, unknown>) {
  return {
    reference: a.reference,
    expectedAmount: fromDecimal(a.expectedAmount),
    status: a.status,
    paymentUrl: a.authorizationUrl,
    accessCode: a.accessCode ?? null,
    expiresAt: a.expiresAt ? (a.expiresAt as Date).toISOString() : null,
    verifiedAt: a.verifiedAt ? (a.verifiedAt as Date).toISOString() : null,
    createdAt: (a.createdAt as Date).toISOString(),
  };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function toPositiveAmount(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new AppError(`${label} must be a positive number`, 422, "INVALID_AMOUNT");
  return Math.round(n * 100) / 100;
}

function toDate(v: string, label: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new AppError(`${label} is not a valid date`, 422, "INVALID_DATE");
  return d;
}

function requireText(v: unknown, label: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new AppError(`${label} is required`, 422, "REQUIRED_FIELD");
  return s;
}

function parsePeriod(v: unknown): "DAILY" | "WEEKLY" | "MONTHLY" {
  if (v === "DAILY" || v === "WEEKLY" || v === "MONTHLY") return v;
  throw new AppError("period must be DAILY, WEEKLY, or MONTHLY", 422, "INVALID_PERIOD");
}
