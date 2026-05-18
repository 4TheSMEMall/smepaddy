"use client";

import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  createCustomer,
  listCustomers,
  type Customer,
} from "@/lib/customerApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export function CustomersScreen({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (customer: Customer) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(q?: string) {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      const res = await listCustomers(token, q);
      setCustomers(res.customers);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required."); return; }
    const token = getStoredAccessToken();
    if (!token) return;
    setSaving(true); setError(null);
    try {
      const res = await createCustomer(token, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setCustomers((prev) => [res.customer, ...prev]);
      setName(""); setPhone(""); setEmail("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create customer.");
    } finally { setSaving(false); }
  }

  return (
    <div className="mx-4 pb-8 sm:mx-0">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="grid size-9 place-items-center" onClick={onBack}>
            <ArrowLeft className="size-7" />
          </button>
          <div>
            <h2 className="text-[31px] font-extrabold leading-none text-[#071122]">Customers</h2>
            <p className="mt-0.5 text-[16px] text-[#8b99b3]">{customers.length} contact{customers.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex h-12 items-center gap-2 rounded-3xl bg-[#071122] px-5 text-[16px] font-bold text-white"
        >
          <Plus className="size-5" />
          New
        </button>
      </div>

      {/* Add customer form */}
      {showForm && (
        <div className="mb-5 rounded-[22px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.09)]">
          <p className="mb-4 text-[18px] font-extrabold text-[#071122]">New Customer</p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *"
            className="mb-3 h-[56px] w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[17px] outline-none focus:border-[#071122]" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number"
            className="mb-3 h-[56px] w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[17px] outline-none focus:border-[#071122]" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)"
            className="mb-4 h-[56px] w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[17px] outline-none focus:border-[#071122]" />
          {error && <p className="mb-3 text-[15px] font-semibold text-[#ef3b42]">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 rounded-[12px] bg-[#f1f5f9] py-3 text-[16px] font-bold text-[#334155]">
              Cancel
            </button>
            <button type="button" onClick={handleCreate} disabled={saving}
              className="flex-1 rounded-[12px] bg-[#071122] py-3 text-[16px] font-bold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <label className="mb-5 flex h-14 items-center gap-3 rounded-[16px] border border-[#dce3ec] bg-white px-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <Search className="size-5 text-[#94a3b8]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…"
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-[#94a3b8]" />
      </label>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-[#94a3b8]" />
        </div>
      )}

      {!loading && customers.length === 0 && (
        <div className="rounded-[24px] bg-white px-6 py-12 text-center shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          <Users className="mx-auto mb-4 size-12 text-[#94a3b8]" />
          <p className="text-[20px] font-extrabold text-[#071122]">No customers yet</p>
          <p className="mt-2 text-[16px] text-[#64748b]">Add your first customer using the New button above.</p>
        </div>
      )}

      <div className="space-y-3">
        {customers.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className="flex w-full items-center gap-4 rounded-[18px] bg-white px-5 py-4 text-left shadow-[0_4px_16px_rgba(15,23,42,0.07)] active:scale-[0.98] transition-transform"
          >
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f1f5f9] text-[18px] font-extrabold text-[#334155]">
              {c.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-bold text-[#071122]">{c.name}</p>
              {c.phone && (
                <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-[#94a3b8]">
                  <Phone className="size-3.5" /> {c.phone}
                </p>
              )}
            </div>
            <ChevronRight className="size-5 shrink-0 text-[#c3cdd8]" />
          </button>
        ))}
      </div>
    </div>
  );
}
