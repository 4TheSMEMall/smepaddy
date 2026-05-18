"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { claimDailyLogin, getWallet, type WalletInfo } from "@/lib/coinApi";
import type { ExpenseItem } from "@/lib/expenseApi";
import type { EligibilityResult, Loan } from "@/lib/loanApi";
import { onForegroundMessage, requestPushPermission } from "@/lib/firebase";
import { registerDeviceToken } from "@/lib/notificationApi";
import type { SaleListItem } from "@/lib/salesApi";
import { getStoredAccessToken } from "@/lib/session";
import type { StockItem } from "@/lib/stockApi";
import type { Period, RecordMode, Screen, Tab } from "@/types/dashboard";

import { BottomNav } from "./BottomNav";
import { ConfirmDialog } from "./ConfirmDialog";
import { TopBar } from "./TopBar";
import { AddSupplierScreen } from "./screens/AddSupplierScreen";
import { AddStockItemScreen } from "./screens/AddStockItemScreen";
import { ConsignmentScreen } from "./screens/ConsignmentScreen";
import { ConsignmentSupplierDetailsScreen } from "./screens/ConsignmentSupplierDetailsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { InvoiceDetailsScreen } from "./screens/InvoiceDetailsScreen";
import { InvoicesScreen } from "./screens/InvoicesScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { NewInvoiceScreen } from "./screens/NewInvoiceScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { RecordTransactionScreen } from "./screens/RecordTransactionScreen";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { CustomerDetailScreen } from "./screens/CustomerDetailScreen";
import { CustomersScreen } from "./screens/CustomersScreen";
import { ExpenseDetailScreen } from "./screens/ExpenseDetailScreen";
import { LoanApplicationScreen } from "./screens/LoanApplicationScreen";
import { LoanDetailScreen } from "./screens/LoanDetailScreen";
import { LoanScreen } from "./screens/LoanScreen";
import { RecurringExpensesScreen } from "./screens/RecurringExpensesScreen";
import { RewardsScreen } from "./screens/RewardsScreen";
import { SavingsScreen } from "./screens/SavingsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StockItemDetailsScreen } from "./screens/StockItemDetailsScreen";
import { StockScreen } from "./screens/StockScreen";
import { TransactionDetailScreen } from "./screens/TransactionDetailScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";

