"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Handshake,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

    async function loadStock() {
      const token = getStoredAccessToken();

      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const cacheKey = makeCacheKey(
        token,
        "stock-items",
        JSON.stringify({ search, category, filter }),
      );
      const cached = readClientCache<{ items: StockItem[] }>(cacheKey);
      if (cached) {
        setItems(cached.value.items);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await listStockItems(token, {
          search,
          category: category === "All" ? undefined : category,
          limit: 50,
          ownershipType:
            filter === "owned"
              ? "OWNED"
              : filter === "consignment"
                ? "CONSIGNMENT"
                : undefined,
          restockOnly: filter === "restock",
        });

        if (!cancelled) {
          setItems(response.items);
          writeClientCache(cacheKey, response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load stock right now.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = window.setTimeout(() => {
      void loadStock();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [category, filter, refreshKey, search]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category)));
    return ["All", ...unique];
  }, [items]);

  const lowStockCount = items.filter((item) => item.stockStatus === "LOW_STOCK").length;

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-[33px] font-extrabold leading-none text-[#101827]">
          My Stock
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" className="h-12 rounded-3xl px-4">
            <Download />
            Export
          </Button>
          <Button size="sm" className="h-12 rounded-3xl px-5" onClick={onAddItem}>
            <Plus />
            Add Item
          </Button>
        </div>
      </div>

      <label className="mb-6 flex h-[66px] items-center gap-4 rounded-[18px] border border-[#dce3ec] bg-white px-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
        <Search className="size-6 text-[#8da0ba]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-[23px] text-[#334155] outline-none placeholder:text-[#66758a]"
          placeholder="Search items..."
        />
      </label>

      <div className="mb-4 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          <FilterPill
            active={filter === "all"}
            icon={<Package />}
            label="All"
            onClick={() => setFilter("all")}
          />
          <FilterPill
            active={filter === "owned"}
            icon={<CheckCircle2 />}
            label="Owned"
            onClick={() => setFilter("owned")}
          />
          <FilterPill
            active={filter === "consignment"}
            icon={<Handshake />}
            label="Consignment"
            onClick={() => setFilter("consignment")}
          />
          <FilterPill
            active={filter === "restock"}
            icon={<AlertTriangle />}
            label="Restock"
            badge={String(lowStockCount)}
            onClick={() => setFilter("restock")}
          />
        </div>
      </div>

      <div className="mb-7 flex gap-3 overflow-x-auto pb-1">
        {categories.map((itemCategory) => (
          <CategoryPill
            key={itemCategory}
            active={category === itemCategory}
            label={itemCategory}
            onClick={() => setCategory(itemCategory)}
          />
        ))}
      </div>

      {loading && <StockMessage title="Loading stock..." />}
      {error && !loading && <StockMessage title={error} />}
      {!loading && !error && items.length === 0 && (
        <StockMessage
          title="No stock items yet"
          text="Add your first product or service to start tracking inventory."
          action={onAddItem}
        />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {items.map((item) => (
            <StockCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[56px] items-center gap-2 rounded-2xl border border-[#d9e0ea] bg-white px-5 text-[22px] font-semibold text-[#66758a] shadow-[0_1px_2px_rgba(15,23,42,0.05)] [&_svg]:size-6",
        active && "border-[#2563eb] bg-[#2563eb] text-white",
      )}
    >
      {icon}
      {label}
      {badge && (
        <span className="ml-1 rounded-full bg-[#ffe8ea] px-2.5 py-0.5 text-[#ef3b42]">
          {badge}
        </span>
      )}
    </button>
  );
}

function CategoryPill({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 shrink-0 rounded-2xl border border-[#d9e0ea] bg-white px-6 text-[18px] font-semibold text-[#66758a]",
        active && "border-[#2563eb] bg-[#2563eb] text-white",
      )}
    >
      {label}
    </button>
  );
}

function StockCard({ item, onClick }: { item: StockItem; onClick: () => void }) {
  return (
    <button type="button" className="text-left" onClick={onClick}>
      <Card className="w-full max-w-[352px] px-5 py-6 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(15,23,42,0.12)]">
      <div className="mb-5 grid h-[120px] place-items-center rounded-[18px] bg-[#f3f6fa] text-[#c6d1df]">
        <Package className="size-12" strokeWidth={2.4} />
      </div>
      <h3 className="text-[24px] font-bold text-[#1f2937]">{item.name}</h3>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[19px] text-[#8b99b3]">{item.category}</span>
        {item.ownershipType === "CONSIGNMENT" && (
          <span className="rounded-full bg-[#fff0d4] px-2.5 py-0.5 text-[15px] font-bold text-[#f59e0b]">
            Consignment
          </span>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-[25px] font-extrabold text-[#2563eb]">
          {formatMoney(item.sellingPrice)}
        </span>
        {item.itemType === "PRODUCT" && (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[19px] font-extrabold text-white",
              item.stockStatus === "IN_STOCK" && "bg-[#16a34a]",
              item.stockStatus === "LOW_STOCK" && "bg-[#f59e0b]",
              item.stockStatus === "OUT_OF_STOCK" && "bg-[#e90012]",
            )}
          >
            {item.quantity} {item.unitType.toLowerCase()}
          </span>
        )}
      </div>
      </Card>
    </button>
  );
}

function StockMessage({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: () => void;
}) {
  return (
    <Card className="grid min-h-[280px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl bg-[#f1f5fb] text-[#9fb3ce]">
          <Package className="size-9" />
        </div>
        <h3 className="text-[25px] font-extrabold text-[#0f172a]">{title}</h3>
        {text && <p className="mt-2 text-[19px] text-[#64748b]">{text}</p>}
        {action && (
          <Button className="mt-6 h-12 rounded-2xl px-6" onClick={action}>
            <Plus />
            Add Item
          </Button>
        )}
      </div>
    </Card>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}
