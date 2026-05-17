"use client";

import {
  ArrowLeft,
  ChevronRight,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { expenseCategoryItems } from "@/data/dashboard";
import { ApiError } from "@/lib/api";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  listRecurringExpenses,
  updateRecurringExpense,
  type CreateRecurringExpensePayload,
  type RecurringExpenseItem,
  type RecurringFrequency,
  type RecurringPaymentMethod,
} from "@/lib/recurringExpenseApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

const HOUR_OPTIONS = [
  { label: "6:00 AM", value: 6 },
  { label: "7:00 AM", value: 7 },
  { label: "8:00 AM", value: 8 },
  { label: "9:00 AM", value: 9 },
  { label: "12:00 PM", value: 12 },
  { label: "3:00 PM", value: 15 },
  { label: "6:00 PM", value: 18 },
  { label: "9:00 PM", value: 21 },
];

const DAY_OF_WEEK_OPTIONS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

type Mode = "list" | "add";

export function RecurringExpensesScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("list");
  const [items, setItems] = useState<RecurringExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      const result = await listRecurringExpenses(token);
      setItems(result.recurringExpenses);
    } catch {
      setError("Unable to load recurring expenses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleToggle(item: RecurringExpenseItem) {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      const updated = await updateRecurringExpense(token, item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated.recurringExpense : i)));
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await deleteRecurringExpense(token, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ }
  }

  if (mode === "add") {
    return (
      <AddRecurringExpenseForm
        onBack={() => setMode("list")}
        onCreated={(item) => {
          setItems((prev) => [item, ...prev]);
          setMode("list");
        }}
      />
    );
  }

  // Projected monthly cost from active recurring expenses
  const projectedMonthly = items
    .filter((i) => i.isActive)
    .reduce((sum, i) => {
      if (i.frequency === "DAILY") return sum + i.amount * 30;
      if (i.frequency === "WEEKLY") return sum + i.amount * 4.3;
      return sum + i.amount;
    }, 0);

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="grid size-9 place-items-center" onClick={onBack}>
            <ArrowLeft className="size-7" />
          </button>
          <div>
            <h2 className="text-[31px] font-extrabold text-[#071122]">Recurring</h2>
            <p className="text-[17px] text-[#8b99b3]">
              {items.filter((i) => i.isActive).length} active automation
              {items.filter((i) => i.isActive).length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMode("add")}
          className="flex h-12 items-center gap-2 rounded-3xl bg-[#ef3b42] px-5 text-[17px] font-bold text-white"
        >
          <Plus className="size-5" />
          Add New
        </button>
      </div>

      {/* Projected monthly summary */}
      {items.length > 0 && (
        <div className="mb-6 rounded-[22px] bg-[#fff5f5] px-6 py-5">
          <p className="text-[15px] font-semibold uppercase tracking-wide text-[#ef3b42]">
            Projected This Month
          </p>
          <p className="mt-1 text-[32px] font-extrabold text-[#ef3b42]">
            {formatMoney(projectedMonthly)}
          </p>
          <p className="mt-1 text-[15px] text-[#94a3b8]">
            Based on {items.filter((i) => i.isActive).length} active recurring expense
            {items.filter((i) => i.isActive).length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {loading && (
        <p className="py-10 text-center text-[18px] text-[#94a3b8]">Loading...</p>
      )}
      {error && (
        <p className="py-6 text-center text-[17px] font-semibold text-[#ef3b42]">{error}</p>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-[24px] bg-white px-6 py-12 text-center shadow-[0_4px_20px_rgba(15,23,42,0.07)]">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-[#fff5f5] text-[#ef3b42]">
            <RefreshCw className="size-8" />
          </div>
          <h3 className="text-[24px] font-extrabold text-[#0f172a]">No recurring expenses</h3>
          <p className="mt-2 text-[18px] text-[#64748b]">
            Set up automatic expenses like rent, electricity, or generator fuel.
          </p>
          <button
            type="button"
            onClick={() => setMode("add")}
            className="mt-6 flex h-12 items-center gap-2 rounded-3xl bg-[#ef3b42] px-6 text-[17px] font-bold text-white mx-auto"
          >
            <Plus className="size-5" />
            Add First Recurring Expense
          </button>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <RecurringExpenseCard
            key={item.id}
            item={item}
            onToggle={() => handleToggle(item)}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RecurringExpenseCard({
  item,
  onToggle,
  onDelete,
}: {
  item: RecurringExpenseItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const CategoryIcon =
    expenseCategoryItems.find((c) => c.label === item.category)?.icon ?? RefreshCw;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-white px-5 py-5 shadow-[0_4px_20px_rgba(15,23,42,0.07)]",
        !item.isActive && "opacity-60",
      )}
    >
      {/* Left accent */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[5px] rounded-l-[20px]",
          item.isActive ? "bg-[#ef3b42]" : "bg-[#cbd5e1]",
        )}
      />

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="grid size-[52px] shrink-0 place-items-center rounded-[18px] bg-[#fff0f0] text-[#ef3b42]">
          <CategoryIcon className="size-[22px]" />
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[20px] font-extrabold text-[#0f172a]">{item.category}</p>
            <FrequencyBadge item={item} />
          </div>
          <p className="mt-0.5 text-[17px] font-bold text-[#ef3b42]">
            {formatMoney(item.amount)}
            <span className="ml-1 font-normal text-[#94a3b8]">· {formatMethod(item.paymentMethod)}</span>
          </p>
          <p className="mt-2 text-[15px] text-[#64748b]">
            <span className="font-semibold text-[#0f172a]">Next: </span>
            {formatNextRun(item.nextRunAt, item.hourOfDay)}
          </p>
          {item.lastRunAt && (
            <p className="text-[14px] text-[#94a3b8]">
              Last recorded {timeAgo(item.lastRunAt)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "grid size-10 place-items-center rounded-full",
              item.isActive ? "bg-[#e0f2fe] text-[#0284c7]" : "bg-[#f1f5f9] text-[#64748b]",
            )}
            title={item.isActive ? "Pause" : "Resume"}
          >
            {item.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="grid size-10 place-items-center rounded-full bg-[#fff0f0] text-[#ef3b42]"
            title="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FrequencyBadge({ item }: { item: RecurringExpenseItem }) {
  let label = "";
  if (item.frequency === "DAILY") label = "Daily";
  if (item.frequency === "WEEKLY") {
    const day = DAY_OF_WEEK_OPTIONS.find((d) => d.value === item.dayOfWeek)?.label ?? "";
    label = `Weekly · ${day}`;
  }
  if (item.frequency === "MONTHLY") label = `Monthly · ${ordinal(item.dayOfMonth ?? 1)}`;

  return (
    <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[13px] font-bold text-[#64748b]">
      {label}
    </span>
  );
}

function AddRecurringExpenseForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (item: RecurringExpenseItem) => void;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<RecurringPaymentMethod>("CASH");
  const [frequency, setFrequency] = useState<RecurringFrequency>("DAILY");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday default
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourOfDay, setHourOfDay] = useState(8);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!category) { setError("Please select a category."); return; }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { setError("Please enter a valid amount."); return; }

    const token = getStoredAccessToken();
    if (!token) { setError("Session expired. Please log in again."); return; }

    setSaving(true);
    setError(null);

    const payload: CreateRecurringExpensePayload = {
      category,
      amount: amountNum,
      description: description.trim() || undefined,
      paymentMethod,
      frequency,
      hourOfDay,
      ...(frequency === "WEEKLY" ? { dayOfWeek } : {}),
      ...(frequency === "MONTHLY" ? { dayOfMonth } : {}),
    };

    try {
      const result = await createRecurringExpense(token, payload);
      onCreated(result.recurringExpense);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-8 flex items-center gap-4">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <h2 className="text-[28px] font-extrabold text-[#071122]">New Recurring Expense</h2>
      </div>

      {/* Category */}
      <p className="mb-3 text-[22px] font-semibold">Category</p>
      <div className="mb-8 grid grid-cols-4 gap-3">
        {expenseCategoryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setCategory(item.label)}
            className={cn(
              "flex h-[80px] flex-col items-center justify-center gap-2 rounded-[16px] text-[16px] transition-colors",
              category === item.label ? "bg-[#ef3b42] text-white" : "bg-[#f1f5fa] text-[#334155]",
            )}
          >
            <item.icon className="size-6" />
            <span className="text-center leading-tight">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Amount */}
      <label className="mb-6 block">
        <span className="mb-2 block text-[22px] font-semibold">Amount (₦)</span>
        <input
          type="number"
          className="h-[64px] w-full rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 text-[22px] text-[#334155] outline-none placeholder:text-[#94a3b8]"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      {/* Description */}
      <label className="mb-6 block">
        <span className="mb-2 block text-[22px] font-semibold">Description (optional)</span>
        <input
          type="text"
          className="h-[64px] w-full rounded-[11px] border border-[#d3dbe6] bg-transparent px-5 text-[22px] text-[#334155] outline-none placeholder:text-[#94a3b8]"
          placeholder="e.g. Shop generator fuel"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      {/* Payment method */}
      <p className="mb-3 text-[22px] font-semibold">Payment Method</p>
      <div className="mb-8 flex gap-3">
        {(["CASH", "TRANSFER", "CARD"] as RecurringPaymentMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPaymentMethod(m)}
            className={cn(
              "flex-1 rounded-[12px] py-3 text-[18px] font-bold transition-colors",
              paymentMethod === m ? "bg-[#2563eb] text-white" : "bg-[#f1f5f9] text-[#334155]",
            )}
          >
            {m[0] + m.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Frequency */}
      <p className="mb-3 text-[22px] font-semibold">Repeats</p>
      <div className="mb-6 flex gap-3">
        {(["DAILY", "WEEKLY", "MONTHLY"] as RecurringFrequency[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFrequency(f)}
            className={cn(
              "flex-1 rounded-[12px] py-3 text-[18px] font-bold transition-colors",
              frequency === f ? "bg-[#ef3b42] text-white" : "bg-[#f1f5f9] text-[#334155]",
            )}
          >
            {f[0] + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Weekly: day of week */}
      {frequency === "WEEKLY" && (
        <div className="mb-6">
          <p className="mb-3 text-[22px] font-semibold">Day of Week</p>
          <div className="flex flex-wrap gap-2">
            {DAY_OF_WEEK_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDayOfWeek(d.value)}
                className={cn(
                  "rounded-full px-4 py-2 text-[16px] font-bold transition-colors",
                  dayOfWeek === d.value ? "bg-[#ef3b42] text-white" : "bg-[#f1f5f9] text-[#334155]",
                )}
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: day of month */}
      {frequency === "MONTHLY" && (
        <div className="mb-6">
          <p className="mb-3 text-[22px] font-semibold">Day of Month</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDayOfMonth(d)}
                className={cn(
                  "size-10 rounded-full text-[16px] font-bold transition-colors",
                  dayOfMonth === d ? "bg-[#ef3b42] text-white" : "bg-[#f1f5f9] text-[#334155]",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time of day */}
      <p className="mb-3 text-[22px] font-semibold">Time</p>
      <div className="mb-8 flex flex-wrap gap-2">
        {HOUR_OPTIONS.map((h) => (
          <button
            key={h.value}
            type="button"
            onClick={() => setHourOfDay(h.value)}
            className={cn(
              "rounded-full px-4 py-2 text-[16px] font-bold transition-colors",
              hourOfDay === h.value ? "bg-[#ef3b42] text-white" : "bg-[#f1f5f9] text-[#334155]",
            )}
          >
            {h.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-[17px] font-semibold text-[#ef3b42]">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="h-[68px] w-full rounded-[18px] bg-[#ef3b42] text-[22px] font-bold text-white shadow-[0_2px_5px_rgba(15,23,42,0.12)] disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Recurring Expense"}
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNextRun(nextRunAt: string, hourOfDay: number): string {
  const next = new Date(nextRunAt);
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const tomorrowMidnight = new Date(todayMidnight);
  tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
  const dayAfterMidnight = new Date(tomorrowMidnight);
  dayAfterMidnight.setDate(dayAfterMidnight.getDate() + 1);

  const hour = hourOfDay;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const timeStr = `${displayHour}:00 ${period}`;

  if (next >= todayMidnight && next < tomorrowMidnight) return `Today at ${timeStr}`;
  if (next >= tomorrowMidnight && next < dayAfterMidnight) return `Tomorrow at ${timeStr}`;
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" }).format(next) + ` at ${timeStr}`;
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMethod(method: string) {
  return method[0] + method.slice(1).toLowerCase();
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
