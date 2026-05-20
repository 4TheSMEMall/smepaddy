"use client";

import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  FileText,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { expenseCategoryItems } from "@/data/dashboard";
import { IconBubble } from "@/components/dashboard/IconBubble";
import { deleteExpense } from "@/lib/expenseApi";
import type { ExpenseItem } from "@/lib/expenseApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types/dashboard";

export function ExpenseDetailScreen({
  expense,
  onBack,
  onDeleted,
}: {
  expense: ExpenseItem;
  onBack: () => void;
  onDeleted?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const token = getStoredAccessToken();
    if (!token) return;
    setDeleting(true);
    try {
      await deleteExpense(token, expense.id);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  }
  const CategoryIcon =
    expenseCategoryItems.find((c) => c.label === expense.category)?.icon ?? Tag;

  return (
    <div className="space-y-5 pb-8">
      <button className="grid size-10 place-items-center rounded-full bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)]" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>

      {/* Hero card — red gradient */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#ef3b42] to-[#b91c1c] px-5 py-7 text-white shadow-[0_14px_36px_rgba(185,28,28,0.28)] sm:rounded-[28px] sm:px-7 sm:py-9">
        <div className="pointer-events-none absolute -right-10 -top-10 size-[180px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 size-[140px] rounded-full bg-white/[0.07]" />

        <div className="relative">
          <div className="mb-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[16px] font-bold backdrop-blur-sm">
              <CategoryIcon className="size-4" />
              {expense.category}
            </span>
          </div>

          <p className="break-words text-center text-[34px] font-extrabold leading-none tracking-tight sm:text-[54px]">
            -{formatMoney(expense.amount)}
          </p>
          <p className="mt-3 text-center text-[14px] font-semibold text-white/70 sm:text-[18px]">
            {formatFullDate(expense.createdAt)}
          </p>
        </div>
      </div>

      {/* Detail rows */}
      <div className="rounded-[22px] bg-white px-4 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.07)] sm:rounded-[24px] sm:px-6">
        <DetailRow
          icon={<Tag className="size-5" />}
          tone="amber"
          label="Category"
          value={expense.category}
        />
        <DetailRow
          icon={<CreditCard className="size-5" />}
          tone="blue"
          label="Payment Method"
          value={formatMethod(expense.paymentMethod)}
        />
        {expense.description && (
          <DetailRow
            icon={<FileText className="size-5" />}
            tone="slate"
            label="Description"
            value={expense.description}
          />
        )}
        <DetailRow
          icon={<CalendarDays className="size-5" />}
          tone="green"
          label="Date"
          value={formatFullDate(expense.createdAt)}
          last
        />
      </div>

      {/* Delete */}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#fecdd3] bg-[#fff5f5] py-4 text-[18px] font-bold text-[#ef3b42]"
        >
          <Trash2 className="size-5" />
          Delete Expense
        </button>
      ) : (
        <div className="rounded-[18px] border border-[#fecdd3] bg-[#fff5f5] p-5 text-center">
          <p className="mb-4 text-[17px] font-semibold text-[#0f172a]">
            Delete this expense record?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-[14px] bg-[#f1f5f9] py-3 text-[17px] font-bold text-[#334155]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-[14px] bg-[#ef3b42] py-3 text-[17px] font-bold text-white disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon,
  tone,
  label,
  value,
  last,
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3 py-4 sm:items-center sm:gap-4 sm:py-5", !last && "border-b border-[#f0f4f9]")}>
      <IconBubble tone={tone}>{icon}</IconBubble>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#94a3b8]">{label}</p>
        <div className="mt-0.5 break-words text-[15px] font-semibold text-[#0f172a] sm:text-[20px]">{value}</div>
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMethod(method: string) {
  return method[0] + method.slice(1).toLowerCase();
}
