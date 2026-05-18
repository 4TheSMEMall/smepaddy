"use client";

import { ChevronDown, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { listCustomers, type Customer } from "@/lib/customerApi";
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
    if (selected) return; // don't search if already selected
    if (!value.trim()) { setSuggestions([]); return; }

    const token = getStoredAccessToken();
    if (!token) return;

    const t = setTimeout(() => {
      listCustomers(token, value.trim())
        .then((res) => { setSuggestions(res.customers); setOpen(res.customers.length > 0); })
        .catch(() => {});
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

  function handleClear() {
    setSelected(null);
    onChange("");
    onSelect(null);
    setSuggestions([]);
  }

  return (
    <div ref={ref} className="relative">
      <label className="mb-2 block text-[24px] font-semibold">Customer</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              if (selected) { setSelected(null); onSelect(null); }
              onChange(e.target.value);
            }}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            placeholder={placeholder}
            className="h-[64px] w-full rounded-[11px] border border-[#d3dbe6] bg-transparent pl-5 pr-10 text-[22px] text-[#334155] outline-none placeholder:text-[#94a3b8] focus:border-[#1557df]"
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
      </div>

      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-[10px] bg-[#eef4ff] px-3 py-1.5">
          <div className="size-5 rounded-full bg-[#1557df] text-center text-[11px] font-bold leading-5 text-white">
            {selected.name.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-[14px] font-semibold text-[#1557df]">
            {selected.name}
            {selected.phone && ` · ${selected.phone}`}
          </p>
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[14px] border border-[#d3dbe6] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f8fafc]"
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
        </div>
      )}
    </div>
  );
}
