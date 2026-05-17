"use client";

import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Phone,
  Plus,
  ReceiptText,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, removeClientCache, writeClientCache } from "@/lib/clientCache";
import { downloadInvoiceReceipt, shareInvoiceReceipt } from "@/lib/receiptGenerator";
import {
  getInvoice,
  recordInvoicePayment,
  type Invoice,
} from "@/lib/invoiceApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export function InvoiceDetailsScreen({
  invoiceId,
  onBack,
  onChanged,
}: {
  invoiceId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
      const token = getStoredAccessToken();
      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const cacheKey = makeCacheKey(token, "invoice-detail", invoiceId);
      const cached = readClientCache<{ invoice: Invoice }>(cacheKey);
      if (cached) {
        setInvoice(cached.value.invoice);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const response = await getInvoice(token, invoiceId);
        if (!cancelled) {
          setInvoice(response.invoice);
          writeClientCache(cacheKey, response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Unable to load invoice.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const canRecordPayment = Boolean(invoice && invoice.balance > 0);
  const invoiceCode = useMemo(() => `INV-${invoiceId.slice(-4).toUpperCase()}`, [invoiceId]);

  async function submitPayment() {
    if (!invoice) return;
    setError(null);

    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (value > invoice.balance) {
      setError("Payment amount cannot be more than the balance due.");
      return;
    }

    setSaving(true);
    try {
      const response = await recordInvoicePayment(token, invoice.id, {
        amount: value,
        paymentMethod: method,
        note: note.trim() || undefined,
      });
      setInvoice(response.invoice);
      setAmount("");
      setNote("");
      setPaymentOpen(false);
      removeClientCache(makeCacheKey(token, "invoices"));
      removeClientCache(makeCacheKey(token, "invoice-detail"));
      removeClientCache(makeCacheKey(token, "dashboard-summary"));
      removeClientCache(makeCacheKey(token, "sales"));
      writeClientCache(makeCacheKey(token, "invoice-detail", invoice.id), response);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to record payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !invoice) {
    return (
      <div className="grid min-h-[520px] place-items-center">
        <div className="flex items-center gap-3 text-[20px] font-semibold text-[#64748b]">
          <Loader2 className="size-6 animate-spin" />
          Loading invoice...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mx-4 sm:mx-0">
        <button className="mb-6 grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <div className="rounded-[22px] bg-white p-6 text-[20px] font-semibold text-[#ef3b42]">
          {error ?? "Invoice not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-5 sm:mx-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="grid size-10 place-items-center rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.10)]"
            onClick={onBack}
          >
            <ArrowLeft className="size-5" />
          </button>
          <h2 className="text-[28px] font-extrabold text-[#071122]">{invoiceCode}</h2>
        </div>
        <StatusPill status={invoice.status} />
      </div>

      {/* Main invoice card */}
      <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.09)]">
        {/* Status hero strip — only when paid */}
        {invoice.status === "PAID" && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#ecfdf5] to-[#d1fae5] px-6 py-4">
            <CheckCircle2 className="size-6 shrink-0 text-[#059669]" />
            <p className="text-[17px] font-bold text-[#059669]">
              Paid in full — no outstanding balance
            </p>
          </div>
        )}
        {invoice.status === "OVERDUE" && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#fff1f2] to-[#ffe4e6] px-6 py-4">
            <ReceiptText className="size-6 shrink-0 text-[#ef3b42]" />
            <p className="text-[17px] font-bold text-[#ef3b42]">
              Overdue — payment is past the due date
            </p>
          </div>
        )}

        <div className="px-6 py-7">
          {/* Customer + balance */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Bill to
              </p>
              <h3 className="mt-1 text-[27px] font-extrabold text-[#071122]">
                {invoice.customerName}
              </h3>
              {invoice.customerPhone && (
                <p className="mt-1.5 flex items-center gap-2 text-[18px] text-[#526075]">
                  <Phone className="size-4" />
                  {invoice.customerPhone}
                </p>
              )}
            </div>

            {/* Balance — only show in red when actually owed */}
            {invoice.balance > 0 ? (
              <div className="rounded-[16px] bg-[#fff2f2] px-4 py-3 text-right">
                <p className="text-[13px] font-bold uppercase tracking-wide text-[#94a3b8]">
                  Balance Due
                </p>
                <p className="mt-1 text-[24px] font-extrabold text-[#ef3b42]">
                  {formatMoney(invoice.balance)}
                </p>
              </div>
            ) : (
              <div className="rounded-[16px] bg-[#ecfdf5] px-4 py-3 text-right">
                <p className="text-[13px] font-bold uppercase tracking-wide text-[#059669]">
                  Paid in Full
                </p>
                <div className="mt-1 flex items-center justify-end gap-1.5 text-[22px] font-extrabold text-[#059669]">
                  <CheckCircle2 className="size-5" />
                  Settled
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-y border-[#f0f4f9] py-5">
            <DateBlock label="Issue Date" value={invoice.createdAt} />
            <DateBlock label="Due Date" value={invoice.dueDate} alignRight />
          </div>

          {/* Line items */}
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-[1fr_64px_110px_120px] gap-3 text-[14px] font-bold uppercase tracking-wide text-[#94a3b8]">
              <span>Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>
            {invoice.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_64px_110px_120px] gap-3 border-t border-[#f4f6fb] pt-3 text-[19px]"
              >
                <span className="font-semibold text-[#071122]">{item.description}</span>
                <span className="text-center text-[#334155]">{item.quantity}</span>
                <span className="text-right text-[#526075]">{formatMoney(item.unitPrice)}</span>
                <span className="text-right font-bold text-[#071122]">{formatMoney(item.total)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 space-y-2 border-t border-[#f0f4f9] pt-5">
            <InvoiceTotalRow label="Subtotal" value={invoice.subtotal} />
            <InvoiceTotalRow label="Paid" value={invoice.amountPaid} tone="paid" />
            {invoice.balance > 0 && (
              <InvoiceTotalRow label="Balance Due" value={invoice.balance} tone="due" />
            )}
          </div>
        </div>
      </section>

      {/* Payment history card */}
      <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.09)]">
        {/* Section header */}
        <div className="flex items-center gap-3 border-b border-[#f0f4f9] px-6 py-5">
          <span className="grid size-[42px] place-items-center rounded-[13px] bg-[#ecfff4] text-[#10b981]">
            <Banknote className="size-5" />
          </span>
          <div className="flex-1">
            <h3 className="text-[22px] font-extrabold text-[#071122]">Payment History</h3>
          </div>
          <span className="rounded-full bg-[#f1f5fb] px-3 py-1 text-[15px] font-bold text-[#526075]">
            {invoice.payments.length}
          </span>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-3 divide-x divide-[#f0f4f9] bg-[#fafbfd] py-4 text-center">
          <MiniTotal label="Total" value={invoice.subtotal} />
          <MiniTotal label="Paid" value={invoice.amountPaid} tone="paid" />
          <MiniTotal
            label={invoice.balance <= 0 ? "Cleared" : "Outstanding"}
            value={invoice.balance}
            tone={invoice.balance <= 0 ? "paid" : "due"}
          />
        </div>

        {/* Payment list */}
        <div className="px-6 py-4">
          {invoice.payments.length === 0 ? (
            <div className="rounded-[16px] bg-[#f8fafc] px-4 py-7 text-center text-[18px] text-[#94a3b8]">
              No payment recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {invoice.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-4 rounded-[16px] bg-[#f6f9fc] px-5 py-4"
                >
                  <span className="grid size-[46px] shrink-0 place-items-center rounded-[13px] bg-[#dffbea] text-[#10b981]">
                    <CreditCard className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[20px] font-extrabold text-[#071122]">
                      {formatMoney(payment.amount)}
                    </p>
                    <p className="mt-0.5 text-[15px] text-[#64748b]">
                      {formatDate(payment.createdAt)}
                      {payment.note && (
                        <>
                          <span className="mx-1.5">·</span>
                          {payment.note}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[14px] font-bold text-[#526075] shadow-[0_1px_4px_rgba(15,23,42,0.10)]">
                    {payment.paymentMethod[0] +
                      payment.paymentMethod.slice(1).toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error && (
        <p className="rounded-[14px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[18px] font-semibold text-[#be123c]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pb-8">
        <button
          type="button"
          className="flex h-[64px] items-center justify-center gap-2 rounded-[18px] bg-[#0aab72] text-[20px] font-extrabold text-white shadow-[0_4px_14px_rgba(10,171,114,0.35)] transition-opacity disabled:opacity-40 disabled:shadow-none"
          disabled={!canRecordPayment}
          onClick={() => {
            setAmount(invoice.balance ? String(invoice.balance) : "");
            setPaymentOpen(true);
          }}
        >
          <CheckCircle2 className="size-[22px]" />
          Mark Paid
        </button>
        <button
          type="button"
          className="flex h-[64px] items-center justify-center gap-2 rounded-[18px] bg-[#eef4ff] text-[20px] font-extrabold text-[#2563eb] transition-opacity disabled:opacity-40"
          disabled={!canRecordPayment}
          onClick={() => setPaymentOpen(true)}
        >
          <Plus className="size-[22px]" />
          Add Payment
        </button>
      </div>

      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-4 sm:items-center">
          <div className="w-full max-w-[620px] rounded-[26px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[27px] font-extrabold text-[#071122]">
                  Add Payment
                </h3>
                <p className="mt-1 text-[18px] text-[#64748b]">
                  Outstanding:{" "}
                  <span className="font-extrabold text-[#ef3b42]">
                    {formatMoney(invoice.balance)}
                  </span>
                </p>
              </div>
              <button className="grid size-9 place-items-center" onClick={() => setPaymentOpen(false)}>
                <X className="size-6" />
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-[20px] font-semibold">Amount</span>
              <input
                type="number"
                className="h-[62px] w-full rounded-[14px] border border-[#d3dbe6] px-4 text-[22px] outline-none focus:border-[#2563eb]"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <div className="mt-4">
              <p className="mb-2 text-[20px] font-semibold">Payment Method</p>
              <div className="grid grid-cols-3 gap-3">
                {(["CASH", "TRANSFER", "CARD"] as PaymentMethod[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "h-[58px] rounded-[16px] border text-[17px] font-bold",
                      method === option
                        ? "border-[#2563eb] bg-[#eef4ff] text-[#2563eb]"
                        : "border-[#d3dbe6] text-[#526075]",
                    )}
                    onClick={() => setMethod(option)}
                  >
                    {option[0] + option.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-[20px] font-semibold">Note (optional)</span>
              <input
                className="h-[62px] w-full rounded-[14px] border border-[#d3dbe6] px-4 text-[22px] outline-none focus:border-[#2563eb]"
                placeholder="e.g. First installment"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="h-[62px] rounded-[18px] border border-[#d3dbe6] text-[20px] font-bold"
                onClick={() => setPaymentOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-[62px] rounded-[18px] bg-[#17bd82] text-[20px] font-bold text-white disabled:bg-[#8bdcbd]"
                disabled={saving}
                onClick={() => void submitPayment()}
              >
                {saving ? "Recording..." : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download / Share invoice */}
      {invoice && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              downloadInvoiceReceipt({
                invoiceNo: invoice.id.slice(-4).toUpperCase(),
                businessName: "Mikama Services",
                customerName: invoice.customerName,
                customerPhone: invoice.customerPhone,
                issueDate: invoice.createdAt,
                dueDate: invoice.dueDate,
                items: invoice.items.map((item) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
                subtotal: invoice.subtotal,
                amountPaid: invoice.amountPaid,
                balance: invoice.balance,
                status: invoice.status,
              })
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#f1f5f9] py-4 text-[17px] font-bold text-[#334155]"
          >
            <Download className="size-5" />
            Download
          </button>
          <button
            type="button"
            onClick={() =>
              shareInvoiceReceipt({
                invoiceNo: invoice.id.slice(-4).toUpperCase(),
                businessName: "Mikama Services",
                customerName: invoice.customerName,
                customerPhone: invoice.customerPhone,
                issueDate: invoice.createdAt,
                dueDate: invoice.dueDate,
                items: invoice.items.map((item) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
                subtotal: invoice.subtotal,
                amountPaid: invoice.amountPaid,
                balance: invoice.balance,
                status: invoice.status,
              })
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#1557df] py-4 text-[17px] font-bold text-white"
          >
            <Share2 className="size-5" />
            Share
          </button>
        </div>
      )}
    </div>
  );
}

function DateBlock({
  label,
  value,
  alignRight,
}: {
  label: string;
  value: string;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "text-right" : undefined}>
      <p className="flex items-center gap-2 text-[16px] text-[#526075]">
        {!alignRight && <CalendarDays className="size-4" />}
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold text-[#071122]">{formatDate(value)}</p>
    </div>
  );
}

function InvoiceTotalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "paid" | "due";
}) {
  return (
    <div className="flex items-center justify-between text-[21px]">
      <span className={tone === "due" ? "text-[#ef3b42]" : "text-[#334155]"}>
        {label}
      </span>
      <span
        className={cn(
          "font-extrabold",
          tone === "paid" && "text-[#10b981]",
          tone === "due" && "text-[#ef3b42]",
        )}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}

function MiniTotal({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "paid" | "due";
}) {
  return (
    <div className="px-2">
      <p className="text-[14px] font-bold uppercase text-[#64748b]">{label}</p>
      <p
        className={cn(
          "mt-1 text-[19px] font-extrabold text-[#071122]",
          tone === "paid" && "text-[#10b981]",
          tone === "due" && "text-[#ef3b42]",
        )}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Invoice["status"] }) {
  const styles = {
    PAID: "bg-[#dffbea] text-[#0f9f68]",
    PENDING: "bg-[#fff0d4] text-[#d98900]",
    OVERDUE: "bg-[#ffe4e6] text-[#ef3b42]",
  }[status];

  return (
    <span className={cn("rounded-full px-4 py-2 text-[16px] font-bold", styles)}>
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
