"use client";

import {
  ArrowLeft,
  Banknote,
  Building2,
  Copy,
  Mail,
  MapPin,
  Package,
  Phone,
  WalletCards,
  X,
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
import {
  createConsignmentSettlement,
  getConsignmentSupplier,
  type ConsignmentSupplierDetails,
} from "@/lib/consignmentApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export function ConsignmentSupplierDetailsScreen({
  supplierId,
  settleItemId,
  onBack,
  onChanged,
  onAddSupplier,
}: {
  supplierId: string;
  settleItemId?: string | null;
  onBack: () => void;
  onChanged: () => void;
  onAddSupplier: () => void;
}) {
  const [details, setDetails] = useState<ConsignmentSupplierDetails | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(Boolean(settleItemId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDetails(preferCache = true) {
    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      setLoading(false);
      return;
    }

    const cacheKey = makeCacheKey(token, "consignment-supplier", supplierId);
    const cached = readClientCache<ConsignmentSupplierDetails>(cacheKey);
    if (preferCache && cached) {
      setDetails(cached.value);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await getConsignmentSupplier(token, supplierId);
      setDetails(result);
      writeClientCache(cacheKey, result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to load supplier.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetails(true);
  }, [supplierId]);

  useEffect(() => {
    if (settleItemId) setSettlementOpen(true);
  }, [settleItemId]);

  if (loading && !details) {
    return <MessageScreen onBack={onBack} title="Loading supplier..." />;
  }

  if (!details) {
    return <MessageScreen onBack={onBack} title={error ?? "Supplier not found"} />;
  }

  const supplier = details.supplier;

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-10">
          <button className="grid size-9 place-items-center" onClick={onBack}>
            <ArrowLeft className="size-7" />
          </button>
          <h2 className="text-[31px] font-extrabold text-[#071122]">
            Supplier Details
          </h2>
        </div>
        <Button className="h-12 rounded-3xl px-5 text-[18px]" onClick={onAddSupplier}>
          Add Supplier
        </Button>
      </div>

      <Card className="mb-5 px-6 py-6">
        <div className="flex gap-5">
          <span className="grid size-[82px] shrink-0 place-items-center rounded-[22px] bg-[#fff4dc] text-[30px] font-extrabold text-[#e28a00]">
            {supplier.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[29px] font-extrabold text-[#071122]">
              {supplier.name}
            </h3>
            <InfoLine icon={<Phone />} value={supplier.phone} fallback="No phone added" />
            <InfoLine icon={<Mail />} value={supplier.email} fallback="No email added" />
            <InfoLine icon={<MapPin />} value={supplier.address} fallback="No address added" />
            {supplier.notes && (
              <p className="mt-2 text-[17px] text-[#8b99b3]">{supplier.notes}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatTile label="Total Owed" value={formatMoney(details.summary.totalOwed)} />
        <StatTile label="Settled" value={formatMoney(details.summary.totalSettled)} tone="green" />
        <StatTile label="Outstanding" value={formatMoney(details.summary.outstanding)} tone="red" />
      </div>

      <Button
        className="mb-5 h-14 w-full rounded-[16px] text-[21px]"
        disabled={details.summary.outstanding <= 0}
        onClick={() => setSettlementOpen(true)}
      >
        <Banknote className="size-5" />
        Record Settlement
      </Button>

      <Card className="mb-5 px-6 py-6">
        <h3 className="mb-5 flex items-center gap-3 text-[25px] font-extrabold text-[#071122]">
          <Building2 className="size-6 text-[#2563eb]" />
          Bank Details
        </h3>
        <DetailRow label="Bank" value={supplier.bankName ?? "Not added"} />
        <DetailRow label="Account Name" value={supplier.accountName ?? "Not added"} />
        <DetailRow
          label="Account No."
          value={supplier.accountNumber ?? "Not added"}
          copyable={Boolean(supplier.accountNumber)}
        />
      </Card>

      <SectionHeading icon={<Package />} label="Consignment Items" count={details.items.length} />
      <div className="mb-6 space-y-4">
        {details.items.map((item) => (
          <Card key={item.id} className="px-5 py-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-[23px] font-extrabold text-[#071122]">
                  {item.name}
                </h4>
                <p className="mt-1 text-[17px] text-[#64748b]">
                  {item.quantity} in stock · {item.unitsSold} sold
                </p>
              </div>
              <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[14px] font-bold text-[#05a970]">
                Active
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-[#edf1f5] pt-4 text-center">
              <MiniMetric label="Owner Cost" value={formatMoney(item.ownerCost)} />
              <MiniMetric label="Selling" value={formatMoney(item.sellingPrice)} tone="blue" />
              <MiniMetric label="Owed" value={formatMoney(item.outstanding)} tone="red" />
            </div>
            <Button
              variant="secondary"
              className="mt-4 h-11 w-full rounded-[14px] text-[18px]"
              disabled={item.outstanding <= 0}
              onClick={() => setSettlementOpen(true)}
            >
              <WalletCards className="size-5" />
              Settle This Item
            </Button>
          </Card>
        ))}
      </div>

      <SectionHeading
        icon={<Banknote />}
        label="Settlement History"
        count={details.settlements.length}
      />
      <div className="space-y-4 pb-8">
        {details.settlements.length === 0 ? (
          <Card className="px-6 py-7 text-center text-[18px] text-[#64748b]">
            No settlements recorded yet.
          </Card>
        ) : (
          details.settlements.map((settlement) => (
            <Card
              key={settlement.id}
              className="flex min-h-[104px] items-center gap-4 px-5 py-5"
            >
              <span className="grid size-[50px] shrink-0 place-items-center rounded-full bg-[#e7fff5] text-[#05a970]">
                <Banknote className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[23px] font-extrabold text-[#071122]">
                  {formatMoney(settlement.amount)}
                </span>
                <span className="text-[17px] text-[#8b99b3]">
                  {formatDate(settlement.createdAt)}
                  {settlement.item ? ` for ${settlement.item.name}` : ""}
                </span>
                {settlement.reference && (
                  <span className="block truncate text-[15px] text-[#8b99b3]">
                    Ref: {settlement.reference}
                  </span>
                )}
              </span>
              <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[14px] font-bold text-[#05a970]">
                {settlement.paymentMethod}
              </span>
            </Card>
          ))
        )}
      </div>

      {settlementOpen && (
        <SettlementModal
          details={details}
          defaultItemId={settleItemId}
          onClose={() => setSettlementOpen(false)}
          onSaved={async () => {
            setSettlementOpen(false);
            const token = getStoredAccessToken();
            if (token) {
              removeClientCache(makeCacheKey(token, "consignment-overview"));
              removeClientCache(makeCacheKey(token, "consignment-supplier"));
              removeClientCache(makeCacheKey(token, "stock-item-details"));
            }
            await loadDetails(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function SettlementModal({
  details,
  defaultItemId,
  onClose,
  onSaved,
}: {
  details: ConsignmentSupplierDetails;
  defaultItemId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const payableItems = details.items.filter((item) => item.outstanding > 0);
  const initialItemId =
    defaultItemId && payableItems.some((item) => item.id === defaultItemId)
      ? defaultItemId
      : "";
  const [amount, setAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER" | "CARD">("CASH");
  const [stockItemId, setStockItemId] = useState(initialItemId);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = payableItems.find((item) => item.id === stockItemId);
  const maxPayable = selectedItem?.outstanding ?? details.summary.outstanding;

  async function saveSettlement() {
    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createConsignmentSettlement(token, {
        supplierId: details.supplier.id,
        stockItemId: stockItemId || undefined,
        amount: Number(amount),
        paymentMethod,
        reference,
        notes,
      });
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to record settlement.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center">
      <div className="max-h-[86vh] w-full overflow-y-auto rounded-t-[24px] bg-white px-5 py-5 shadow-2xl sm:max-w-[620px] sm:rounded-[24px]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[25px] font-extrabold text-[#071122]">
              Record Settlement
            </h3>
            <p className="mt-1 text-[18px] text-[#475569]">
              Pay {details.supplier.name}. Outstanding:{" "}
              <span className="font-bold text-[#ef3b42]">
                {formatMoney(details.summary.outstanding)}
              </span>
            </p>
          </div>
          <button className="grid size-9 place-items-center" onClick={onClose}>
            <X className="size-6" />
          </button>
        </div>

        <FieldLabel label="Amount (Naira) *" />
        <input
          value={amount}
          type="number"
          min={0}
          max={maxPayable}
          onChange={(event) => setAmount(event.target.value)}
          className="mb-3 h-14 w-full rounded-[14px] border border-[#d7dfe9] bg-white px-4 text-[21px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
        <button
          className="mb-5 text-[17px] font-semibold text-[#2563eb]"
          onClick={() => setAmount(String(maxPayable))}
        >
          Pay full balance ({formatMoney(maxPayable)})
        </button>

        <FieldLabel label="Payment Method" />
        <div className="mb-5 grid grid-cols-3 gap-2">
          {(["CASH", "TRANSFER", "CARD"] as const).map((method) => (
            <button
              key={method}
              type="button"
              className={cn(
                "h-14 rounded-[14px] border text-[17px] font-semibold",
                paymentMethod === method
                  ? "border-[#2563eb] bg-[#eef5ff] text-[#2563eb]"
                  : "border-[#dce3ec] bg-white text-[#64748b]",
              )}
              onClick={() => setPaymentMethod(method)}
            >
              {method === "CASH" ? "Cash" : method === "TRANSFER" ? "Transfer" : "Card"}
            </button>
          ))}
        </div>

        <FieldLabel label="Link to Item" optional />
        <select
          value={stockItemId}
          onChange={(event) => setStockItemId(event.target.value)}
          className="mb-5 h-14 w-full rounded-[14px] border border-[#d7dfe9] bg-white px-4 text-[19px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        >
          <option value="">Supplier balance</option>
          {payableItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - owes {formatMoney(item.outstanding)}
            </option>
          ))}
        </select>

        <FieldLabel label="Reference" optional />
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Transfer ref, receipt number, etc."
          className="mb-5 h-14 w-full rounded-[14px] border border-[#d7dfe9] bg-white px-4 text-[19px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />

        <FieldLabel label="Notes" optional />
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any extra details"
          className="mb-5 min-h-[92px] w-full rounded-[14px] border border-[#d7dfe9] bg-white px-4 py-3 text-[19px] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />

        {error && <p className="mb-4 text-[17px] font-semibold text-red-600">{error}</p>}
        <Button
          className="h-14 w-full rounded-[16px] text-[20px]"
          disabled={saving}
          onClick={saveSettlement}
        >
          {saving ? "Saving..." : "Save Settlement"}
        </Button>
      </div>
    </div>
  );
}

function MessageScreen({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="mx-4 sm:mx-0">
      <button className="mb-7 grid size-9 place-items-center" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>
      <Card className="grid min-h-[220px] place-items-center text-center text-[20px] font-bold text-[#071122]">
        {title}
      </Card>
    </div>
  );
}

function InfoLine({
  icon,
  value,
  fallback,
}: {
  icon: React.ReactElement<{ className?: string }>;
  value: string | null;
  fallback: string;
}) {
  return (
    <p className="mt-1 flex items-center gap-2 text-[18px] text-[#64748b]">
      {icon && <span className="[&>svg]:size-5">{icon}</span>}
      {value ?? fallback}
    </p>
  );
}

function DetailRow({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4 text-[20px]">
      <span className="text-[#475569]">{label}</span>
      <span className="inline-flex items-center gap-2 text-right font-semibold text-[#071122]">
        {value}
        {copyable && <Copy className="size-4 text-[#2563eb]" />}
      </span>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <Card className="grid min-h-[112px] place-items-center px-3 py-4 text-center">
      <div>
        <p className="text-[17px] text-[#475569]">{label}</p>
        <p
          className={cn(
            "mt-1 text-[21px] font-extrabold text-black",
            tone === "green" && "text-[#05a970]",
            tone === "red" && "text-[#ef3b42]",
          )}
        >
          {value}
        </p>
      </div>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blue" | "red";
}) {
  return (
    <div>
      <p className="text-[15px] text-[#475569]">{label}</p>
      <p
        className={cn(
          "text-[18px] font-extrabold text-black",
          tone === "blue" && "text-[#2563eb]",
          tone === "red" && "text-[#ef3b42]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[25px] font-extrabold text-[#071122]">
      <span className="text-[#2563eb] [&>svg]:size-5">{icon}</span>
      {label}
      <span className="ml-2 text-[17px] font-medium text-[#334155]">{count}</span>
    </h3>
  );
}

function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <p className="mb-2 text-[20px] font-semibold text-[#071122]">
      {label}
      {optional && <span className="ml-2 font-normal text-[#64748b]">(optional)</span>}
    </p>
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
  return new Intl.DateTimeFormat("en-GB").format(new Date(value));
}