export function DashboardApp() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [screen, setScreen] = useState<Screen>("home");
  const [activePeriod, setActivePeriod] = useState<Period>("This Week");
  const [recordMode, setRecordMode] = useState<RecordMode>("sale");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stockRefreshKey, setStockRefreshKey] = useState(0);
  const [invoiceRefreshKey, setInvoiceRefreshKey] = useState(0);
  const [consignmentRefreshKey, setConsignmentRefreshKey] = useState(0);
  const [selectedStockItemId, setSelectedStockItemId] = useState<string | null>(null);
  const [selectedStockItemPreview, setSelectedStockItemPreview] =
    useState<StockItem | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [settlementItemId, setSettlementItemId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleListItem | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loanEligibility, setLoanEligibility] = useState<EligibilityResult | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [savingsVerification, setSavingsVerification] = useState<{ entryId: string; reference: string } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Detect Flutterwave savings verification redirect on page load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyEntryId = params.get("verifyEntryId");
    const verifyRef = params.get("verifyRef");
    if (verifyEntryId && verifyRef) {
      setSavingsVerification({ entryId: verifyEntryId, reference: verifyRef });
      setScreen("savings");
      // Clean the URL so refreshing doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch wallet on mount and claim daily login bonus
  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    claimDailyLogin(token)
      .then((res) => setWallet(res.wallet))
      .catch(() => {
        getWallet(token)
          .then((res) => setWallet(res.wallet))
          .catch(() => {/* no wallet yet */});
      });
  }, []);

  // Silently attempt token registration on load (Settings button is the primary path)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const authToken = getStoredAccessToken();
      if (!authToken) return;
      const result = await requestPushPermission();
      if (result.ok) {
        registerDeviceToken(result.token, result.subscription, authToken).catch(() => {});
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Show a toast banner when a notification arrives while the app is open
  useEffect(() => {
    const unsub = onForegroundMessage((title, body) => {
      setToast({ title, body });
      setTimeout(() => setToast(null), 5000);
    });
    return unsub;
  }, []);

  async function refreshWallet() {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      const res = await getWallet(token);
      setWallet(res.wallet);
    } catch { /* ignore */ }
  }

  function goToTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "transactions") {
      setScreen("transactions");
      setTransactionRefreshKey((k) => k + 1);
    }
    if (tab === "more") setScreen("more");
    if (tab === "home") setScreen("home");
    if (tab === "stock") setScreen("stock");
    if (tab === "invoices") setScreen("invoices");
  }

  return (
    <main
      className="soft-shell min-h-screen pb-[86px]"
      style={{ zoom: 0.75 }}
    >
      <TopBar coins={wallet?.balance ?? 0} />
      <AnimatePresence mode="wait">
        <motion.section
          key={screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mx-auto w-full max-w-[620px] px-4 pt-6 sm:px-0 sm:pt-7"
        >
          {screen === "home" && (
            <HomeScreen
              activePeriod={activePeriod}
              onPeriodChange={setActivePeriod}
              onExpense={() => {
                setRecordMode("expense");
                setActiveTab("transactions");
                setScreen("new-transaction");
              }}
            />
          )}
          {screen === "transactions" && (
            <TransactionsScreen
              activePeriod={activePeriod}
              onPeriodChange={setActivePeriod}
              refreshKey={transactionRefreshKey}
              onRecord={() => {
                setRecordMode("sale");
                setScreen("new-transaction");
              }}
              onSelectSale={(sale) => {
                setSelectedSale(sale);
                setScreen("transaction-detail");
              }}
              onSelectExpense={(expense) => {
                setSelectedExpense(expense);
                setScreen("expense-detail");
              }}
            />
          )}
          {screen === "transaction-detail" && selectedSale && (
            <TransactionDetailScreen
              sale={selectedSale}
              onBack={() => setScreen("transactions")}
              onOpenInvoice={(invoiceId) => {
                setSelectedInvoiceId(invoiceId);
                setActiveTab("invoices");
                setScreen("invoice-details");
              }}
            />
          )}
          {screen === "expense-detail" && selectedExpense && (
            <ExpenseDetailScreen
              expense={selectedExpense}
              onBack={() => setScreen("transactions")}
              onDeleted={() => {
                setTransactionRefreshKey((k) => k + 1);
                setScreen("transactions");
              }}
            />
          )}
          {screen === "new-transaction" && (
            <RecordTransactionScreen
              mode={recordMode}
              onModeChange={setRecordMode}
              onBack={() => setConfirmOpen(true)}
              onDiscard={() => setConfirmOpen(true)}
              onRecorded={() => {
                setActiveTab("transactions");
                setScreen("transactions");
                setTransactionRefreshKey((k) => k + 1);
                setStockRefreshKey((value) => value + 1);
                setInvoiceRefreshKey((value) => value + 1);
                void refreshWallet();
              }}
            />
          )}
          {screen === "stock" && (
            <StockScreen
              refreshKey={stockRefreshKey}
              onAddItem={() => setScreen("new-stock-item")}
              onSelectItem={(item) => {
                setSelectedStockItemId(item.id);
                setSelectedStockItemPreview(item);
                setScreen("stock-item-details");
              }}
            />
          )}
          {screen === "stock-item-details" && selectedStockItemId && (
            <StockItemDetailsScreen
              itemId={selectedStockItemId}
              initialItem={selectedStockItemPreview}
              onBack={() => setScreen("stock")}
              onChanged={() => setStockRefreshKey((value) => value + 1)}
              onOpenSupplier={(supplierId) => {
                setSelectedSupplierId(supplierId);
                setSettlementItemId(null);
                setActiveTab("more");
                setScreen("consignment-supplier");
              }}
              onSettleConsignment={(supplierId, itemId) => {
                setSelectedSupplierId(supplierId);
                setSettlementItemId(itemId);
                setActiveTab("more");
                setScreen("consignment-supplier");
              }}
            />
          )}
          {screen === "new-stock-item" && (
            <AddStockItemScreen
              onBack={() => setScreen("stock")}
              onDiscard={() => setScreen("stock")}
              onCreated={() => {
                setStockRefreshKey((value) => value + 1);
                setScreen("stock");
              }}
            />
          )}
          {screen === "invoices" && (
            <InvoicesScreen
              refreshKey={invoiceRefreshKey}
              onNewInvoice={() => setScreen("new-invoice")}
              onSelectInvoice={(invoiceId) => {
                setSelectedInvoiceId(invoiceId);
                setScreen("invoice-details");
              }}
            />
          )}
          {screen === "invoice-details" && selectedInvoiceId && (
            <InvoiceDetailsScreen
              invoiceId={selectedInvoiceId}
              onBack={() => {
                // If we arrived here from a transaction detail, go back there.
                if (selectedSale?.invoiceId === selectedInvoiceId) {
                  setScreen("transaction-detail");
                } else {
                  setScreen("invoices");
                }
              }}
              onChanged={() => {
                setInvoiceRefreshKey((value) => value + 1);
                void refreshWallet();
                if (selectedSale?.invoiceId === selectedInvoiceId) {
                  setSelectedSale((prev) =>
                    prev ? { ...prev, paymentStatus: "PAID", balance: 0 } : null,
                  );
                }
              }}
            />
          )}
          {screen === "new-invoice" && (
            <NewInvoiceScreen
              onBack={() => setScreen("invoices")}
              onDiscard={() => setScreen("invoices")}
              onCreated={() => {
                setInvoiceRefreshKey((value) => value + 1);
                setScreen("invoices");
              }}
            />
          )}
          {screen === "more" && (
            <MoreScreen
              onSettings={() => setScreen("settings")}
              onProfile={() => setScreen("profile")}
              onConsignment={() => setScreen("consignment")}
              onRecurring={() => setScreen("recurring-expenses")}
              onLoans={() => setScreen("loans")}
              onAnalytics={() => setScreen("analytics")}
              onRewards={() => setScreen("rewards")}
              onSavings={() => setScreen("savings")}
              onCustomers={() => setScreen("customers")}
            />
          )}
          {screen === "analytics" && (
            <AnalyticsScreen onBack={() => setScreen("more")} />
          )}
          {screen === "rewards" && (
            <RewardsScreen onBack={() => setScreen("more")} />
          )}
          {screen === "customers" && (
            <CustomersScreen
              onBack={() => setScreen("more")}
              onSelect={(customer) => {
                setSelectedCustomerId(customer.id);
                setScreen("customer-detail");
              }}
            />
          )}
          {screen === "customer-detail" && selectedCustomerId && (
            <CustomerDetailScreen
              customerId={selectedCustomerId}
              onBack={() => setScreen("customers")}
              onDeleted={() => {
                setSelectedCustomerId(null);
                setScreen("customers");
              }}
              onOpenInvoice={(invoiceId) => {
                setSelectedInvoiceId(invoiceId);
                setActiveTab("invoices");
                setScreen("invoice-details");
              }}
            />
          )}
          {screen === "savings" && (
            <SavingsScreen
              onBack={() => setScreen("more")}
              pendingVerification={savingsVerification}
              onVerificationHandled={() => setSavingsVerification(null)}
            />
          )}
          {screen === "loans" && (
            <LoanScreen
              onBack={() => setScreen("more")}
              onApply={(eligibility) => {
                setLoanEligibility(eligibility);
                setScreen("loan-apply");
              }}
              onViewLoan={(loan) => {
                setSelectedLoanId(loan.id);
                setScreen("loan-detail");
              }}
            />
          )}
          {screen === "loan-apply" && loanEligibility && (
            <LoanApplicationScreen
              eligibility={loanEligibility}
              onBack={() => setScreen("loans")}
              onApplied={(loan) => {
                setSelectedLoanId(loan.id);
                setLoanEligibility(null);
                void refreshWallet();
                setScreen("loan-detail");
              }}
            />
          )}
          {screen === "loan-detail" && selectedLoanId && (
            <LoanDetailScreen
              loanId={selectedLoanId}
              onBack={() => setScreen("loans")}
              onRepaid={() => {
                void refreshWallet();
                setScreen("loans");
              }}
            />
          )}
          {screen === "recurring-expenses" && (
            <RecurringExpensesScreen onBack={() => setScreen("more")} />
          )}
          {screen === "consignment" && (
            <ConsignmentScreen
              refreshKey={consignmentRefreshKey}
              onAddSupplier={() => setScreen("new-supplier")}
              onSelectSupplier={(supplierId) => {
                setSelectedSupplierId(supplierId);
                setSettlementItemId(null);
                setScreen("consignment-supplier");
              }}
            />
          )}
          {screen === "consignment-supplier" && selectedSupplierId && (
            <ConsignmentSupplierDetailsScreen
              supplierId={selectedSupplierId}
              settleItemId={settlementItemId}
              onBack={() => {
                setSettlementItemId(null);
                setScreen("consignment");
              }}
              onAddSupplier={() => setScreen("new-supplier")}
              onChanged={() => {
                setConsignmentRefreshKey((value) => value + 1);
                setStockRefreshKey((value) => value + 1);
              }}
            />
          )}
          {screen === "new-supplier" && (
            <AddSupplierScreen
              onBack={() => setScreen("consignment")}
              onCreated={() => {
                setConsignmentRefreshKey((value) => value + 1);
                setScreen("consignment");
              }}
            />
          )}
          {screen === "profile" && <ProfileScreen onBack={() => setScreen("more")} wallet={wallet} />}
          {screen === "settings" && <SettingsScreen onBack={() => setScreen("more")} />}
        </motion.section>
      </AnimatePresence>

      <BottomNav active={activeTab} onChange={goToTab} />

      <AnimatePresence>
        {confirmOpen && (
          <ConfirmDialog
            onClose={() => setConfirmOpen(false)}
            onDiscard={() => {
              setConfirmOpen(false);
              setScreen("transactions");
            }}
          />
        )}
      </AnimatePresence>

      {/* Foreground notification toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed left-1/2 top-20 z-50 w-[90%] max-w-[500px] -translate-x-1/2 rounded-2xl bg-[#071122] px-5 py-4 shadow-2xl"
          >
            <p className="text-[15px] font-bold text-white">{toast.title}</p>
            <p className="mt-0.5 text-[14px] text-[#94a3b8]">{toast.body}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
