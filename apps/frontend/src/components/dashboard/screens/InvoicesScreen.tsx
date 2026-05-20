"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
      if (!token) { setError("Session expired."); setLoading(false); return; }
      const cacheKey = makeCacheKey(token, "invoices");
      const cached = readClientCache<{ invoices: Invoice[]; summary: InvoiceSummary }>(cacheKey);
      if (cached) { setInvoices(cached.value.invoices); setSummary(cached.value.summary); setLoading(false); }
      else setLoading(true);
      setError(null);
      try {
        const response = await listInvoices(token, { limit: 50 });
        if (!cancelled) {
          setInvoices(response.invoices);
          setSummary(response.summary);
          writeClientCache(cacheKey, response);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load invoices.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void loadInvoices();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filteredInvoices = useMemo(() => {
    if (activeFilter === "All") return invoices;
    return invoices.filter((inv) => inv.status === activeFilter.toUpperCase());
  }, [activeFilter, invoices]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[24px] font-extrabold text-[#071122] sm:text-[33px]">Invoices</h2>
        <Button size="sm" className="h-10 rounded-2xl px-3 text-[13px] sm:h-12 sm:rounded-3xl sm:px-5 sm:text-[18px]" onClick={onNewInvoice}>
          <Plus className="size-4" />
          New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          tone="paid"
          icon={<CheckCircle2 className="size-5" />}
          label="Paid"
          value={formatMoney(summary.paid)}
          active={activeFilter === "Paid"}
          onClick={() => setActiveFilter(activeFilter === "Paid" ? "All" : "Paid")}
        />
        <StatCard
          tone="pending"
          icon={<Clock3 className="size-5" />}
          label="Pending"
          value={formatMoney(summary.pending)}
          active={activeFilter === "Pending"}
          onClick={() => setActiveFilter(activeFilter === "Pending" ? "All" : "Pending")}
        />
        <StatCard
          tone="overdue"
          icon={<AlertTriangle className="size-5" />}
          label="Overdue"
          value={formatMoney(summary.overdue)}
          active={activeFilter === "Overdue"}
          onClick={() => setActiveFilter(activeFilter === "Overdue" ? "All" : "Overdue")}
        />
      </div>

      {/* Filter pills */}
      <div className="-mx-4 sm:mx-0">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0 sm:flex-wrap"
          style={{ scrollbarWidth: "none" }}>
          {(["All", "Paid", "Pending", "Overdue"] as InvoiceFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-all duration-200 sm:h-10 sm:text-[15px]",
                activeFilter === f
                  ? "bg-[#1557df] text-white shadow-[0_4px_12px_rgba(21,87,223,0.3)]"
                  : "bg-white text-[#64748b] shadow-[0_1px_4px_rgba(15,23,42,0.08)]",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading && (
        <div className="flex h-32 items-center justify-center text-[14px] text-[#94a3b8]">
          Loading invoices...
        </div>
      )}
      {error && !loading && (
        <div className="rounded-[14px] bg-[#fff0f0] px-4 py-3 text-[14px] font-semibold text-red-600">{error}</div>
      )}
      {!loading && !error && filteredInvoices.length === 0 && (
        <EmptyState isEmpty={invoices.length === 0} onNew={onNewInvoice} />
      )}
      {!loading && !error && filteredInvoices.length > 0 && (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} onClick={() => onSelectInvoice(invoice.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  tone, icon, label, value, active, onClick,
}: {
  tone: "paid" | "pending" | "overdue";
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  const colors = {
    paid:    { bg: "bg-[#ecfdf5]", icon: "bg-[#059669] text-white", text: "text-[#059669]", activeBg: "bg-[#059669]" },
    pending: { bg: "bg-[#fffbeb]", icon: "bg-[#d97706] text-white", text: "text-[#d97706]", activeBg: "bg-[#d97706]" },
    overdue: { bg: "bg-[#fff1f2]", icon: "bg-[#ef3b42] text-white", text: "text-[#ef3b42]", activeBg: "bg-[#ef3b42]" },
  }[tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 overflow-hidden rounded-[16px] p-3 text-left transition-all duration-200 sm:rounded-[20px] sm:p-4",
        active ? `${colors.activeBg} shadow-[0_6px_20px_rgba(0,0,0,0.2)]` : colors.bg,
      )}
    >
      <div className={cn(
        "grid size-8 place-items-center rounded-[10px] sm:size-10 sm:rounded-[12px]",
        active ? "bg-white/25" : colors.icon,
      )}>
        {icon}
      </div>
      <div className="min-w-0 w-full">
        <p className={cn(
          "text-[10px] font-bold uppercase tracking-wide sm:text-[12px]",
          active ? "text-white/70" : "text-[#94a3b8]",
        )}>
          {label}
        </p>
        <p className={cn(
          "mt-0.5 truncate text-[12px] font-extrabold leading-tight sm:text-[15px]",
          active ? "text-white" : colors.text,
        )}>
          {value}
        </p>
      </div>
    </button>
  );
}

// ─── Invoice card ─────────────────────────────────────────────────────────────

function InvoiceCard({ invoice, onClick }: { invoice: Invoice; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_2px_12px_rgba(15,23,42,0.07)] active:scale-[0.98] transition-transform"
    >
      {/* Status accent strip */}
      <div className={cn(
        "h-1 w-full",
        invoice.status === "PAID" ? "bg-[#059669]" :
        invoice.status === "OVERDUE" ? "bg-[#ef3b42]" : "bg-[#d97706]",
      )} />

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[13px] sm:size-12 sm:rounded-[15px]",
              invoice.status === "PAID" ? "bg-[#ecfdf5] text-[#059669]" :
              invoice.status === "OVERDUE" ? "bg-[#fff1f2] text-[#ef3b42]" : "bg-[#fffbeb] text-[#d97706]",
            )}>
              <FileText className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold text-[#071122] sm:text-[20px]">
                {invoice.customerName}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-[#94a3b8] sm:text-[15px]">
                {invoice.items[0]?.description ?? "Invoice"} · Due {formatDate(invoice.dueDate)}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[15px] font-extrabold text-[#071122] sm:text-[20px]">
              {formatMoney(invoice.subtotal)}
            </p>
            <StatusPill status={invoice.status} />
          </div>
        </div>

        {invoice.balance > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-[10px] bg-[#fff7ed] px-3 py-2 sm:rounded-[12px] sm:px-4">
            <span className="text-[12px] font-semibold text-[#92400e] sm:text-[14px]">Balance due</span>
            <span className="text-[13px] font-extrabold text-[#c2410c] sm:text-[16px]">
              {formatMoney(invoice.balance)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: Invoice["status"] }) {
  const styles = {
    PAID:    "bg-[#dffbea] text-[#0f9f68]",
    PENDING: "bg-[#fff0d4] text-[#d98900]",
    OVERDUE: "bg-[#ffe4e6] text-[#ef3b42]",
  }[status];

  return (
    <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold sm:px-2.5 sm:text-[13px]", styles)}>
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}

function EmptyState({ isEmpty, onNew }: { isEmpty: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <div className="grid size-16 place-items-center rounded-[20px] bg-[#f0f4ff]">
        <FileText className="size-8 text-[#9bbcff]" />
      </div>
      <div>
        <p className="text-[18px] font-extrabold text-[#071122]">
          {isEmpty ? "No invoices yet" : "No invoices found"}
        </p>
        <p className="mt-1 text-[13px] text-[#64748b]">
          {isEmpty ? "Create a professional invoice and send it to your customer" : "Try another filter"}
        </p>
      </div>
      {isEmpty && (
        <Button className="h-11 rounded-[14px] px-6 text-[14px]" onClick={onNew}>
          Create Invoice
        </Button>
      )}
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(new Date(iso));
}
