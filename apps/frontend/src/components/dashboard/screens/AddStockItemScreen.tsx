"use client";

import { ArrowLeft, Bell, ChevronDown, Handshake, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { SupplierForm } from "@/components/dashboard/suppliers/SupplierForm";
import { ApiError } from "@/lib/api";
import {
  makeCacheKey,
  readClientCache,
  removeClientCache,
  writeClientCache,
} from "@/lib/clientCache";
import { getStoredAccessToken } from "@/lib/session";
import {
  createStockItem,
  listSuppliers,
  type Supplier,
} from "@/lib/stockApi";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  description: string;
  category: string;
  buyingPrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  quantity: string;
  unitType: string;
  supplierId: string;
  ownerCostPerUnit: string;
  lowStockAlertQuantity: string;
  preferredReorderAmount: string;
};

const initialForm: FormState = {
  name: "",
  description: "",
  category: "",
  buyingPrice: "0",
  sellingPrice: "0",
  wholesalePrice: "0",
  quantity: "0",
  unitType: "Pieces",
  supplierId: "",
  ownerCostPerUnit: "0",
  lowStockAlertQuantity: "5",
  preferredReorderAmount: "",
};

export function AddStockItemScreen({
  onBack,
  onDiscard,
  onCreated,
}: {
  onBack: () => void;
  onDiscard: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [isConsignment, setIsConsignment] = useState(false);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConsignment) return;

    let cancelled = false;

    async function loadSuppliers() {
      const token = getStoredAccessToken();
      if (!token) return;

      const cacheKey = makeCacheKey(token, "suppliers");
      const cached = readClientCache<{ suppliers: Supplier[] }>(cacheKey);
      if (cached) {
        setSuppliers(cached.value.suppliers);
        setShowSupplierForm(cached.value.suppliers.length === 0);
        setSuppliersLoading(false);
      } else {
        setSuppliersLoading(true);
      }
      try {
        const result = await listSuppliers(token);
        if (cancelled) return;
        setSuppliers(result.suppliers);
        setShowSupplierForm(result.suppliers.length === 0);
        writeClientCache(cacheKey, result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load suppliers right now.",
          );
        }
      } finally {
        if (!cancelled) setSuppliersLoading(false);
      }
    }

    void loadSuppliers();

    return () => {
      cancelled = true;
    };
  }, [isConsignment]);

  async function handleSubmit() {
    const token = getStoredAccessToken();

    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createStockItem(token, {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        itemType: "PRODUCT",
        ownershipType: isConsignment ? "CONSIGNMENT" : "OWNED",
        unitType: form.unitType || "Pieces",
        buyingPrice: toNumber(form.buyingPrice),
        sellingPrice: toNumber(form.sellingPrice),
        wholesalePrice: toNumber(form.wholesalePrice),
        quantity: toWholeNumber(form.quantity),
        supplierId: isConsignment ? form.supplierId : undefined,
        ownerCostPerUnit: isConsignment ? toNumber(form.ownerCostPerUnit) : undefined,
        lowStockAlertQuantity: restockEnabled
          ? toWholeNumber(form.lowStockAlertQuantity)
          : undefined,
        preferredReorderAmount:
          restockEnabled && form.preferredReorderAmount
            ? toWholeNumber(form.preferredReorderAmount)
            : undefined,
      });

      removeClientCache(makeCacheKey(token, "stock-items"));
      removeClientCache(makeCacheKey(token, "stock-item-details"));
      removeClientCache(makeCacheKey(token, "dashboard-summary"));
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to add this item right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSupplierCreated(supplier: Supplier) {
    const token = getStoredAccessToken();
    if (token) removeClientCache(makeCacheKey(token, "suppliers"));
    setSuppliers((current) => [supplier, ...current]);
    updateField("supplierId", supplier.id);
    setShowSupplierForm(false);
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-7 flex items-center gap-14">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <h2 className="text-[31px] font-extrabold text-[#071122]">Add New Item</h2>
      </div>

      <div className="space-y-5">
        <StockField
          label="Item Name *"
          placeholder="e.g. Indomie (carton)"
          value={form.name}
          onChange={(value) => updateField("name", value)}
        />
        <StockField
          label="Description"
          placeholder="e.g. 40-pack carton, chicken flavour"
          value={form.description}
          onChange={(value) => updateField("description", value)}
        />
        <SelectField
          label="Category *"
          value={form.category}
          placeholder="Select category"
          options={["Electronics", "Fashion", "Food", "Beauty", "Pharmacy", "Services", "Other"]}
          onChange={(value) => updateField("category", value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StockField
            label="Buying Price (₦)"
            placeholder="0"
            inputMode="decimal"
            value={form.buyingPrice}
            onChange={(value) => updateField("buyingPrice", value)}
          />
          <StockField
            label="Selling Price (₦)"
            placeholder="0"
            inputMode="decimal"
            value={form.sellingPrice}
            onChange={(value) => updateField("sellingPrice", value)}
          />
        </div>

        <StockField
          label="Wholesale Price (₦)"
          placeholder="0"
          inputMode="decimal"
          value={form.wholesalePrice}
          onChange={(value) => updateField("wholesalePrice", value)}
        />
        <p className="-mt-3 text-[19px] text-[#475569]">
          Price for bulk/wholesale buyers. Leave at 0 if not applicable.
        </p>

        <StockField
          label="Initial Quantity"
          placeholder="0"
          inputMode="numeric"
          value={form.quantity}
          onChange={(value) => updateField("quantity", value)}
        />
        <SelectField
          label="Unit Type"
          value={form.unitType}
          options={["Pieces", "Cartons", "Packs", "Kg", "Litres"]}
          compact
          onChange={(value) => updateField("unitType", value)}
        />

        <TogglePanel
          checked={isConsignment}
          icon={<Handshake className="size-6" />}
          title="Consignment stock"
          text="Goods received on credit from a supplier"
          tone="amber"
          onChange={(checked) => {
            setIsConsignment(checked);
            if (!checked) {
              updateField("supplierId", "");
              setShowSupplierForm(false);
            }
          }}
        />

        {isConsignment && (
          <div className="space-y-5">
            {suppliersLoading && (
              <div className="rounded-2xl border border-[#d7e2f3] bg-white px-5 py-4 text-[19px] font-semibold text-[#64748b]">
                Loading suppliers...
              </div>
            )}

            {!suppliersLoading && suppliers.length > 0 && (
              <div className="space-y-3">
                <SelectField
                  label="Consignment Supplier *"
                  value={form.supplierId}
                  placeholder="Select supplier"
                  options={suppliers.map((supplier) => ({
                    label: supplier.name,
                    value: supplier.id,
                  }))}
                  onChange={(value) => updateField("supplierId", value)}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[19px] font-bold text-[#2563eb]"
                  onClick={() => setShowSupplierForm(true)}
                >
                  <Plus className="size-5" />
                  Add new supplier
                </button>
              </div>
            )}

            {!suppliersLoading && suppliers.length === 0 && !showSupplierForm && (
              <div className="rounded-[20px] border border-[#fde68a] bg-[#fffaf0] p-5">
                <h3 className="text-[22px] font-extrabold text-[#0f172a]">
                  No supplier added yet
                </h3>
                <p className="mt-1 text-[18px] text-[#6b7280]">
                  Add a supplier first so this consignment item can be linked properly.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-[19px] font-bold text-white"
                  onClick={() => setShowSupplierForm(true)}
                >
                  <Plus className="size-5" />
                  Add Supplier
                </button>
              </div>
            )}

            {showSupplierForm && (
              <SupplierForm
                onCreated={handleSupplierCreated}
                onCancel={
                  suppliers.length > 0 ? () => setShowSupplierForm(false) : undefined
                }
              />
            )}

            <StockField
              label="Owner Cost per Unit (₦) *"
              placeholder="0"
              inputMode="decimal"
              value={form.ownerCostPerUnit}
              onChange={(value) => updateField("ownerCostPerUnit", value)}
            />
            <p className="-mt-3 text-[19px] text-[#475569]">
              What you owe the supplier per unit
            </p>
          </div>
        )}

        <TogglePanel
          checked={restockEnabled}
          icon={<Bell className="size-6" />}
          title="Restocking Settings"
          text="Low-stock alerts and reorder suggestions"
          tone="blue"
          onChange={setRestockEnabled}
        />

        {restockEnabled && (
          <div className="space-y-5">
            <StockField
              label="Low stock alert at"
              placeholder="5"
              inputMode="numeric"
              value={form.lowStockAlertQuantity}
              onChange={(value) => updateField("lowStockAlertQuantity", value)}
            />
            <p className="-mt-3 text-[19px] text-[#475569]">
              Get a notification when stock drops below this number
            </p>
            <StockField
              label="Preferred reorder amount"
              placeholder="Leave empty for a smart suggestion"
              inputMode="numeric"
              value={form.preferredReorderAmount}
              onChange={(value) => updateField("preferredReorderAmount", value)}
            />
            <p className="-mt-3 text-[19px] text-[#475569]">
              How many do you usually buy? Leave empty for a smart suggestion
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[18px] font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          className="h-[72px] w-full rounded-[18px] bg-[#2563eb] text-[23px] font-bold text-white disabled:bg-[#87a8ee]"
          disabled={saving || (isConsignment && !form.supplierId)}
          onClick={handleSubmit}
        >
          {saving ? "Adding item..." : "Add Item"}
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

function StockField({
  label,
  placeholder,
  value,
  inputMode,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[24px] font-semibold text-black">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-[72px] w-full rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 text-[23px] text-[#334155] outline-none placeholder:text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[#3b82ff] focus:ring-2 focus:ring-[#3b82ff]"
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  compact,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: Array<string | { label: string; value: string }>;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[24px] font-semibold text-black">{label}</span>
      <span
        className={cn(
          "relative block",
          compact ? "w-[142px]" : "w-full sm:w-[300px]",
        )}
      >
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-[56px] w-full appearance-none rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 pr-10 text-[23px] text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none focus:border-[#3b82ff] focus:ring-2 focus:ring-[#3b82ff]"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => {
            const item = typeof option === "string" ? { label: option, value: option } : option;
            return (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#94a3b8]" />
      </span>
    </label>
  );
}

function TogglePanel({
  checked,
  icon,
  title,
  text,
  tone,
  onChange,
}: {
  checked: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "amber" | "blue";
  onChange: (checked: boolean) => void;
}) {
  return (
    <section
      className={cn(
        "flex min-h-[92px] items-center justify-between gap-4 rounded-[20px] border px-5 transition-colors",
        tone === "amber" && "border-[#fde68a] bg-[#fffbeb]",
        tone === "blue" && "border-[#cfe0ff] bg-[#eef6ff]",
      )}
    >
      <div className="flex items-center gap-4">
        <span className={cn(tone === "amber" ? "text-[#f59e0b]" : "text-[#1557df]")}>
          {icon}
        </span>
        <span>
          <span className="block text-[23px] font-bold text-[#0f172a]">{title}</span>
          <span className="text-[20px] text-[#66758a]">{text}</span>
        </span>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </section>
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
        checked ? "bg-[#2563eb]" : "bg-[#cbd5e1]",
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "block size-6 rounded-full bg-white shadow-[0_2px_5px_rgba(15,23,42,0.24)] transition-transform duration-200 ease-out",
          checked ? "translate-x-[22px]" : "translate-x-0",
        )}
      />
    </button>
  );
}

function toNumber(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toWholeNumber(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}
