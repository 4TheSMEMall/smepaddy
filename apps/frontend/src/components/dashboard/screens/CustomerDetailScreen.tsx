"use client";

import {
  ArrowLeft,
  Edit3,
  FileText,
  Mail,
  Phone,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  deleteCustomer,
  getCustomer,
  updateCustomer,
  type CustomerDetail,
} from "@/lib/customerApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export function CustomerDetailScreen({
  customerId,
  onBack,
  onDeleted,
  onOpenInvoice,
  onOpenSale,
}: {
  customerId: string;
  onBack: () => void;
  onDeleted: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
  onOpenSale?: (saleId: string) => void;
}) {
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    getCustomer(token, customerId)
      .then((res) => {
        setData(res);
        setEditName(res.customer.name);
        setEditPhone(res.customer.phone ?? "");
        setEditEmail(res.customer.email ?? "");
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  async function handleSave() {
    const token = getStoredAccessToken();
    if (!token || !data) return;
    setSaving(true);
    try {
      const res = await updateCustomer(token, customerId, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
      });
      setData((prev) => prev ? { ...prev, customer: { ...prev.customer, ...res.customer } } : prev);
      setEditing(false);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Update failed.");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await deleteCustomer(token, customerId);
      onDeleted();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="size-8 animate-spin rounded-full border-4 border-[#f1f5f9] border-t-[#071122]" />
    </div>
  );

  if (!data) return null;

  const { customer, invoices, sales } = data;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setEditing((v) => !v)}
            className="grid size-10 place-items-center rounded-full bg-[#f1f5f9] text-[#334155]">
            <Edit3 className="size-5" />
          </button>
          <button type="button" onClick={() => setConfirming(true)}
            className="grid size-10 place-items-center rounded-full bg-[#fff0f0] text-[#ef3b42]">
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-[24px] bg-gradient-to-br from-[#071122] to-[#1e3a5f] px-5 py-6 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
        <div className="mb-3 grid size-14 place-items-center rounded-full bg-white/20 text-[22px] font-extrabold">
          {customer.name.slice(0, 1).toUpperCase()}
        </div>
        <p className="text-[22px] font-extrabold leading-tight">{customer.name}</p>
        {customer.phone && (
          <p className="mt-1 flex items-center gap-2 text-[16px] text-white/70">
            <Phone className="size-4" /> {customer.phone}
          </p>
        )}
        {customer.email && (
          <p className="mt-1 flex items-center gap-2 text-[16px] text-white/70">
            <Mail className="size-4" /> {customer.email}
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatBubble label="Invoices" value={customer.stats.totalInvoices} />
          <StatBubble label="Sales" value={customer.stats.totalSales} />
          <StatBubble label="Outstanding" value={formatMoney(customer.stats.totalOutstanding)} red={customer.stats.totalOutstanding > 0} />
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="rounded-[22px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
          <p className="mb-4 text-[18px] font-extrabold">Edit Customer</p>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name"
            className="mb-3 h-[54px] w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[17px] outline-none focus:border-[#071122]" />
          <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone"
            className="mb-3 h-[54px] w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[17px] outline-none focus:border-[#071122]" />
          <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email"
            className="mb-4 h-[54px] w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[17px] outline-none focus:border-[#071122]" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(false)}
              className="flex-1 rounded-[12px] bg-[#f1f5f9] py-3 text-[16px] font-bold text-[#334155]">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 rounded-[12px] bg-[#071122] py-3 text-[16px] font-bold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirming && (
        <div className="rounded-[22px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
          <p className="mb-1 text-[18px] font-extrabold text-[#071122]">Delete {customer.name}?</p>
          <p className="mb-4 text-[15px] text-[#64748b]">Their invoices and sales history will stay but the customer link is removed.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirming(false)}
              className="flex-1 rounded-[12px] bg-[#f1f5f9] py-3 text-[16px] font-bold text-[#334155]">Cancel</button>
            <button type="button" onClick={handleDelete}
              className="flex-1 rounded-[12px] bg-[#ef3b42] py-3 text-[16px] font-bold text-white">Delete</button>
          </div>
        </div>
      )}

      {msg && <p className="rounded-[12px] bg-[#fff0f0] px-4 py-3 text-[15px] font-semibold text-[#ef3b42]">{msg}</p>}

      {/* Unpaid invoices */}
      {invoices.filter((inv) => inv.balance > 0).length > 0 && (
        <div>
          <p className="mb-2 text-[14px] font-bold uppercase tracking-wide text-[#ef3b42]">
            Outstanding Invoices
          </p>
          <div className="space-y-2">
            {invoices.filter((inv) => inv.balance > 0).map((inv) => (
              <button key={inv.id} type="button" onClick={() => onOpenInvoice?.(inv.id)}
                className="flex w-full items-center justify-between rounded-[16px] bg-[#fff5f5] px-4 py-4 text-left active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-[#ef3b42]" />
                  <div>
                    <p className="text-[15px] font-bold text-[#071122]">INV-{inv.id.slice(-4).toUpperCase()}</p>
                    <p className="text-[13px] text-[#94a3b8]">Due {formatDate(inv.dueDate)}</p>
                  </div>
                </div>
                <p className="text-[16px] font-extrabold text-[#ef3b42]">{formatMoney(inv.balance)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All invoices */}
      {invoices.length > 0 && (
        <div>
          <p className="mb-2 text-[14px] font-bold uppercase tracking-wide text-[#94a3b8]">All Invoices</p>
          <div className="rounded-[20px] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.07)] overflow-hidden">
            {invoices.map((inv, i) => (
              <button key={inv.id} type="button" onClick={() => onOpenInvoice?.(inv.id)}
                className={cn("flex w-full items-center justify-between px-5 py-4 text-left",
                  i < invoices.length - 1 && "border-b border-[#f0f4f9]")}>
                <div>
                  <p className="text-[16px] font-bold text-[#071122]">INV-{inv.id.slice(-4).toUpperCase()}</p>
                  <p className="text-[13px] text-[#94a3b8]">{formatDate(inv.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-[#071122]">{formatMoney(inv.subtotal)}</p>
                  <span className={cn("text-[12px] font-bold",
                    inv.status === "PAID" ? "text-[#059669]" : "text-[#d97706]")}>
                    {inv.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sales */}
      {sales.length > 0 && (
        <div>
          <p className="mb-2 text-[14px] font-bold uppercase tracking-wide text-[#94a3b8]">Sales History</p>
          <div className="rounded-[20px] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.07)] overflow-hidden">
            {sales.map((s, i) => (
              <button key={s.id} type="button" onClick={() => onOpenSale?.(s.id)}
                className={cn("flex w-full items-center justify-between px-5 py-4 text-left",
                  i < sales.length - 1 && "border-b border-[#f0f4f9]")}>
                <div className="flex items-center gap-3">
                  <ShoppingBag className="size-4 text-[#059669]" />
                  <div>
                    <p className="truncate text-[15px] font-bold text-[#071122]">
                      {s.itemNames.join(", ") || "Sale"}
                    </p>
                    <p className="text-[13px] text-[#94a3b8]">{formatDate(s.createdAt)}</p>
                  </div>
                </div>
                <p className="shrink-0 text-[15px] font-bold text-[#059669]">+{formatMoney(s.amountPaid)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBubble({ label, value, red }: { label: string; value: string | number; red?: boolean }) {
  return (
    <div className="rounded-[14px] bg-white/15 px-3 py-3 text-center">
      <p className="text-[11px] text-white/60">{label}</p>
      <p className={cn("mt-0.5 text-[16px] font-extrabold", red ? "text-[#fca5a5]" : "text-white")}>{value}</p>
    </div>
  );
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
