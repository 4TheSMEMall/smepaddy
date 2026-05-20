"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Share2,
  ShoppingBag,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { IconBubble } from "@/components/dashboard/IconBubble";
import { getInvoice, type Invoice } from "@/lib/invoiceApi";
import { downloadSaleReceipt, shareSaleReceipt } from "@/lib/receiptGenerator";
import type { PaymentStatus, SaleListItem } from "@/lib/salesApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types/dashboard";

export function TransactionDetailScreen({
  sale,
  onBack,
  onOpenInvoice,
  onOpenCustomer,
  businessName,
}: {
  sale: SaleListItem;
  onBack: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
  onOpenCustomer?: (customerId: string) => void;
  businessName?: string;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  // When the sale is linked to an invoice, fetch it immediately so the
  // status badge reflects the live invoice state — not the stale sale field.
  useEffect(() => {
    if (!sale.invoiceId) return;
    const token = getStoredAccessToken();
    if (!token) return;

    getInvoice(token, sale.invoiceId)
      .then((res) => setInvoice(res.invoice))
      .catch(() => {/* fallback to sale data below */});
  }, [sale.invoiceId]);

  const displayAmount = sale.amountPaid > 0 ? sale.amountPaid : sale.subtotal;
  const itemLabel = sale.itemNames.length > 0 ? sale.itemNames.join(", ") : "Sale";

  // Invoice is the source of truth for payment status.
  // Fall back to sale data only when there's no linked invoice.
  const effectiveStatus: PaymentStatus = invoice
    ? invoice.balance <= 0
      ? "PAID"
      : invoice.amountPaid > 0
        ? "PART_PAYMENT"
        : "WILL_PAY_LATER"
    : sale.balance <= 0
      ? "PAID"
      : sale.paymentStatus;

  return (
    <div className="space-y-5 pb-8">
      <button className="grid size-10 place-items-center rounded-full bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)]" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>

      {/* Hero card — gradient with decorative background circles */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0aab72] to-[#067352] px-5 py-7 text-white shadow-[0_14px_36px_rgba(7,115,82,0.28)] sm:rounded-[28px] sm:px-7 sm:py-9">
        <div className="pointer-events-none absolute -right-10 -top-10 size-[180px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 size-[140px] rounded-full bg-white/[0.07]" />

        <div className="relative">
          <div className="mb-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[16px] font-bold backdrop-blur-sm">
              <ShoppingBag className="size-4" />
              Product Sale
            </span>
          </div>

          <p className="break-words text-center text-[34px] font-extrabold leading-none tracking-tight sm:text-[54px]">
            +{formatMoney(displayAmount)}
          </p>
          <p className="mt-3 text-center text-[14px] font-semibold text-white/70 sm:text-[18px]">
            {formatFullDate(sale.createdAt)}
          </p>
        </div>
      </div>

      {/* Detail rows grouped in one card */}
      <div className="rounded-[22px] bg-white px-4 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.07)] sm:rounded-[24px] sm:px-6">
        <DetailRow
          icon={<ShoppingBag className="size-5" />}
          tone="green"
          label="Item / Service"
          value={itemLabel}
        />
        {sale.customerName && (
          <DetailRow
            icon={<User className="size-5" />}
            tone="blue"
            label="Customer"
            value={
              sale.customerId && onOpenCustomer ? (
                <button
                  type="button"
                  onClick={() => onOpenCustomer(sale.customerId!)}
                  className="flex items-center gap-1.5 text-[#1557df] underline underline-offset-2"
                >
                  {sale.customerName}
                  <ChevronRight className="size-3.5" />
                </button>
              ) : (
                sale.customerName
              )
            }
          />
        )}
        <DetailRow
          icon={<CreditCard className="size-5" />}
          tone="amber"
          label="Payment"
          value={
            <span className="flex items-center gap-3">
              <span>
                {sale.paymentMethod ? formatMethod(sale.paymentMethod) : "–"}
              </span>
              <StatusBadge status={effectiveStatus} />
            </span>
          }
        />
        <DetailRow
          icon={<CalendarDays className="size-5" />}
          tone="slate"
          label="Date"
          value={formatFullDate(sale.createdAt)}
          last
        />
      </div>

      {/* Linked invoice — tappable card that opens the full invoice */}
      {sale.invoiceId && (
        <button
          type="button"
          className="w-full rounded-[22px] bg-white px-4 py-5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.07)] transition-transform duration-100 active:scale-[0.98] sm:rounded-[24px] sm:px-6"
          onClick={() => onOpenInvoice?.(sale.invoiceId!)}
        >
          <p className="mb-4 text-[14px] font-bold uppercase tracking-wide text-[#94a3b8]">
            Linked Invoice
          </p>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-[#eef4ff] text-[#2563eb] sm:size-[52px] sm:rounded-[18px]">
              <FileText className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-extrabold text-[#071122] sm:text-[22px]">
                INV-{sale.invoiceId.slice(-4).toUpperCase()}
              </p>
              <p className="break-words text-[14px] text-[#526075] sm:text-[17px]">{formatMoney(sale.subtotal)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <StatusBadge status={effectiveStatus} />
              {onOpenInvoice && (
                <ChevronRight className="size-5 shrink-0 text-[#94a3b8]" />
              )}
            </div>
          </div>
        </button>
      )}

      {/* Download / Share receipt */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() =>
            downloadSaleReceipt({
              receiptNo: sale.id.slice(-6).toUpperCase(),
              businessName: businessName ?? "SME Paddy",
              date: sale.createdAt,
              customerName: sale.customerName,
              items: sale.itemNames.map((name) => ({ name })),
              subtotal: sale.subtotal,
              amountPaid: sale.amountPaid,
              balance: sale.balance,
              paymentMethod: sale.paymentMethod ?? undefined,
              paymentStatus: effectiveStatus,
            })
          }
          className="flex min-h-12 items-center justify-center gap-2 rounded-[16px] bg-[#f1f5f9] px-3 py-3 text-[15px] font-bold text-[#334155] sm:py-4 sm:text-[17px]"
        >
          <Download className="size-5" />
          Download
        </button>
        <button
          type="button"
          onClick={() =>
            shareSaleReceipt({
              receiptNo: sale.id.slice(-6).toUpperCase(),
              businessName: businessName ?? "SME Paddy",
              date: sale.createdAt,
              customerName: sale.customerName,
              items: sale.itemNames.map((name) => ({ name })),
              subtotal: sale.subtotal,
              amountPaid: sale.amountPaid,
              balance: sale.balance,
              paymentMethod: sale.paymentMethod ?? undefined,
              paymentStatus: effectiveStatus,
            })
          }
          className="flex min-h-12 items-center justify-center gap-2 rounded-[16px] bg-[#1557df] px-3 py-3 text-[15px] font-bold text-white sm:py-4 sm:text-[17px]"
        >
          <Share2 className="size-5" />
          Share
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  tone,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-4 sm:items-center sm:gap-4 sm:py-5",
        !last && "border-b border-[#f0f4f9]",
      )}
    >
      <IconBubble tone={tone}>{icon}</IconBubble>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#94a3b8]">
          {label}
        </p>
        <div className="mt-0.5 break-words text-[15px] font-semibold text-[#0f172a] sm:text-[20px]">
          {value}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    PAID: "bg-[#dffbea] text-[#0f9f68]",
    PART_PAYMENT: "bg-[#fff0d4] text-[#d98900]",
    WILL_PAY_LATER: "bg-[#ffe4e6] text-[#ef3b42]",
  };
  const labels: Record<PaymentStatus, string> = {
    PAID: "Paid",
    PART_PAYMENT: "Partial",
    WILL_PAY_LATER: "Credit",
  };

  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold sm:px-3 sm:text-[14px]", styles[status])}>
      {labels[status]}
    </span>
  );
}

function formatMethod(method: string) {
  return method[0] + method.slice(1).toLowerCase();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
