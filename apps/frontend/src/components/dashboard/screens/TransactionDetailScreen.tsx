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
}: {
  sale: SaleListItem;
  onBack: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
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
    <div className="mx-4 space-y-5 pb-8 sm:mx-0">
      <button className="grid size-9 place-items-center" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>

      {/* Hero card — gradient with decorative background circles */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0aab72] to-[#067352] px-7 py-9 text-white shadow-[0_14px_36px_rgba(7,115,82,0.28)]">
        <div className="pointer-events-none absolute -right-10 -top-10 size-[180px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 size-[140px] rounded-full bg-white/[0.07]" />

        <div className="relative">
          <div className="mb-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[16px] font-bold backdrop-blur-sm">
              <ShoppingBag className="size-4" />
              Product Sale
            </span>
          </div>

          <p className="text-center text-[54px] font-extrabold leading-none tracking-tight">
            +{formatMoney(displayAmount)}
          </p>
          <p className="mt-3 text-center text-[18px] font-semibold text-white/70">
            {formatFullDate(sale.createdAt)}
          </p>
        </div>
      </div>

      {/* Detail rows grouped in one card */}
      <div className="rounded-[24px] bg-white px-6 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
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
            value={sale.customerName}
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
          className="w-full rounded-[24px] bg-white px-6 py-5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.07)] active:scale-[0.98] transition-transform duration-100"
          onClick={() => onOpenInvoice?.(sale.invoiceId!)}
        >
          <p className="mb-4 text-[14px] font-bold uppercase tracking-wide text-[#94a3b8]">
            Linked Invoice
          </p>
          <div className="flex items-center gap-4">
            <span className="grid size-[52px] shrink-0 place-items-center rounded-[18px] bg-[#eef4ff] text-[#2563eb]">
              <FileText className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-extrabold text-[#071122]">
                INV-{sale.invoiceId.slice(-4).toUpperCase()}
              </p>
              <p className="text-[17px] text-[#526075]">{formatMoney(sale.subtotal)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={effectiveStatus} />
              {onOpenInvoice && (
                <ChevronRight className="size-5 shrink-0 text-[#94a3b8]" />
              )}
            </div>
          </div>
        </button>
      )}

      {/* Download / Share receipt */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() =>
            downloadSaleReceipt({
              receiptNo: sale.id.slice(-6).toUpperCase(),
              businessName: "Mikama Services",
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
          className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#f1f5f9] py-4 text-[17px] font-bold text-[#334155]"
        >
          <Download className="size-5" />
          Download
        </button>
        <button
          type="button"
          onClick={() =>
            shareSaleReceipt({
              receiptNo: sale.id.slice(-6).toUpperCase(),
              businessName: "Mikama Services",
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
          className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#1557df] py-4 text-[17px] font-bold text-white"
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
        "flex items-center gap-4 py-5",
        !last && "border-b border-[#f0f4f9]",
      )}
    >
      <IconBubble tone={tone}>{icon}</IconBubble>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#94a3b8]">
          {label}
        </p>
        <div className="mt-0.5 text-[20px] font-semibold text-[#0f172a]">
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
    <span className={cn("rounded-full px-3 py-1 text-[14px] font-bold", styles[status])}>
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
