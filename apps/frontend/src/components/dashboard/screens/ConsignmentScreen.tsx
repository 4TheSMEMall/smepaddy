"use client";

import { ArrowDownRight, CheckCircle2, ChevronRight, Package, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import {
  listConsignmentSuppliers,
  type ConsignmentOverview,
  type ConsignmentSupplierRow,
} from "@/lib/consignmentApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export function ConsignmentScreen({
  refreshKey,
  onAddSupplier,
  onSelectSupplier,
}: {
  refreshKey: number;
  onAddSupplier: () => void;
  onSelectSupplier: (supplierId: string) => void;
}) {
  const [overview, setOverview] = useState<ConsignmentOverview | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadConsignment() {
      const token = getStoredAccessToken();
      if (!token) { setError("Session expired."); setLoading(false); return; }
      const cacheKey = makeCacheKey(token, "consignment-overview");
      const cached = readClientCache<ConsignmentOverview>(cacheKey);
      if (cached) { setOverview(cached.value); setLoading(false); }
      else setLoading(true);
      setError(null);
      try {
        const result = await listConsignmentSuppliers(token);
        if (!cancelled) { setOverview(result); writeClientCache(cacheKey, result); }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load consignment.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void loadConsignment();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const suppliers = useMemo(() => {
    const rows = overview?.suppliers ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((s) =>
      [s.name, s.phone, s.email].filter(Boolean).some((v) => v?.toLowerCase().includes(term)),
    );
  }, [overview?.suppliers, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-extrabold text-[#071122] sm:text-[31px]">Consignment</h2>
          <p className="mt-0.5 text-[13px] text-[#8b99b3] sm:text-[18px]">
            {overview?.summary.supplierCount ?? 0} supplier{(overview?.summary.supplierCount ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="h-10 rounded-2xl px-3 text-[13px] sm:h-12 sm:rounded-3xl sm:px-5 sm:text-[18px]" onClick={onAddSupplier}>
          <Plus className="size-4" />
          Add Supplier
        </Button>
      </div>

      {/* Summary card */}
      {overview && overview.summary.outstanding === 0 && overview.summary.itemCount > 0 ? (
        <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] px-5 py-5 shadow-[0_4px_16px_rgba(5,150,105,0.12)]">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#059669] text-white shadow-[0_4px_12px_rgba(5,150,105,0.3)]">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#059669]">All Settled</p>
              <p className="truncate text-[16px] font-extrabold text-[#065f46] sm:text-[18px]">
                {overview.summary.itemCount} item{overview.summary.itemCount !== 1 ? "s" : ""} fully settled
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#fff1f2] to-[#ffe4e6] px-5 py-5 shadow-[0_4px_16px_rgba(239,59,66,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#ef3b42] text-white shadow-[0_4px_12px_rgba(239,59,66,0.3)]">
                <ArrowDownRight className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[#94a3b8]">Total Outstanding</p>
                <p className="break-words text-[20px] font-extrabold text-[#ef3b42] sm:text-[24px]">
                  {formatMoney(overview?.summary.outstanding ?? 0)}
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-[12px] bg-white/60 px-3 py-2 text-center">
              <p className="text-[11px] font-bold uppercase text-[#94a3b8]">Items</p>
              <p className="text-[18px] font-extrabold text-[#071122]">{overview?.summary.itemCount ?? 0}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#fecdd3] pt-3">
            <span className="text-[13px] text-[#94a3b8]">Total settled</span>
            <span className="text-[15px] font-bold text-[#059669]">
              {formatMoney(overview?.summary.totalSettled ?? 0)}
            </span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex h-12 items-center gap-3 rounded-[14px] border border-[#dce3ec] bg-white px-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] sm:h-16 sm:rounded-[17px]">
        <Search className="size-5 shrink-0 text-[#91a0b7]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers..."
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#94a3b8] sm:text-[20px]"
        />
      </div>

      {/* States */}
      {loading && !overview && (
        <div className="flex h-32 items-center justify-center text-[15px] text-[#94a3b8]">
          Loading...
        </div>
      )}
      {error && <p className="rounded-[14px] bg-[#fff0f0] px-4 py-3 text-[14px] font-semibold text-red-600">{error}</p>}
      {!loading && suppliers.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[20px] bg-white px-6 py-10 text-center shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="grid size-14 place-items-center rounded-[18px] bg-[#f1f5f9]">
            <Package className="size-7 text-[#94a3b8]" />
          </div>
          <p className="text-[16px] font-extrabold text-[#071122]">No consignment suppliers yet</p>
          <p className="text-[13px] text-[#64748b]">Add a supplier, then link consignment stock to them.</p>
        </div>
      )}

      {/* Supplier list */}
      <div className="space-y-3">
        {suppliers.map((supplier) => (
          <SupplierRow key={supplier.id} supplier={supplier} onClick={() => onSelectSupplier(supplier.id)} />
        ))}
      </div>
    </div>
  );
}

function SupplierRow({ supplier, onClick }: { supplier: ConsignmentSupplierRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[18px] bg-white px-4 py-4 text-left shadow-[0_2px_12px_rgba(15,23,42,0.07)] active:scale-[0.98] transition-transform"
    >
      {/* Avatar */}
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#fff4dc] text-[16px] font-extrabold text-[#e28a00] sm:size-[60px] sm:rounded-[18px] sm:text-[22px]">
        {supplier.name.slice(0, 1).toUpperCase()}
      </span>

      {/* Name + meta */}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-extrabold text-[#071122] sm:text-[20px]">
            {supplier.name}
          </span>
          <span className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
            supplier.status === "PARTIAL"
              ? "bg-[#fff3d7] text-[#f59e0b]"
              : "bg-[#d1fae5] text-[#059669]",
          )}>
            {supplier.status === "PARTIAL" ? "Partial" : "Settled"}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-[#8b99b3] sm:text-[15px]">
          {supplier.phone ?? "No phone"} · {supplier.itemCount} item{supplier.itemCount !== 1 ? "s" : ""}
        </span>
      </span>

      {/* Amount */}
      <span className="shrink-0 text-right">
        <span className={cn(
          "block text-[15px] font-extrabold sm:text-[20px]",
          supplier.outstanding === 0 ? "text-[#059669]" : "text-[#ef3b42]",
        )}>
          {formatMoney(supplier.outstanding)}
        </span>
      </span>

      <ChevronRight className="size-4 shrink-0 text-[#c1cad8] sm:size-5" />
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
