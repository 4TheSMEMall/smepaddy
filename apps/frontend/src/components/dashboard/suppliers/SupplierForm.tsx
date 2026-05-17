"use client";

import { Building2, Landmark, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { getStoredAccessToken } from "@/lib/session";
import { createSupplier, type Supplier } from "@/lib/stockApi";

type SupplierFormState = {
  name: string;
  phone: string;
  email: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  address: string;
  notes: string;
};

const emptySupplierForm: SupplierFormState = {
  name: "",
  phone: "",
  email: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  address: "",
  notes: "",
};

export function SupplierForm({
  onCreated,
  onCancel,
}: {
  onCreated: (supplier: Supplier) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(emptySupplierForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await createSupplier(token, {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        bankName: form.bankName || undefined,
        accountName: form.accountName || undefined,
        accountNumber: form.accountNumber || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
      });
      setForm(emptySupplierForm);
      onCreated(result.supplier);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to add supplier right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof SupplierFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="rounded-[22px] border border-[#d7e2f3] bg-white/70 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
      <div className="mb-5">
        <h3 className="text-[25px] font-extrabold text-[#071122]">Add Supplier</h3>
        <p className="mt-1 text-[18px] text-[#7b8aa4]">
          Save supplier details once, then reuse them for consignment stock.
        </p>
      </div>

      <div className="space-y-4">
        <SupplierField
          icon={<Building2 />}
          label="Supplier Name *"
          placeholder="e.g. Alhaji Musa Provisions"
          value={form.name}
          onChange={(value) => update("name", value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SupplierField
            icon={<Phone />}
            label="Phone"
            placeholder="08012345678"
            value={form.phone}
            onChange={(value) => update("phone", value)}
          />
          <SupplierField
            icon={<Mail />}
            label="Email"
            placeholder="supplier@email.com"
            value={form.email}
            onChange={(value) => update("email", value)}
          />
        </div>

        <div className="pt-2">
          <div className="mb-2 flex items-center gap-2 text-[21px] font-bold text-[#475569]">
            <Landmark className="size-5 text-[#8da0ba]" />
            Bank Details
          </div>
          <p className="mb-4 text-[17px] text-[#8a98b4]">
            For settlement transfers. You can add this later.
          </p>
          <div className="space-y-4">
            <SupplierField
              label="Bank Name"
              placeholder="e.g. GTBank"
              value={form.bankName}
              onChange={(value) => update("bankName", value)}
            />
            <SupplierField
              label="Account Name"
              placeholder="Account holder name"
              value={form.accountName}
              onChange={(value) => update("accountName", value)}
            />
            <SupplierField
              label="Account Number"
              placeholder="0123456789"
              value={form.accountNumber}
              onChange={(value) => update("accountNumber", value)}
            />
          </div>
        </div>

        <SupplierTextarea
          icon={<MapPin />}
          label="Address"
          placeholder="Shop address or pickup location"
          value={form.address}
          onChange={(value) => update("address", value)}
        />
        <SupplierTextarea
          label="Notes"
          placeholder="Any notes about this supplier..."
          value={form.notes}
          onChange={(value) => update("notes", value)}
        />

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[17px] font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              className="h-[58px] flex-1 rounded-[16px] border border-[#d3dbe6] bg-white text-[21px] font-bold text-[#475569]"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="h-[58px] flex-[2] rounded-[16px] bg-[#2563eb] text-[21px] font-bold text-white disabled:bg-[#87a8ee]"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Adding supplier..." : "Add Supplier"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SupplierField({
  icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[21px] font-semibold text-black">
        {icon && <span className="text-[#8da0ba] [&_svg]:size-5">{icon}</span>}
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[64px] w-full rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 text-[22px] text-[#334155] outline-none placeholder:text-[#607086] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[#3b82ff] focus:ring-2 focus:ring-[#3b82ff]"
        placeholder={placeholder}
      />
    </label>
  );
}

function SupplierTextarea({
  icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[21px] font-semibold text-black">
        {icon && <span className="text-[#8da0ba] [&_svg]:size-5">{icon}</span>}
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[96px] w-full resize-y rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 py-4 text-[22px] text-[#334155] outline-none placeholder:text-[#607086] shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-[#3b82ff] focus:ring-2 focus:ring-[#3b82ff]"
        placeholder={placeholder}
      />
    </label>
  );
}
