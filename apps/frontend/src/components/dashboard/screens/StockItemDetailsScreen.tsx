"use client";

import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  History,
  Handshake,
  Package,
  Pencil,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import {
  makeCacheKey,
  readClientCache,
  removeClientCache,
  writeClientCache,
} from "@/lib/clientCache";
import { getStoredAccessToken } from "@/lib/session";
import {
  getStockItem,
  listStockItemSales,
  listStockMovements,
  type StockItem,
  type StockItemSale,
  type StockItemSalesSummary,
  type StockMovement,
  updateStockItem,
} from "@/lib/stockApi";
import { cn } from "@/lib/utils";

export function StockItemDetailsScreen({
  itemId,
  initialItem,
  onBack,
  onChanged,
  onOpenSupplier,
  onSettleConsignment,
}: {
  itemId: string;
  initialItem?: StockItem | null;
  onBack: () => void;
  onChanged: () => void;
  onOpenSupplier: (supplierId: string) => void;
  onSettleConsignment: (supplierId: string, itemId: string) => void;
}) {
  const [item, setItem] = useState<StockItem | null>(initialItem ?? null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [recentSales, setRecentSales] = useState<StockItemSale[]>([]);
  const [salesSummary, setSalesSummary] = useState<StockItemSalesSummary | null>(null);
  const [quantityDelta, setQuantityDelta] = useState("0");
  const [loading, setLoading] = useState(!initialItem);
  const [savingQuantity, setSavingQuantity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItem() {
      const token = getStoredAccessToken();
      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const cacheKey = makeCacheKey(token, "stock-item-details", itemId);
      const cached = readClientCache<{
        item: StockItem;
        movements: StockMovement[];
        sales: StockItemSale[];
        summary: StockItemSalesSummary;
      }>(cacheKey);
      if (cached) {
        setItem(cached.value.item);
        setMovements(cached.value.movements);
        setRecentSales(cached.value.sales);
        setSalesSummary(cached.value.summary);
        setLoading(false);
      } else if (initialItem) {
        setItem(initialItem);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [result, movementResult, salesResult] = await Promise.all([
          getStockItem(token, itemId),
          listStockMovements(token, itemId),
          listStockItemSales(token, itemId),
        ]);
        if (!cancelled) {
          setItem(result.item);
          setMovements(movementResult.movements);
          setRecentSales(salesResult.sales);
          setSalesSummary(salesResult.summary);
          writeClientCache(cacheKey, {
            item: result.item,
            movements: movementResult.movements,
            sales: salesResult.sales,
            summary: salesResult.summary,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Unable to load this item.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, [initialItem, itemId]);

  const costBasis = item?.ownershipType === "CONSIGNMENT"
    ? item.ownerCostPerUnit ?? 0
    : item?.buyingPrice ?? 0;
  const profit = item ? item.sellingPrice - costBasis : 0;
  const profitPercent = costBasis > 0 ? Math.round((profit / costBasis) * 100) : 0;
  const consignmentValue = item && item.ownerCostPerUnit
    ? item.ownerCostPerUnit * item.quantity
    : 0;
  const consignmentOutstanding = salesSummary?.outstandingBalance ?? 0;
  const consignmentPayable = salesSummary?.ownerPayable ?? 0;
  const consignmentSettled = salesSummary?.totalSettled ?? 0;
  const unitsSold = salesSummary?.unitsSold ?? 0;

  const stockStatus = useMemo(() => {
    if (!item) return { label: "", className: "" };
    if (item.stockStatus === "OUT_OF_STOCK") {
      return { label: "Out of Stock", className: "bg-[#ffe8ea] text-[#e11d48]" };
    }
    if (item.stockStatus === "LOW_STOCK") {
      return { label: "Low Stock", className: "bg-[#fff4d8] text-[#d97706]" };
    }
    return { label: "In Stock", className: "bg-[#dcfce7] text-[#059669]" };
  }, [item]);

  async function applyQuantityChange() {
    if (!item) return;

    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    const delta = Math.trunc(Number(quantityDelta || 0));
    if (!Number.isFinite(delta) || delta === 0) return;

    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 0) {
      setError("Stock quantity cannot go below zero.");
      return;
    }

    setSavingQuantity(true);
    setError(null);

    try {
      const result = await updateStockItem(token, item.id, {
        quantity: nextQuantity,
      });
      const movementResult = await listStockMovements(token, item.id);
      const salesResult = await listStockItemSales(token, item.id);
      setItem(result.item);
      setMovements(movementResult.movements);
      setRecentSales(salesResult.sales);
      setSalesSummary(salesResult.summary);
      setQuantityDelta("0");
      removeClientCache(makeCacheKey(token, "stock-items"));
      removeClientCache(makeCacheKey(token, "stock-item-details"));
      removeClientCache(makeCacheKey(token, "dashboard-summary"));
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to update stock quantity right now.",
      );
    } finally {
      setSavingQuantity(false);
    }
  }

  if (loading) {
    return <DetailsMessage onBack={onBack} title="Loading item details..." />;
  }

  if (error && !item) {
    return <DetailsMessage onBack={onBack} title={error} />;
  }

  if (!item) {
    return <DetailsMessage onBack={onBack} title="Stock item not found" />;
  }

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-12">
          <button className="grid size-9 place-items-center" onClick={onBack}>
            <ArrowLeft className="size-7" />
          </button>
          <h2 className="text-[31px] font-extrabold text-[#071122]">
            Item Details
          </h2>
        </div>
        <Button variant="secondary" size="sm" className="h-12 rounded-3xl px-5">
          <Pencil />
          Edit
        </Button>
      </div>

      <Card className="mb-5 flex min-h-[170px] items-center gap-6 px-6 py-6">
        <div className="grid size-[96px] shrink-0 place-items-center rounded-[22px] bg-[#f3f6fa] text-[#c6d1df]">
          <Package className="size-12" />
        </div>
        <div>
          <h3 className="text-[31px] font-extrabold leading-tight text-[#071122]">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-1 text-[22px] text-[#334155]">{item.description}</p>
          )}
          <p className="text-[20px] text-[#64748b]">{item.category}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill className={stockStatus.className} label={stockStatus.label} />
            {item.ownershipType === "CONSIGNMENT" && (
              <StatusPill
                className="bg-[#fff0d4] text-[#d97706]"
                icon={<Handshake className="size-4" />}
                label="Consignment"
              />
            )}
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <PriceTile
          label={item.ownershipType === "CONSIGNMENT" ? "Owner Cost" : "Buying"}
          value={formatMoney(costBasis)}
        />
        <PriceTile label="Selling" value={formatMoney(item.sellingPrice)} tone="blue" />
        <PriceTile
          label="Wholesale"
          value={formatMoney(item.wholesalePrice)}
          tone="amber"
        />
        <PriceTile
          label={item.ownershipType === "CONSIGNMENT" ? "Your Margin" : "Profit"}
          value={formatMoney(profit)}
          subtext={`${profitPercent}%`}
          tone="green"
        />
      </div>

      {item.ownershipType === "CONSIGNMENT" && (
        <Card className="mb-5 px-6 py-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-3 text-[27px] font-extrabold text-[#071122]">
              <Handshake className="size-6 text-[#f59e0b]" />
              Consignment Details
            </h3>
            <Button
              size="sm"
              className="h-12 rounded-2xl px-5"
              onClick={() => {
                if (item.supplier?.id) onSettleConsignment(item.supplier.id, item.id);
              }}
            >
              <Banknote />
              Settle
            </Button>
          </div>
          <button
            type="button"
            className="mb-4 text-left text-[22px] font-bold text-[#2563eb] underline-offset-4 hover:underline"
            title="Open supplier profile"
            onClick={() => {
              if (item.supplier?.id) onOpenSupplier(item.supplier.id);
            }}
          >
            {item.supplier?.name ?? "No supplier selected"}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Owner cost/unit" value={formatMoney(item.ownerCostPerUnit ?? 0)} />
            <MiniStat label="Units sold" value={`${unitsSold} ${item.unitType.toLowerCase()}`} />
            <MiniStat label="Total owed" value={formatMoney(consignmentPayable)} />
            <MiniStat label="Total settled" value={formatMoney(consignmentSettled)} tone="green" />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[14px] border border-[#ffd1d6] bg-[#fff1f2] px-5 py-4">
            <span className="text-[20px] font-semibold text-[#334155]">
              Outstanding Balance
            </span>
            <span className="text-[25px] font-extrabold text-[#ef3b42]">
              {formatMoney(consignmentOutstanding)}
            </span>
          </div>
          <p className="mt-3 text-[16px] text-[#64748b]">
            Current owner value in stock: {formatMoney(consignmentValue)}
          </p>
        </Card>
      )}

      <Card className="mb-5 px-6 py-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-[27px] font-extrabold text-[#071122]">Stock Quantity</h3>
          <span className="rounded-full bg-[#f2f5f9] px-5 py-2 text-[29px] font-semibold text-black">
            {item.quantity} {item.unitType.toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-[60px] w-[62px] place-items-center rounded-[17px] border border-[#d7dfe9] bg-white text-[28px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
            onClick={() => setQuantityDelta(String(Math.trunc(Number(quantityDelta || 0)) - 1))}
          >
            -
          </button>
          <input
            value={quantityDelta}
            inputMode="numeric"
            onChange={(event) => setQuantityDelta(event.target.value)}
            className="h-[60px] min-w-0 flex-1 rounded-[12px] border border-[#d7dfe9] bg-white px-4 text-center text-[23px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <button
            type="button"
            className="grid h-[60px] w-[62px] place-items-center rounded-[17px] border border-[#d7dfe9] bg-white text-[28px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
            onClick={() => setQuantityDelta(String(Math.trunc(Number(quantityDelta || 0)) + 1))}
          >
            +
          </button>
          <Button
            className="h-[60px] rounded-[17px] px-6 text-[22px]"
            disabled={savingQuantity}
            onClick={applyQuantityChange}
          >
            {savingQuantity ? "Saving" : "Add"}
          </Button>
        </div>
        {error && <p className="mt-4 text-[17px] font-semibold text-red-600">{error}</p>}
      </Card>

      {(item.lowStockAlertQuantity !== null || item.preferredReorderAmount !== null) && (
        <Card className="mb-5 px-6 py-6">
          <h3 className="mb-5 flex items-center gap-3 text-[27px] font-extrabold text-[#071122]">
            <RefreshCw className="size-6 text-[#2563eb]" />
            Restocking Insight
          </h3>
          <InsightRow label="Reorder level" value={`${item.lowStockAlertQuantity ?? 0} ${item.unitType.toLowerCase()}`} />
          <InsightRow
            label="Preferred reorder"
            value={
              item.preferredReorderAmount
                ? `${item.preferredReorderAmount} ${item.unitType.toLowerCase()}`
                : "Smart suggestion pending"
            }
          />
        </Card>
      )}

      <div className="mb-4 mt-7">
        <h3 className="text-[27px] font-extrabold text-[#071122]">Recent Sales</h3>
      </div>
      {recentSales.length === 0 ? (
        <Card className="mb-5 px-6 py-8 text-center">
          <p className="text-[19px] text-[#64748b]">
            No sales have been recorded for this item yet.
          </p>
        </Card>
      ) : (
        <div className="mb-5 space-y-3">
          {recentSales.slice(0, 5).map((sale) => (
            <RecentSaleRow key={sale.id} sale={sale} unitType={item.unitType} />
          ))}
        </div>
      )}

      <Card className="mb-5 px-6 py-6">
        <h3 className="mb-5 flex items-center gap-3 text-[27px] font-extrabold text-[#071122]">
          <History className="size-6 text-[#2563eb]" />
          Stock Activity
        </h3>
        {movements.length === 0 ? (
          <p className="text-[19px] text-[#64748b]">
            No stock activity has been recorded for this item yet.
          </p>
        ) : (
          <div className="space-y-3">
            {movements.slice(0, 6).map((movement) => (
              <MovementRow
                key={movement.id}
                movement={movement}
                unitType={item.unitType}
              />
            ))}
          </div>
        )}
      </Card>

      <p className="pb-8 text-center text-[18px] text-[#475569]">
        Added {formatDate(item.createdAt)} · Last updated {formatDate(item.updatedAt)}
      </p>
    </div>
  );
}

function DetailsMessage({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="mx-4 sm:mx-0">
      <button className="mb-7 grid size-9 place-items-center" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>
      <Card className="grid min-h-[260px] place-items-center px-6 text-center">
        <div>
          <Package className="mx-auto mb-4 size-10 text-[#9fb3ce]" />
          <h2 className="text-[25px] font-extrabold text-[#071122]">{title}</h2>
        </div>
      </Card>
    </div>
  );
}

function StatusPill({
  className,
  label,
  icon,
}: {
  className: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[18px] font-semibold", className)}>
      {icon ?? <CheckCircle2 className="size-4" />}
      {label}
    </span>
  );
}

function PriceTile({
  label,
  value,
  subtext,
  tone,
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "blue" | "green" | "amber";
}) {
  return (
    <Card className="grid min-h-[162px] place-items-center px-4 py-5 text-center">
      <div>
        <p className="text-[20px] text-[#475569]">{label}</p>
        <p
          className={cn(
            "mt-1 text-[23px] font-extrabold text-black",
            tone === "blue" && "text-[#2563eb]",
            tone === "green" && "text-[#05a970]",
            tone === "amber" && "text-[#f59e0b]",
          )}
        >
          {value}
        </p>
        {subtext && <p className="mt-1 text-[17px] text-[#334155]">{subtext}</p>}
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green";
}) {
  return (
    <div className="rounded-[14px] bg-[#f7f9fc] px-4 py-4">
      <p className="text-[15px] font-semibold uppercase text-[#475569]">{label}</p>
      <p className={cn("mt-1 text-[22px] font-extrabold text-black", tone === "green" && "text-[#05a970]")}>
        {value}
      </p>
    </div>
  );
}

function RecentSaleRow({
  sale,
  unitType,
}: {
  sale: StockItemSale;
  unitType: string;
}) {
  return (
    <Card className="flex min-h-[104px] items-center gap-5 px-6 py-4">
      <div className="grid size-[52px] shrink-0 place-items-center rounded-full bg-[#eafaf4] text-[#05a970]">
        <ShoppingCart className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[23px] font-extrabold text-[#071122]">
          {(sale.customerName || "Walk-in")} × {sale.quantity}
        </h4>
        <p className="mt-1 text-[18px] text-[#64748b]">
          {formatDate(sale.createdAt)} • {sale.quantity} {unitType.toLowerCase()}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[23px] font-extrabold text-[#05a970]">
          {formatMoney(sale.total)}
        </p>
        {sale.paymentStatus !== "PAID" && (
          <p className="mt-1 text-[14px] font-bold text-[#d98900]">
            {sale.paymentStatus === "PART_PAYMENT" ? "Part payment" : "Pay later"}
          </p>
        )}
      </div>
    </Card>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 text-[22px]">
      <span className="text-[#475569]">{label}</span>
      <span className="text-right font-bold text-black">{value}</span>
    </div>
  );
}

function MovementRow({
  movement,
  unitType,
}: {
  movement: StockMovement;
  unitType: string;
}) {
  const isPositive = movement.quantityChange > 0;

  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] bg-[#f7f9fc] px-4 py-4">
      <div>
        <p className="text-[20px] font-bold text-[#071122]">
          {movementLabel(movement.type)}
        </p>
        <p className="mt-1 text-[16px] text-[#64748b]">
          {formatDateTime(movement.createdAt)}
        </p>
        {movement.note && (
          <p className="mt-1 text-[16px] text-[#64748b]">{movement.note}</p>
        )}
      </div>
      <div className="text-right">
        <p
          className={cn(
            "text-[22px] font-extrabold",
            isPositive ? "text-[#05a970]" : "text-[#e11d48]",
          )}
        >
          {isPositive ? "+" : ""}
          {movement.quantityChange} {unitType.toLowerCase()}
        </p>
        <p className="mt-1 text-[15px] text-[#64748b]">
          {movement.quantityBefore} → {movement.quantityAfter}
        </p>
      </div>
    </div>
  );
}

function movementLabel(type: StockMovement["type"]) {
  const labels: Record<StockMovement["type"], string> = {
    OPENING_STOCK: "Opening stock",
    MANUAL_ADJUSTMENT: "Manual adjustment",
    SALE: "Sale",
    RESTOCK: "Restock",
    RETURN: "Return",
    DAMAGE: "Damage",
  };

  return labels[type];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB").format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
