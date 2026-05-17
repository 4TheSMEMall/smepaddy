"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import { listInvoices, type Invoice, type InvoiceSummary } from "@/lib/invoiceApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

type InvoiceFilter = "All" | "Paid" | "Pending" | "Overdue";

const emptySummary: InvoiceSummary = { paid: 0, pending: 0, overdue: 0 };

export function InvoicesScreen({
  onNewInvoice,
  onSelectInvoice,
  refreshKey = 0,
}: {
  onNewInvoice: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  refreshKey?: number;
}) {
  const [activeFilter, setActiveFilter] = useState<InvoiceFilter>("All");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoices() {
      const token = getStoredAccessToken();
      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const cacheKey = makeCacheKey(token, "invoices");
      const cached = readClientCache<{
        invoices: Invoice[];
        summary: InvoiceSummary;
      }>(cacheKey);
      if (cached) {
        setInvoices(cached.value.invoices);
        setSummary(cached.value.summary);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await listInvoices(token, { limit: 50 });
        if (!cancelled) {
          setInvoices(response.invoices);
          setSummary(response.summary);
          writeClientCache(cacheKey, response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Unable to load invoices right now.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInvoices();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredInvoices = useMemo(() => {
    if (activeFilter === "All") return invoices;
    return invoices.filter((invoice) => invoice.status === activeFilter.toUpperCase());
  }, [activeFilter, invoices]);

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[33px] font-extrabold text-[#071122]">Invoices</h2>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="h-12 rounded-3xl px-4 text-[#94a3b8]"
          >
            <Download />
            Export
          </Button>
          <Button size="sm" className="h-12 rounded-3xl px-5" onClick={onNewInvoice}>
            <Plus />
            New
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <InvoiceStat
          tone="paid"
          icon={<CheckCircle2 className="size-6" />}
          label="PAID"
          value={formatMoney(summary.paid)}
          onClick={() => setActiveFilter("Paid")}
        />
        <InvoiceStat
          tone="pending"
          icon={<Clock3 className="size-6" />}
          label="PENDING"
          value={formatMoney(summary.pending)}
          onClick={() => setActiveFilter("Pending")}
        />
        <InvoiceStat
          tone="overdue"
          icon={<AlertTriangle className="size-6" />}
          label="OVERDUE"
          value={formatMoney(summary.overdue)}
          onClick={() => setActiveFilter("Overdue")}
        />
      </div>

      <div className="mb-7 flex flex-wrap gap-3">
        {(["All", "Paid", "Pending", "Overdue"] as InvoiceFilter[]).map((filter) => (
          <button
            key={filter}
            className={cn(
              "h-[56px] rounded-2xl border border-[#d9e0ea] bg-white px-6 text-[22px] font-semibold text-[#526075] shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
              activeFilter === filter &&
                "border-[#2563eb] bg-[#2563eb] text-white shadow-[0_2px_5px_rgba(37,99,235,0.28)]",
            )}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading && <InvoiceMessage title="Loading invoices..." />}
      {error && !loading && <InvoiceMessage title={error} />}
      {!loading && !error && filteredInvoices.length === 0 && (
        <InvoiceMessage
          title={invoices.length === 0 ? "No invoices yet" : "No invoices found"}
          text={
            invoices.length === 0
              ? "Create a professional invoice and send it to your customer"
              : "Try another invoice filter."
          }
          action={invoices.length === 0 ? onNewInvoice : undefined}
        />
      )}
      {!loading && !error && filteredInvoices.length > 0 && (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onClick={() => onSelectInvoice(invoice.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceCard({
  invoice,
  onClick,
}: {
  invoice: Invoice;
  onClick: () => void;
}) {
  return (
    <button type="button" className="block w-full text-left" onClick={onClick}>
    <Card className="px-6 py-5 transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-[#f0f4ff] text-[#9bbcff]">
            <FileText className="size-7" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[24px] font-extrabold text-[#071122]">
              {invoice.customerName}
            </h3>
            <p className="mt-1 text-[18px] text-[#64748b]">
              {invoice.items[0]?.description ?? "Invoice"} • Due {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[24px] font-extrabold text-[#2563eb]">
            {formatMoney(invoice.subtotal)}
          </p>
          <StatusPill status={invoice.status} />
        </div>
      </div>
      {invoice.balance > 0 && (
        <div className="mt-4 rounded-2xl bg-[#fff7ed] px-4 py-3 text-[18px] font-semibold text-[#c2410c]">
          Balance due: {formatMoney(invoice.balance)}
        </div>
      )}
    </Card>
    </button>
  );
}

function StatusPill({ status }: { status: Invoice["status"] }) {
  const styles = {
    PAID: "bg-[#dffbea] text-[#0f9f68]",
    PENDING: "bg-[#fff0d4] text-[#d98900]",
    OVERDUE: "bg-[#ffe4e6] text-[#ef3b42]",
  }[status];

  return (
    <span className={cn("mt-2 inline-flex rounded-full px-3 py-1 text-[15px] font-bold", styles)}>
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}

function InvoiceMessage({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: () => void;
}) {
  return (
    <Card className="grid min-h-[426px] place-items-center px-6 text-center">
      <div className="max-w-[430px]">
        <div className="mx-auto grid size-[82px] place-items-center rounded-[22px] bg-[#f0f4ff] text-[#9bbcff]">
          <FileText className="size-10" />
        </div>
        <h3 className="mt-8 text-[29px] font-extrabold text-[#071122]">
          {title}
        </h3>
        {text && <p className="mt-4 text-[22px] leading-8 text-[#334155]">{text}</p>}
        {action && (
          <Button className="mt-8 h-[72px] rounded-[18px] px-9" onClick={action}>
            Create Invoice
          </Button>
        )}
      </div>
    </Card>
  );
}

function InvoiceStat({
  tone,
  icon,
  label,
  value,
  onClick,
}: {
  tone: "paid" | "pending" | "overdue";
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  const toneClass = {
    paid: "border-[#bff4df] bg-[#eafff5] text-[#10b981]",
    pending: "border-[#fde8a9] bg-[#fffbea] text-[#d97706]",
    overdue: "border-[#ffd1d6] bg-[#fff0f1] text-[#ef4444]",
  }[tone];

  return (
    <button
      type="button"
      className={cn(
        "grid h-[150px] place-items-center rounded-[24px] border text-center",
        toneClass,
      )}
      onClick={onClick}
    >
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-current/10">
          {icon}
        </span>
        <p className="mt-4 text-[16px] font-bold tracking-wide text-[#526075]">
          {label}
        </p>
        <p className="mt-2 text-[23px] font-extrabold">{value}</p>
      </div>
    </button>
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
