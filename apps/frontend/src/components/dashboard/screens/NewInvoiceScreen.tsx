"use client";

import { ArrowLeft, CalendarDays, FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { makeCacheKey, removeClientCache } from "@/lib/clientCache";
import { createInvoice } from "@/lib/invoiceApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export function NewInvoiceScreen({
  onBack,
  onDiscard,
  onCreated,
}: {
  onBack: () => void;
  onDiscard: () => void;
  onCreated: () => void;
}) {
  const [createCredit, setCreateCredit] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(0, Number(quantity || 0) * Number(price || 0));

  async function submitInvoice() {
    setError(null);

    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    const qty = Number(quantity);
    const unitPrice = Number(price);

    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (!itemName.trim()) {
      setError("Add at least one invoice item.");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError("Quantity and price must be valid.");
      return;
    }

    setSaving(true);
    try {
      await createInvoice(token, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        dueDate,
        notes: notes.trim() || undefined,
        items: [
          {
            description: itemName.trim(),
            quantity: qty,
            unitPrice,
          },
        ],
      });
      removeClientCache(makeCacheKey(token, "invoices"));
      removeClientCache(makeCacheKey(token, "dashboard-summary"));
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to create invoice right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-8 flex items-center gap-14">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <h2 className="text-[31px] font-extrabold text-[#071122]">New Invoice</h2>
      </div>

      <div className="space-y-5">
        <InvoiceField
          label="Customer Name *"
          placeholder="e.g. Oga Mike"
          value={customerName}
          onChange={setCustomerName}
        />
        <InvoiceField
          label="Phone (optional)"
          placeholder="08012345678"
          value={customerPhone}
          onChange={setCustomerPhone}
        />

        <div>
          <p className="mb-2 text-[24px] font-semibold">Items</p>
          <Card className="px-5 py-6">
            <p className="mb-3 text-[19px] text-[#334155]">Item 1</p>
            <input
              className="mb-3 h-[54px] w-full rounded-[10px] border border-[#d3dbe6] bg-transparent px-4 text-[22px] outline-none placeholder:text-[#334155]"
              placeholder="Item name"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="h-[54px] rounded-[10px] border border-[#d3dbe6] bg-transparent px-4 text-[22px] outline-none"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <input
                className="h-[54px] rounded-[10px] border border-[#d3dbe6] bg-transparent px-4 text-[22px] outline-none placeholder:text-[#334155]"
                inputMode="decimal"
                placeholder="Price (₦)"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <button className="mt-5 text-[21px] text-[#2563eb]">+ Add discount</button>
          </Card>
          <button className="mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-[10px] border border-[#d3dbe6] bg-white text-[23px] font-semibold">
            <Plus className="size-5" />
            Add Item
          </button>
        </div>

        <div className="grid h-[138px] place-items-center rounded-[20px] border border-[#d8e6ff] bg-[#edf5ff] text-center">
          <div>
            <p className="text-[24px] text-[#334155]">Total</p>
            <p className="mt-1 text-[37px] font-extrabold text-[#2563eb]">
              {formatMoney(total)}
            </p>
          </div>
        </div>

        <ToggleCard
          checked={createCredit}
          onChange={setCreateCredit}
          title="Create credit transaction"
          text="This invoice will appear as pending until payment is recorded"
        />

        <label className="block">
          <span className="mb-2 block text-[24px] font-semibold">Due Date *</span>
          <div className="flex h-[72px] items-center justify-between rounded-[11px] border border-[#d3dbe6] px-5 text-[23px]">
            <input
              type="date"
              className="w-full bg-transparent outline-none"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <CalendarDays className="size-5" />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-[24px] font-semibold">Notes (optional)</span>
          <textarea
            className="h-24 w-full resize-none rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 py-4 text-[23px] outline-none placeholder:text-[#334155]"
            placeholder="Any notes for the customer"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {error && (
          <p className="rounded-[14px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[18px] font-semibold text-[#be123c]">
            {error}
          </p>
        )}

        <button
          className="h-[72px] w-full rounded-[18px] bg-[#2563eb] text-[23px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#8fb0ef]"
          disabled={saving}
          onClick={() => void submitInvoice()}
        >
          {saving ? "Creating..." : "Create Invoice"}
        </button>
        <button
          className="mx-auto flex items-center gap-2 pb-8 pt-2 text-[19px] text-[#66758a]"
          onClick={onDiscard}
        >
          <Trash2 className="size-5" />
          Discard draft
        </button>
      </div>
    </div>
  );
}

function InvoiceField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[24px] font-semibold">{label}</span>
      <input
        className="h-[72px] w-full rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 text-[23px] outline-none placeholder:text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ToggleCard({
  checked,
  title,
  text,
  onChange,
}: {
  checked: boolean;
  title: string;
  text: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Card className="flex min-h-[148px] items-center gap-5 px-5 py-6">
      <span className="grid size-[54px] shrink-0 place-items-center rounded-[16px] bg-[#eef4ff] text-[#2563eb]">
        <FileText className="size-7" />
      </span>
      <div className="flex-1">
        <p className="text-[24px] font-bold">{title}</p>
        <p className="mt-1 max-w-[470px] text-[20px] leading-6 text-[#334155]">{text}</p>
      </div>
      <Switch checked={checked} label={title} onChange={onChange} />
    </Card>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative h-8 w-[54px] shrink-0 rounded-full p-1 transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#93b4ff]/50 active:scale-95",
        checked ? "bg-[#2563eb]" : "bg-[#dbe2ec]",
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "block size-6 rounded-full bg-white shadow-[0_2px_5px_rgba(15,23,42,0.22)] transition-transform duration-200 ease-out",
          checked ? "translate-x-[22px]" : "translate-x-0",
        )}
      />
    </button>
  );
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}
