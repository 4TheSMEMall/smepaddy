"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Handshake,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import { getStoredAccessToken } from "@/lib/session";
import { listStockItems, type StockItem } from "@/lib/stockApi";
import { cn } from "@/lib/utils";

type StockFilter = "all" | "owned" | "consignment" | "restock";

export function StockScreen({
  onAddItem,
  onSelectItem,
  refreshKey,
}: {
  onAddItem: () => void;
  onSelectItem: (item: StockItem) => void;
  refreshKey: number;
}) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const token = getStoredAccessToken();
      if (!token) { setError("Session expired."); setLoading(false); return; }

      const cacheKey = makeCacheKey(token, "stock-items", JSON.stringify({ search, category, filter }));
      const cached = readClientCache<{ items: StockItem[] }>(cacheKey);
      if (cached) { setItems(cached.value.items); setLoading(false); }
      else setLoading(true);
      setError(null);

      try {
        const response = await listStockItems(token, {
          search,
          category: category === "All" ? undefined : category,
          limit: 50,
          ownershipType: filter === "owned" ? "OWNED" : filter === "consignment" ? "CONSIGNMENT" : undefined,
          restockOnly: filter === "restock",
        });
        if (!cancelled) { setItems(response.items); writeClientCache(cacheKey, response); }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load stock.");
      } finally { if (!cancelled) setLoading(false); }
    }, 180);

    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [category, filter, refreshKey, search]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const lowStockCount = items.filter((i) => i.stockStatus === "LOW_STOCK").length;

  const filters: { key: StockFilter; icon: React.ReactNode; label: string; badge?: string }[] = [
    { key: "all", icon: <Package className="size-4" />, label: "All" },
    { key: "owned", icon: <CheckCircle2 className="size-4" />, label: "Owned" },
    { key: "consignment", icon: <Handshake className="size-4" />, label: "Consignment" },
    { key: "restock", icon: <AlertTriangle className="size-4" />, label: "Restock", badge: lowStockCount > 0 ? String(lowStockCount) : undefined },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[24px] font-extrabold text-[#101827] sm:text-[33px]">My Stock</h2>
        <Button size="sm" className="h-10 rounded-2xl px-3 text-[13px] sm:h-12 sm:rounded-3xl sm:px-5 sm:text-[18px]" onClick={onAddItem}>
          <Plus className="size-4" />
          Add Item
        </Button>
      </div>

      {/* Search */}
      <div className="flex h-12 items-center gap-3 rounded-[14px] border border-[#dce3ec] bg-white px-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] sm:h-[66px] sm:rounded-[18px]">
        <Search className="size-4 shrink-0 text-[#8da0ba] sm:size-5" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-[15px] text-[#334155] outline-none placeholder:text-[#94a3b8] sm:text-[20px]"
          placeholder="Search items..."
        />
      </div>

      {/* Filter pills — horizontal scroll */}
      <div className="-mx-4 sm:mx-0">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0 sm:flex-wrap"
          style={{ scrollbarWidth: "none" }}>
          {filters.map(({ key, icon, label, badge }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-all duration-200 sm:h-10 sm:px-4 sm:text-[15px]",
                filter === key
                  ? "bg-[#1557df] text-white shadow-[0_4px_12px_rgba(21,87,223,0.3)]"
                  : "bg-white text-[#64748b] shadow-[0_1px_4px_rgba(15,23,42,0.08)]",
              )}
            >
              {icon}
              {label}
              {badge && (
                <span className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold",
                  filter === key ? "bg-white/25 text-white" : "bg-[#ffe4e6] text-[#ef3b42]",
                )}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      {categories.length > 1 && (
        <div className="-mx-4 sm:mx-0">
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0 sm:flex-wrap"
            style={{ scrollbarWidth: "none" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold transition-all duration-200 sm:h-9 sm:px-4 sm:text-[14px]",
                  category === cat
                    ? "bg-[#071122] text-white"
                    : "bg-white/80 text-[#64748b] shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex h-32 items-center justify-center text-[14px] text-[#94a3b8]">
          Loading stock...
        </div>
      )}
      {error && !loading && (
        <div className="rounded-[14px] bg-[#fff0f0] px-4 py-3 text-[14px] font-semibold text-red-600">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="grid size-16 place-items-center rounded-[20px] bg-[#f1f5fb]">
            <Package className="size-8 text-[#9fb3ce]" />
          </div>
          <div>
            <p className="text-[17px] font-extrabold text-[#0f172a]">No stock items yet</p>
            <p className="mt-1 text-[13px] text-[#64748b]">Add your first product or service</p>
          </div>
          <Button className="h-10 rounded-[13px] px-5 text-[14px]" onClick={onAddItem}>
            <Plus className="size-4" /> Add Item
          </Button>
        </div>
      )}

      {/* Stock grid */}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {items.map((item) => (
            <StockCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StockCard({ item, onClick }: { item: StockItem; onClick: () => void }) {
  const isLow = item.stockStatus === "LOW_STOCK";
  const isOut = item.stockStatus === "OUT_OF_STOCK";
  const isConsignment = item.ownershipType === "CONSIGNMENT";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col overflow-hidden rounded-[18px] bg-white text-left shadow-[0_2px_12px_rgba(15,23,42,0.08)] active:scale-[0.97] transition-transform"
    >
      {/* Image placeholder */}
      <div className="relative flex h-[80px] w-full items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] sm:h-[100px]">
        <Package className="size-8 text-[#cbd5e1] sm:size-10" strokeWidth={1.5} />
        {/* Ownership badge — top right */}
        {isConsignment && (
          <span className="absolute right-2 top-2 rounded-full bg-[#fff0d4] px-1.5 py-0.5 text-[10px] font-bold text-[#d97706]">
            Consign
          </span>
        )}
        {!isConsignment && (
          <span className="absolute right-2 top-2 rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[10px] font-bold text-[#3b82f6]">
            Owned
          </span>
        )}
        {/* Low/out stock alert */}
        {(isLow || isOut) && (
          <span className={cn(
            "absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
            isOut ? "bg-[#fee2e2] text-[#ef4444]" : "bg-[#fef3c7] text-[#d97706]",
          )}>
            {isOut ? "Out" : "Low"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
        <p className="truncate text-[13px] font-extrabold text-[#071122] sm:text-[16px]">
          {item.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[#94a3b8] sm:text-[13px]">
          {item.category}
        </p>

        <div className="mt-2.5 flex items-end justify-between gap-1">
          <p className="break-words text-[13px] font-extrabold text-[#1557df] sm:text-[16px]">
            {formatMoney(item.sellingPrice)}
          </p>
          {item.itemType === "PRODUCT" && (
            <span className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white sm:text-[12px]",
              item.stockStatus === "IN_STOCK" ? "bg-[#16a34a]" :
              item.stockStatus === "LOW_STOCK" ? "bg-[#d97706]" : "bg-[#ef4444]",
            )}>
              {item.quantity} {item.unitType.toLowerCase()}
            </span>
          )}
        </div>
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
