"use client";

import { ArrowDownRight, CheckCircle2, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import {
  listConsignmentSuppliers,
  type ConsignmentOverview,
  type ConsignmentSupplierRow,
} from "@/lib/consignmentApi";
import { getStoredAccessToken } from "@/lib/session";

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
      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const cacheKey = makeCacheKey(token, "consignment-overview");
      const cached = readClientCache<ConsignmentOverview>(cacheKey);
      if (cached) {
        setOverview(cached.value);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await listConsignmentSuppliers(token);
        if (!cancelled) {
          setOverview(result);
          writeClientCache(cacheKey, result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Unable to load consignment.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConsignment();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const suppliers = useMemo(() => {
    const rows = overview?.suppliers ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((supplier) =>
      [supplier.name, supplier.phone, supplier.email]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [overview?.suppliers, search]);

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[31px] font-extrabold text-[#071122]">
            Consignment
          </h2>
          <p className="mt-1 text-[18px] text-[#8b99b3]">
            {overview?.summary.supplierCount ?? 0} supplier
            {(overview?.summary.supplierCount ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <Button className="h-12 rounded-3xl px-5 text-[18px]" onClick={onAddSupplier}>
          <Plus className="size-5" />
          Add Supplier
        </Button>
      </div>

      {overview && overview.summary.outstanding === 0 && overview.summary.itemCount > 0 ? (
        <Card className="mb-5 border-[#c6f0de] bg-[#f0fdf7] px-6 py-6">
          <div className="flex items-center gap-4">
            <span className="grid size-[58px] place-items-center rounded-[18px] bg-[#d1fae5] text-[#059669]">
              <CheckCircle2 className="size-7" />
            </span>
            <div className="flex-1">
              <p className="text-[18px] font-semibold text-[#059669]">All Settled</p>
              <p className="text-[22px] font-extrabold text-[#065f46]">
                {overview.summary.itemCount} consignment item
                {overview.summary.itemCount === 1 ? "" : "s"} fully settled
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-5 border-[#f1dbe0] bg-[#fff8f8] px-6 py-6">
          <div className="flex items-center gap-4">
            <span className="grid size-[58px] place-items-center rounded-[18px] bg-[#ffe1e5] text-[#ef3b42]">
              <ArrowDownRight className="size-7" />
            </span>
            <div className="flex-1">
              <p className="text-[18px] font-semibold text-[#64748b]">
                Total Outstanding
              </p>
              <p className="text-[29px] font-extrabold text-[#ef3b42]">
                {formatMoney(overview?.summary.outstanding ?? 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-semibold uppercase text-[#91a0b7]">Items</p>
              <p className="text-[24px] font-bold text-[#17233a]">
                {overview?.summary.itemCount ?? 0}
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-[#f3e2e6] pt-4">
            <span className="text-[18px] text-[#91a0b7]">Total settled</span>
            <span className="text-[20px] font-bold text-[#05a970]">
              {formatMoney(overview?.summary.totalSettled ?? 0)}
            </span>
          </div>
        </Card>
      )}

      <label className="mb-5 flex h-16 items-center gap-3 rounded-[17px] border border-[#dce3ec] bg-white px-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
        <Search className="size-6 text-[#91a0b7]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search suppliers..."
          className="h-full min-w-0 flex-1 bg-transparent text-[20px] outline-none placeholder:text-[#64748b]"
        />
      </label>

      {loading && !overview && (
        <Card className="grid min-h-[180px] place-items-center text-[19px] text-[#64748b]">
          Loading consignment...
        </Card>
      )}
      {error && <p className="mb-4 text-[17px] font-semibold text-red-600">{error}</p>}
      {!loading && suppliers.length === 0 && (
        <Card className="px-6 py-8 text-center">
          <h3 className="text-[22px] font-extrabold text-[#071122]">
            No consignment suppliers yet
          </h3>
          <p className="mt-2 text-[18px] text-[#64748b]">
            Add a supplier, then link consignment stock to them.
          </p>
        </Card>
      )}
      <div className="space-y-4">
        {suppliers.map((supplier) => (
          <SupplierRow
            key={supplier.id}
            supplier={supplier}
            onClick={() => onSelectSupplier(supplier.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SupplierRow({
  supplier,
  onClick,
}: {
  supplier: ConsignmentSupplierRow;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-[118px] w-full items-center gap-4 rounded-[18px] border border-[#e3e8f0] bg-white px-5 py-5 text-left shadow-[0_2px_5px_rgba(15,23,42,0.09)]"
      onClick={onClick}
    >
      <span className="grid size-[60px] shrink-0 place-items-center rounded-[18px] bg-[#fff4dc] text-[22px] font-extrabold text-[#e28a00]">
        {supplier.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[22px] font-extrabold text-[#071122]">
            {supplier.name}
          </span>
          {supplier.status === "PARTIAL" ? (
            <span className="rounded-full bg-[#fff3d7] px-2.5 py-1 text-[13px] font-bold text-[#f59e0b]">
              Partial
            </span>
          ) : (
            <span className="rounded-full bg-[#d1fae5] px-2.5 py-1 text-[13px] font-bold text-[#059669]">
              Settled
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-[17px] text-[#8b99b3]">
          {supplier.phone ?? "No phone"} · {supplier.itemCount} item
          {supplier.itemCount === 1 ? "" : "s"}
        </span>
      </span>
      <span className="text-right">
        <span className={`block text-[22px] font-extrabold ${supplier.outstanding === 0 ? "text-[#059669]" : "text-[#ef3b42]"}`}>
          {formatMoney(supplier.outstanding)}
        </span>
      </span>
      <ChevronRight className="size-6 shrink-0 text-[#c1cad8]" />
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
