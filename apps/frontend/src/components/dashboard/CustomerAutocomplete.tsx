"use client";

import { Loader2, Plus, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createCustomer, listCustomers, type Customer } from "@/lib/customerApi";
import { getStoredAccessToken } from "@/lib/session";

export function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Customer name (optional)",
}: {
  value: string;
  onChange: (name: string) => void;
  onSelect: (customer: Customer | null) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search customers as user types
  useEffect(() => {
    if (selected) return;
    const trimmed = value.trim();

    if (!trimmed) {
      const t = setTimeout(() => {
        setSuggestions([]);
        setOpen(false);
      }, 0);
      return () => clearTimeout(t);
    }

    const token = getStoredAccessToken();
    if (!token) return;

    const t = setTimeout(() => {
      listCustomers(token, trimmed)
        .then((res) => { setSuggestions(res.customers); })
        .catch(() => { setSuggestions([]); })
        .finally(() => { setOpen(true); }); // always open — shows "Add new" even if API fails
    }, 250);

    return () => clearTimeout(t);
  }, [value, selected]);

  function handleSelect(customer: Customer) {
    setSelected(customer);
    onChange(customer.name);
    onSelect(customer);
    setSuggestions([]);
    setOpen(false);
  }

  async function handleCreateNew() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const token = getStoredAccessToken();
    if (!token) return;

    setCreating(true);
    try {
      const res = await createCustomer(token, { name: trimmed });
      handleSelect(res.customer);
    } catch {
      // silently fail — user can still type manually
    } finally {
      setCreating(false);
    }
  }

  function handleClear() {
    setSelected(null);
    onChange("");
    onSelect(null);
    setSuggestions([]);
    setOpen(false);
  }

  // Show "Add new" option when typed name isn't an exact case-insensitive match
  const trimmedValue = value.trim();
  const isExactMatch = suggestions.some(
    (c) => c.name.toLowerCase() === trimmedValue.toLowerCase(),
  );
  const showAddNew = !selected && trimmedValue.length > 0 && !isExactMatch;

  return (
    <div ref={ref} className="relative">
      <label className="mb-2 block text-[16px] font-semibold text-[#071122] sm:text-[24px]">Customer</label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (selected) { setSelected(null); onSelect(null); }
            onChange(e.target.value);
          }}
          onFocus={() => { if (trimmedValue && !selected) setOpen(true); }}
          placeholder={placeholder}
          className="h-14 w-full rounded-[14px] border border-[#d3dbe6] bg-white pl-4 pr-10 text-[16px] text-[#334155] outline-none placeholder:text-[#94a3b8] focus:border-[#1557df] focus:ring-2 focus:ring-[#d7e4ff] sm:h-[64px] sm:rounded-[11px] sm:pl-5 sm:text-[22px]"
        />
        {selected ? (
          <button type="button" onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="size-5 text-[#94a3b8]" />
          </button>
        ) : (
          <User className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#c3cdd8]" />
        )}
      </div>

      {/* Selected customer chip */}
      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-[10px] bg-[#eef4ff] px-3 py-1.5">
          <div className="grid size-5 place-items-center rounded-full bg-[#1557df] text-[11px] font-bold text-white">
            {selected.name.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-[14px] font-semibold text-[#1557df]">
            {selected.name}{selected.phone && ` · ${selected.phone}`}
          </p>
        </div>
      )}

      {/* Dropdown */}
      {open && (suggestions.length > 0 || showAddNew) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[14px] border border-[#d3dbe6] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">

          {/* Existing customers */}
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
              className="flex w-full items-center gap-3 border-b border-[#f1f5f9] px-4 py-3 text-left last:border-0 hover:bg-[#f8fafc]"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1f5f9] text-[14px] font-bold text-[#334155]">
                {c.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-[16px] font-bold text-[#071122]">{c.name}</p>
                {c.phone && <p className="text-[13px] text-[#94a3b8]">{c.phone}</p>}
              </div>
            </button>
          ))}

          {/* Add new customer option */}
          {showAddNew && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(e) => { e.preventDefault(); void handleCreateNew(); }}
              className="flex w-full items-center gap-3 bg-[#f0fdf4] px-4 py-3 text-left hover:bg-[#dcfce7] disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="size-5 animate-spin text-[#059669]" />
              ) : (
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dcfce7]">
                  <Plus className="size-5 text-[#059669]" />
                </div>
              )}
              <div>
                <p className="text-[16px] font-bold text-[#059669]">
                  {creating ? "Saving…" : `Add "${trimmedValue}" as new customer`}
                </p>
                <p className="text-[13px] text-[#16a34a]">
                  Save and link to this {suggestions.length > 0 ? "invoice" : "record"}
                </p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
