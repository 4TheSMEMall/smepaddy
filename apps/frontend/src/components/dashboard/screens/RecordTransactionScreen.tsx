"use client";

import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Minus,
  Plus,
  PlusCircle,
  ReceiptText,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerAutocomplete } from "@/components/dashboard/CustomerAutocomplete";
import { getCustomerUnpaidInvoices, type Customer } from "@/lib/customerApi";
import { expenseCategoryItems } from "@/data/dashboard";
import { ApiError } from "@/lib/api";
import {
  makeCacheKey,
  readClientCache,
  removeClientCache,
  writeClientCache,
} from "@/lib/clientCache";
import { createExpense, type ExpensePaymentMethod } from "@/lib/expenseApi";
import { listInvoices, type Invoice } from "@/lib/invoiceApi";
import {
  createSale,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/salesApi";
import { getStoredAccessToken } from "@/lib/session";
import { listStockItems, type StockItem } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import type { RecordMode } from "@/types/dashboard";


type PaymentStatusLabel = "Paid" | "Part Payment" | "Will Pay Later";
type PaymentMethodLabel = "Cash" | "Transfer" | "Card";
type InvoiceMode = "existing" | "new";

const paymentStatusMap: Record<PaymentStatusLabel, PaymentStatus> = {
  Paid: "PAID",
  "Part Payment": "PART_PAYMENT",
  "Will Pay Later": "WILL_PAY_LATER",
};

const paymentMethodMap: Record<PaymentMethodLabel, PaymentMethod> = {
  Cash: "CASH",
  Transfer: "TRANSFER",
  Card: "CARD",
};

export function RecordTransactionScreen({
  mode,
  onModeChange,
  onBack,
  onDiscard,
  onRecorded,
}: {
  mode: RecordMode;
  onModeChange: (mode: RecordMode) => void;
  onBack: () => void;
  onDiscard: () => void;
  onRecorded: () => void;
}) {
  const isExpense = mode === "expense";

  return (
    <div className="space-y-5 sm:mx-0">
      <div className="flex items-center gap-3">
        <button className="grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)]" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="text-[20px] font-extrabold leading-tight text-[#071122] sm:text-[29px]">Record Transaction</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        <ModeButton
          active={!isExpense}
          icon={<ShoppingCart className="size-6" />}
          label="Record Sale"
          tone="sale"
          onClick={() => onModeChange("sale")}
        />
        <ModeButton
          active={isExpense}
          icon={<Banknote className="size-6" />}
          label="Record Expense"
          tone="expense"
          onClick={() => onModeChange("expense")}
        />
      </div>

      {isExpense ? (
        <ExpenseForm onDiscard={onDiscard} onRecorded={onRecorded} />
      ) : (
        <SaleForm onDiscard={onDiscard} onRecorded={onRecorded} />
      )}
    </div>
  );
}

function SaleForm({
  onDiscard,
  onRecorded,
}: {
  onDiscard: () => void;
  onRecorded: () => void;
}) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [useWholesale, setUseWholesale] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoiceCustomer, setSelectedInvoiceCustomer] = useState<Customer | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusLabel>("Paid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>("Cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("existing");
  const [invoiceCustomerName, setInvoiceCustomerName] = useState("");
  const [invoiceCustomerPhone, setInvoiceCustomerPhone] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState(defaultDueDate());
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      const token = getStoredAccessToken();
      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await listStockItems(token, { limit: 50 });
        if (!cancelled) {
          setItems(response.items.filter((item) => item.itemType === "PRODUCT"));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Unable to load stock items.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedItem = items.find((item) => item.id === selectedId);
  const canUseWholesale = Boolean(selectedItem && selectedItem.wholesalePrice > 0);
  const unitPrice = selectedItem
    ? useWholesale && canUseWholesale
      ? selectedItem.wholesalePrice
      : selectedItem.sellingPrice
    : 0;
  const total = unitPrice * quantity;
  const normalizedStatus = paymentStatusMap[paymentStatus];
  const amountPaidValue = Number(amountPaid || 0);
  const balance = useMemo(() => {
    if (normalizedStatus === "PAID") return 0;
    if (normalizedStatus === "WILL_PAY_LATER") return total;
    return Math.max(0, total - amountPaidValue);
  }, [amountPaidValue, normalizedStatus, total]);
  const requiresInvoice = normalizedStatus !== "PAID";
  const openInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.balance > 0 && invoice.status !== "PAID")
        .sort((first, second) => second.balance - first.balance),
    [invoices],
  );

  useEffect(() => {
    if (!requiresInvoice) {
      const timer = setTimeout(() => {
        setSelectedInvoiceId(null);
        setInvoiceMode("existing");
        setInvoices([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    async function loadInvoices() {
      const token = getStoredAccessToken();
      if (!token) return;

      setInvoicesLoading(true);
      try {
        // If a customer is selected, show only their unpaid invoices
        if (selectedCustomer) {
          const res = await getCustomerUnpaidInvoices(token, selectedCustomer.id);
          if (!cancelled) {
            // Map to Invoice shape expected by the form
            setInvoices(
              res.invoices.map((inv) => ({
                id: inv.id,
                customerName: selectedCustomer.name,
                customerPhone: selectedCustomer.phone ?? null,
                status: inv.status as "PAID" | "PENDING" | "OVERDUE",
                subtotal: inv.subtotal,
                amountPaid: inv.amountPaid,
                balance: inv.balance,
                dueDate: inv.dueDate,
                notes: null,
                createdAt: inv.createdAt,
                updatedAt: inv.createdAt,
                items: [{ id: "", stockItemId: null, description: inv.description, quantity: 1, unitPrice: inv.subtotal, total: inv.subtotal }],
                payments: [],
              })),
            );
          }
        } else {
          const cacheKey = makeCacheKey(token, "invoices", "credit-link");
          const cached = readClientCache<{ invoices: Invoice[] }>(cacheKey);
          if (cached && !cancelled) setInvoices(cached.value.invoices);
          const response = await listInvoices(token, { limit: 50 });
          if (!cancelled) {
            setInvoices(response.invoices);
            writeClientCache(cacheKey, { invoices: response.invoices });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load invoices.");
      } finally {
        if (!cancelled) setInvoicesLoading(false);
      }
    }

    void loadInvoices();

    return () => { cancelled = true; };
  }, [requiresInvoice, selectedCustomer]);

  async function submitSale() {
    setError(null);

    const token = getStoredAccessToken();
    if (!token) {
      setError("Your login session has expired. Please log in again.");
      return;
    }

    if (!selectedItem) {
      setError("Select a stock item before recording the sale.");
      return;
    }

    if (selectedItem.quantity < quantity) {
      setError("Quantity cannot be more than available stock.");
      return;
    }

    if (
      normalizedStatus === "PART_PAYMENT" &&
      (amountPaidValue <= 0 || amountPaidValue >= total)
    ) {
      setError("Part payment must be greater than zero and less than the total.");
      return;
    }

    const invoiceName = invoiceCustomerName.trim() || customerName.trim();
    if (requiresInvoice && invoiceMode === "existing" && !selectedInvoiceId) {
      setError("Select an invoice or add a new invoice for this credit sale.");
      return;
    }

    if (requiresInvoice && invoiceMode === "new" && (!invoiceName || !invoiceDueDate)) {
      setError("New credit invoices need customer details and a due date.");
      return;
    }

    setSaving(true);
    try {
      await createSale(token, {
        stockItemId: selectedItem.id,
        quantity,
        unitPrice,
        customerId: selectedCustomer?.id,
        customerName: customerName.trim() || undefined,
        paymentStatus: normalizedStatus,
        paymentMethod:
          normalizedStatus === "WILL_PAY_LATER"
            ? undefined
            : paymentMethodMap[paymentMethod],
        amountPaid:
          normalizedStatus === "PART_PAYMENT" ? amountPaidValue : undefined,
        invoiceId:
          requiresInvoice && invoiceMode === "existing"
            ? (selectedInvoiceId ?? undefined)
            : undefined,
        createInvoice: requiresInvoice && invoiceMode === "new"
          ? {
              customerId: selectedInvoiceCustomer?.id ?? selectedCustomer?.id,
              customerName: invoiceName,
              customerPhone: invoiceCustomerPhone.trim() || undefined,
              dueDate: invoiceDueDate,
              notes: invoiceNotes.trim() || undefined,
            }
          : undefined,
      });
      removeClientCache(makeCacheKey(token, "sales"));
      removeClientCache(makeCacheKey(token, "invoices"));
      removeClientCache(makeCacheKey(token, "stock-items"));
      removeClientCache(makeCacheKey(token, "stock-item-details"));
      removeClientCache(makeCacheKey(token, "dashboard-summary"));
      onRecorded();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to record sale right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <label className="mb-2 block text-[16px] font-semibold text-[#071122] sm:text-[24px]">Select Product</label>
        <button
          type="button"
          className={cn(
            "flex h-[56px] w-full max-w-[520px] items-center justify-between rounded-[14px] border border-[#d3dbe6] bg-white px-4 text-[16px] text-[#1f2937] shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5 sm:text-[23px]",
          )}
          onClick={() => setDropdownOpen((open) => !open)}
        >
          <span className="truncate">
            {selectedItem
              ? `${selectedItem.name} (${selectedItem.quantity} in stock) - ${formatMoney(selectedItem.sellingPrice)}`
              : loading
                ? "Loading..."
                : "Choose item"}
          </span>
          <ChevronDown className="ml-3 size-5 shrink-0 text-[#94a3b8]" />
        </button>
        {dropdownOpen && (
          <div className="absolute z-20 mt-2 w-full max-w-[520px] overflow-hidden rounded-[14px] border border-[#d3dbe6] bg-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]">
            {items.length === 0 && (
              <div className="px-5 py-4 text-[19px] text-[#64748b]">
                No stock item available. Add stock before recording a sale.
              </div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 text-left text-[16px] hover:bg-[#f8fafc] sm:px-5 sm:text-[21px]"
                onClick={() => {
                  setSelectedId(item.id);
                  setUseWholesale(false);
                  setQuantity(1);
                  setDropdownOpen(false);
                }}
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 text-right text-[#64748b]">
                  {item.quantity} in stock - {formatMoney(item.sellingPrice)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <>
          {canUseWholesale && (
            <div className="flex min-h-[86px] items-center justify-between gap-3 rounded-[18px] border border-[#fde6a8] bg-[#fffaf0] px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-[23px] font-bold text-[#111827]">Wholesale Price</p>
                <p className="mt-1 text-[19px] text-[#f59e0b]">
                  {formatMoney(selectedItem.wholesalePrice)} per unit
                </p>
              </div>
              <Switch
                checked={useWholesale}
                label="Use wholesale price"
                onChange={setUseWholesale}
              />
            </div>
          )}

          <div>
            <p className="mb-3 text-[16px] font-semibold text-[#071122] sm:text-[24px]">Quantity</p>
            <div className="flex items-center gap-3 sm:gap-4">
              <QuantityButton
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus className="size-6" />
              </QuantityButton>
              <div className="grid h-14 w-20 place-items-center rounded-[18px] border border-[#d3dbe6] bg-white text-[28px] font-bold sm:h-[72px] sm:w-24 sm:text-[35px]">
                {quantity}
              </div>
              <QuantityButton
                onClick={() =>
                  setQuantity((value) => Math.min(selectedItem.quantity, value + 1))
                }
              >
                <Plus className="size-6" />
              </QuantityButton>
            </div>
          </div>

          <div className="grid min-h-[128px] place-items-center rounded-[20px] border border-[#d8f3e3] bg-[#ecfff4] px-4 py-6 text-center shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:h-[168px]">
            <div>
              <p className="text-[23px] text-[#334155]">Total</p>
              <p className="mt-2 text-[39px] font-extrabold text-[#12b981]">
                {formatMoney(total)}
              </p>
            </div>
          </div>
        </>
      )}

      <CustomerAutocomplete
        value={customerName}
        onChange={setCustomerName}
        onSelect={(c) => {
          setSelectedCustomer(c);
          if (c) {
            setCustomerName(c.name);
            setSelectedInvoiceId(null); // reset invoice when customer changes
          }
        }}
      />
      <SegmentedControl
        label="Payment Status"
        active={paymentStatus}
        options={["Paid", "Part Payment", "Will Pay Later"]}
        activeClass={
          paymentStatus === "Part Payment"
            ? "bg-[#f59e0b] text-white"
            : paymentStatus === "Will Pay Later"
              ? "bg-[#ef3b42] text-white"
              : "bg-[#17bd82] text-white"
        }
        onChange={(value) => setPaymentStatus(value as PaymentStatusLabel)}
      />

      {paymentStatus === "Part Payment" && (
        <StockInput
          label="Amount Paid (₦)"
          placeholder="0"
          type="number"
          value={amountPaid}
          onChange={setAmountPaid}
        />
      )}

      {requiresInvoice && (
        <InvoicePanel
          invoices={openInvoices}
          loading={invoicesLoading}
          selectedInvoiceId={selectedInvoiceId}
          mode={invoiceMode}
          customerName={invoiceCustomerName}
          customerPhone={invoiceCustomerPhone}
          dueDate={invoiceDueDate}
          notes={invoiceNotes}
          balance={balance}
          onSelectInvoice={(invoice) => {
            setSelectedInvoiceId(invoice.id);
            setInvoiceMode("existing");
            if (!customerName.trim()) setCustomerName(invoice.customerName);
          }}
          onAddNew={() => {
            setSelectedInvoiceId(null);
            setInvoiceMode("new");
          }}
          onUseExisting={() => setInvoiceMode("existing")}
          onCustomerNameChange={setInvoiceCustomerName}
          onCustomerPhoneChange={setInvoiceCustomerPhone}
          onDueDateChange={setInvoiceDueDate}
          onNotesChange={setInvoiceNotes}
          onCustomerSelect={(c) => {
            setSelectedInvoiceCustomer(c);
            if (c) setInvoiceCustomerPhone(c.phone ?? "");
          }}
        />
      )}

      {paymentStatus !== "Will Pay Later" && (
        <SegmentedControl
          label="Payment Method"
          active={paymentMethod}
          options={["Cash", "Transfer", "Card"]}
          activeClass="bg-[#2563eb] text-white"
          onChange={(value) => setPaymentMethod(value as PaymentMethodLabel)}
        />
      )}

      {error && (
        <p className="rounded-[14px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-[18px] font-semibold text-[#be123c]">
          {error}
        </p>
      )}

      <button
        type="button"
          className="h-14 w-full rounded-[16px] bg-[#18bd82] text-[18px] font-bold text-white shadow-[0_8px_20px_rgba(24,189,130,0.24)] disabled:cursor-not-allowed disabled:bg-[#8fb0ef] sm:h-[72px] sm:rounded-[18px] sm:text-[23px]"
        disabled={saving || loading}
        onClick={() => void submitSale()}
      >
        {saving ? "Recording..." : "Record Sale"}
      </button>
      <DiscardButton onDiscard={onDiscard} />
    </div>
  );
}

function InvoicePanel({
  invoices,
  loading,
  selectedInvoiceId,
  mode,
  customerName,
  customerPhone,
  dueDate,
  notes,
  balance,
  onSelectInvoice,
  onAddNew,
  onUseExisting,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDueDateChange,
  onNotesChange,
  onCustomerSelect,
}: {
  invoices: Invoice[];
  loading: boolean;
  selectedInvoiceId: string | null;
  mode: InvoiceMode;
  customerName: string;
  customerPhone: string;
  dueDate: string;
  notes: string;
  balance: number;
  onSelectInvoice: (invoice: Invoice) => void;
  onAddNew: () => void;
  onUseExisting: () => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onCustomerSelect?: (customer: import("@/lib/customerApi").Customer | null) => void;
}) {
  return (
    <div className="rounded-[22px] border border-[#d8e5ff] bg-white px-4 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.07)] sm:px-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eaf1ff] text-[#2563eb] shadow-[0_8px_20px_rgba(37,99,235,0.13)] sm:size-12">
            <ReceiptText className="size-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[19px] font-extrabold text-[#071122] sm:text-[23px]">Link invoice</h3>
            <p className="text-[14px] leading-5 text-[#64748b] sm:text-[17px]">
              Credit sales must be attached to an invoice for tracking.
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-[#fff1f2] px-4 py-2 text-left sm:text-right">
          <p className="text-[14px] font-bold uppercase text-[#64748b]">Balance</p>
          <p className="break-words text-[18px] font-extrabold text-[#ef3b42] sm:text-[21px]">
            {formatMoney(balance)}
          </p>
        </div>
      </div>

      {mode === "existing" ? (
        <div className="space-y-3">
          {loading && invoices.length === 0 && (
            <div className="rounded-[18px] border border-dashed border-[#c8d6ee] bg-[#f8fbff] px-4 py-5 text-[18px] font-semibold text-[#64748b]">
              Loading open invoices...
            </div>
          )}

          {!loading && invoices.length === 0 && (
            <div className="rounded-[18px] border border-dashed border-[#c8d6ee] bg-[#f8fbff] px-4 py-5">
              <p className="text-[20px] font-extrabold text-[#071122]">
                No open invoice yet
              </p>
              <p className="mt-1 text-[17px] leading-6 text-[#64748b]">
                Create one here and we will link this sale to it immediately.
              </p>
            </div>
          )}

          {invoices.slice(0, 4).map((invoice) => (
            <InvoiceOption
              key={invoice.id}
              invoice={invoice}
              selected={invoice.id === selectedInvoiceId}
              onSelect={() => onSelectInvoice(invoice)}
            />
          ))}

          <button
            type="button"
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#c8d6ee] bg-[#f8fbff] text-[16px] font-extrabold text-[#2563eb] transition-colors hover:bg-[#eef4ff] sm:h-[58px] sm:text-[20px]"
            onClick={onAddNew}
          >
            <PlusCircle className="size-5" />
            Add New Invoice
          </button>
        </div>
      ) : (
        <div className="rounded-[18px] border border-[#e2e8f0] bg-[#fbfdff] p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold text-[#071122] sm:text-[20px]">
                New invoice details
              </p>
              <p className="text-[14px] text-[#64748b] sm:text-[16px]">
                This invoice will be created when the sale is recorded.
              </p>
            </div>
            {invoices.length > 0 && (
              <button
                type="button"
                className="self-start rounded-full border border-[#d3dbe6] bg-white px-4 py-2 text-[14px] font-bold text-[#2563eb] sm:text-[16px]"
                onClick={onUseExisting}
              >
                Use existing
              </button>
            )}
          </div>
          <CustomerAutocomplete
            value={customerName}
            onChange={onCustomerNameChange}
            onSelect={(c) => {
              onCustomerSelect?.(c);
              if (c) {
                onCustomerNameChange(c.name);
                onCustomerPhoneChange(c.phone ?? "");
              }
            }}
            placeholder="Customer name *"
          />
          <div className="mt-3">
            <StockInput
              label="Phone (optional)"
              placeholder="08012345678"
              value={customerPhone}
              onChange={onCustomerPhoneChange}
            />
          </div>
          <div className="mt-4">
            <StockInput
              label="Due Date *"
              placeholder=""
              type="date"
              value={dueDate}
              onChange={onDueDateChange}
            />
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-[16px] font-semibold sm:text-[22px]">
              Notes (optional)
            </span>
            <textarea
              className="h-24 w-full resize-none rounded-[14px] border border-[#d3dbe6] bg-white px-4 py-4 text-[16px] text-[#334155] outline-none placeholder:text-[#64748b] shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:rounded-[11px] sm:px-5 sm:text-[21px]"
              placeholder="Any note for the customer"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function InvoiceOption({
  invoice,
  selected,
  onSelect,
}: {
  invoice: Invoice;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 rounded-[18px] border bg-white px-3 py-4 text-left transition-all sm:items-center sm:gap-4 sm:px-4",
        selected
          ? "border-[#2563eb] shadow-[0_10px_24px_rgba(37,99,235,0.14)]"
          : "border-[#e2e8f0] hover:border-[#b8c8e4] hover:bg-[#fbfdff]",
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-2xl sm:size-12",
          selected ? "bg-[#eaf1ff] text-[#2563eb]" : "bg-[#f1f5f9] text-[#94a3b8]",
        )}
      >
        {selected ? <CheckCircle2 className="size-6" /> : <FileText className="size-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-extrabold text-[#071122] sm:text-[20px]">
          {invoice.customerName}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-semibold text-[#64748b]">
          <span>{invoice.items[0]?.description ?? "Invoice"}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" />
            Due {formatDate(invoice.dueDate)}
          </span>
        </span>
      </span>
      <span className="max-w-[38%] shrink-0 text-right">
        <span className="block break-words text-[15px] font-extrabold leading-tight text-[#ef3b42] sm:text-[20px]">
          {formatMoney(invoice.balance)}
        </span>
        <span className={cn("mt-1 inline-flex rounded-full px-3 py-1 text-[13px] font-bold", invoice.status === "OVERDUE" ? "bg-[#ffe4e6] text-[#ef3b42]" : "bg-[#fff5db] text-[#d98900]")}>
          {invoice.status[0] + invoice.status.slice(1).toLowerCase()}
        </span>
      </span>
    </button>
  );
}

function ExpenseForm({
  onDiscard,
  onRecorded,
}: {
  onDiscard: () => void;
  onRecorded: () => void;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!category) {
      setError("Please select a category.");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    const token = getStoredAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createExpense(token, {
        category,
        amount: amountNum,
        description: description.trim() || undefined,
        paymentMethod: paymentMethodMap[paymentMethod] as ExpensePaymentMethod,
      });
      removeClientCache(makeCacheKey(token, "expenses"));
      onRecorded();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to record expense. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="mb-3 text-[18px] font-semibold text-[#071122] sm:text-[25px]">Category</h3>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:mb-10 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-4">
        {expenseCategoryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setCategory(item.label)}
            className={cn(
              "flex h-[82px] flex-col items-center justify-center gap-2 rounded-[18px] text-[15px] font-semibold transition-colors sm:h-[88px] sm:text-[19px]",
              category === item.label
                ? "bg-[#ef3b42] text-white"
                : "bg-[#f1f5fa] text-[#334155]",
            )}
          >
            <item.icon className="size-7" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <StockInput
        label="Amount (₦)"
        placeholder="0"
        type="number"
        value={amount}
        onChange={setAmount}
      />

      <label className="mb-2 block text-[16px] font-semibold text-[#071122] sm:mb-3 sm:text-[25px]">Description (optional)</label>
      <textarea
        className="mb-8 h-24 w-full resize-none rounded-[14px] border border-[#cfd7e2] bg-white px-4 py-4 text-[16px] text-[#27364a] outline-none placeholder:text-[#94a3b8] sm:rounded-[11px] sm:px-5 sm:text-[24px]"
        placeholder="What was this for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <SegmentedControl
        label="Payment Method"
        active={paymentMethod}
        options={["Cash", "Transfer", "Card"]}
        activeClass="bg-[#2563eb] text-white"
        onChange={(v) => setPaymentMethod(v as PaymentMethodLabel)}
      />

      {error && (
        <p className="mt-4 text-[17px] font-semibold text-[#ef3b42]">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="mt-8 h-14 w-full rounded-[16px] bg-[#ef3b42] text-[18px] font-semibold text-white shadow-[0_8px_20px_rgba(239,59,66,0.22)] disabled:opacity-60 sm:mt-9 sm:h-[72px] sm:rounded-[18px] sm:text-[23px]"
      >
        {saving ? "Recording..." : "Record Expense"}
      </button>
      <DiscardButton onDiscard={onDiscard} />
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  tone: "sale" | "expense";
  onClick: () => void;
}) {
  const activeClass = tone === "sale" ? "bg-[#18bd82]" : "bg-[#ef3b42]";

  return (
    <button
      className={cn(
        "flex h-[74px] flex-col items-center justify-center gap-2 rounded-[16px] bg-white text-[15px] font-bold shadow-[0_1px_5px_rgba(15,23,42,0.08)] transition-colors sm:h-[82px] sm:text-[19px]",
        active ? `${activeClass} text-white shadow-[0_2px_5px_rgba(15,23,42,0.12)]` : "text-[#66758a]",
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function StockInput({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[16px] font-semibold text-[#071122] sm:text-[24px]">{label}</span>
      <input
        type={type}
        className="h-14 w-full rounded-[14px] border border-[#d3dbe6] bg-white px-4 text-[16px] text-[#334155] outline-none placeholder:text-[#64748b] shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:h-[72px] sm:px-5 sm:text-[23px]"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SegmentedControl({
  label,
  active,
  options,
  activeClass,
  onChange,
}: {
  label: string;
  active: string;
  options: string[];
  activeClass: string;
  onChange: (option: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[16px] font-semibold text-[#071122] sm:text-[24px]">{label}</p>
      <div className="grid min-h-[54px] grid-cols-3 overflow-hidden rounded-[16px] bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)] sm:h-[60px] sm:rounded-[18px]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "px-2 text-[14px] font-semibold leading-tight text-[#66758a] sm:text-[19px]",
              option === active && activeClass,
            )}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuantityButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid size-14 place-items-center rounded-[18px] border border-[#d3dbe6] bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:size-[72px]"
      onClick={onClick}
    >
      {children}
    </button>
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

function DiscardButton({ onDiscard }: { onDiscard: () => void }) {
  return (
    <button
      className="mx-auto mt-5 flex items-center gap-2 pb-8 text-[19px] text-[#5e6d81]"
      onClick={onDiscard}
    >
      <Trash2 className="size-5" />
      Discard draft
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
