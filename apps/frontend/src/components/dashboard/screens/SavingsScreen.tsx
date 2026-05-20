"use client";

import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  PiggyBank,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  confirmVerification,
  createSavingsEntry,
  deleteSavingsEntry,
  getSavingsAccount,
  getTargetProgress,
  initiateVerification,
  listBanks,
  listSavings,
  resolveAccount,
  updateSavingsAccount,
  updateSavingsTarget,
  withdrawSavings,
  type FlwBank,
  type SavingsAccount,
  type SavingsEntry,
  type SavingsPeriod,
  type TargetProgress,
} from "@/lib/savingsApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

type Tab = "today" | "history" | "setup";

// ─── Main screen ──────────────────────────────────────────────────────────────

export function SavingsScreen({
  onBack,
  pendingVerification,
  onVerificationHandled,
}: {
  onBack: () => void;
  pendingVerification?: { entryId: string; reference: string } | null;
  onVerificationHandled?: () => void;
}) {
  // If returning from Flutterwave, land on History tab
  const [tab, setTab] = useState<Tab>(pendingVerification ? "history" : "today");
  const [progress, setProgress] = useState<TargetProgress | null>(null);
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const token = getStoredAccessToken();
    if (!token) return;
    const [prog, list, acc] = await Promise.all([
      getTargetProgress(token),
      listSavings(token, { pageSize: 30 }),
      getSavingsAccount(token),
    ]);
    setProgress(prog);
    setEntries(list.data);
    setAccount(acc.account);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const targetAmount = progress?.target?.amount ?? 0;
  const currentSaved = progress?.currentSaved ?? 0;
  const progressPct = progress?.progressPercent ?? 0;

  return (
    <div className="mx-4 pb-10 sm:mx-0">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button className="grid size-10 place-items-center rounded-full bg-white shadow-[0_1px_6px_rgba(15,23,42,0.1)]" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h2 className="text-[20px] font-extrabold leading-none text-[#071122]">Savings</h2>
          <p className="mt-0.5 text-[12px] text-[#8b99b3]">Track & withdraw your savings</p>
        </div>
      </div>

      {/* Tab pills */}
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-[14px] bg-[#f1f5f9] p-1">
        {([["today", "Today"], ["history", "History"], ["setup", "Setup"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-[10px] py-2 text-[13px] font-bold transition-all duration-200",
              tab === key
                ? "bg-white text-[#059669] shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                : "text-[#64748b]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-[#059669]" />
        </div>
      ) : (
        <>
          {tab === "today" && (
            <TodayTab
              progress={progress}
              targetAmount={targetAmount}
              currentSaved={currentSaved}
              progressPct={progressPct}
              onSaved={reload}
            />
          )}
          {tab === "history" && (
            <HistoryTab
              entries={entries}
              onChanged={reload}
              pendingVerification={pendingVerification}
              onVerificationHandled={onVerificationHandled}
            />
          )}
          {tab === "setup" && (
            <SetupTab progress={progress} account={account} onChanged={reload} />
          )}
        </>
      )}
    </div>
  );
}

// ─── TODAY tab ────────────────────────────────────────────────────────────────

function TodayTab({
  progress, targetAmount, currentSaved, progressPct, onSaved,
}: {
  progress: TargetProgress | null;
  targetAmount: number;
  currentSaved: number;
  progressPct: number;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * Math.max(0, progressPct)) / 100;
  const isCompleted = progress?.isCompleted ?? false;

  async function handleRecord() {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { setError("Enter a valid amount."); return; }
    const token = getStoredAccessToken();
    if (!token) return;
    setSaving(true); setError(null);
    try {
      await createSavingsEntry(token, {
        amount: amountNum,
        savedAt: new Date().toISOString(),
        note: note.trim() || undefined,
      });
      setAmount(""); setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record savings.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {/* PiggyBank ring */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#059669] to-[#047857] px-7 py-8 text-white shadow-[0_14px_40px_rgba(5,150,105,0.3)]">
        <div className="pointer-events-none absolute -right-8 -top-8 size-[160px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 size-[120px] rounded-full bg-white/[0.07]" />

        <div className="relative flex items-center gap-6">
          {/* Ring gauge */}
          <div className="shrink-0">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="11" />
              <circle
                cx="65" cy="65" r={radius}
                fill="none" stroke="white" strokeWidth="11"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform="rotate(-90 65 65)"
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
              <text x="65" y="60" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{progressPct.toFixed(0)}%</text>
              <text x="65" y="78" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11">
                {isCompleted ? "Complete!" : "of target"}
              </text>
            </svg>
          </div>

          <div className="flex-1">
            <p className="text-[14px] font-semibold text-white/60">
              {progress?.period?.label ?? "Today"} · {progress?.target?.period ?? "DAILY"}
            </p>
            <p className="mt-1 text-[32px] font-extrabold leading-none">{formatMoney(currentSaved)}</p>
            {targetAmount > 0 && (
              <p className="mt-1 text-[15px] text-white/70">of {formatMoney(targetAmount)} target</p>
            )}
            {progress?.remaining !== undefined && progress.remaining > 0 && (
              <p className="mt-2 text-[14px] text-white/60">{formatMoney(progress.remaining)} to go</p>
            )}
            {isCompleted && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] font-bold">
                <CheckCircle2 className="size-4" /> Target reached!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record savings form */}
      <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <p className="mb-3 text-[16px] font-extrabold text-[#071122]">Record Savings</p>
        <label className="mb-1.5 block text-[13px] font-semibold text-[#334155]">Amount (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mb-3 h-14 w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[20px] font-bold outline-none focus:border-[#059669]"
        />
        <label className="mb-2 block text-[17px] font-semibold text-[#334155]">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What are you saving for?"
          className="mb-5 h-[56px] w-full rounded-[14px] border border-[#d3dbe6] px-5 text-[18px] outline-none focus:border-[#059669]"
        />
        {error && <p className="mb-3 text-[15px] font-semibold text-[#ef3b42]">{error}</p>}
        <button
          type="button"
          onClick={handleRecord}
          disabled={saving}
          className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#059669] text-[19px] font-bold text-white shadow-[0_4px_14px_rgba(5,150,105,0.3)] disabled:opacity-60"
        >
          <PiggyBank className="size-5" />
          {saving ? "Recording…" : "Record Savings"}
        </button>
      </div>
    </div>
  );
}

// ─── HISTORY tab ──────────────────────────────────────────────────────────────

function HistoryTab({
  entries,
  onChanged,
  pendingVerification,
  onVerificationHandled,
}: {
  entries: SavingsEntry[];
  onChanged: () => void;
  pendingVerification?: { entryId: string; reference: string } | null;
  onVerificationHandled?: () => void;
}) {
  const [selected, setSelected] = useState<SavingsEntry | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [verifyRef, setVerifyRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-confirm when returning from Flutterwave payment redirect
  useEffect(() => {
    if (!pendingVerification) return;
    const entry = entries.find((e) => e.id === pendingVerification.entryId);
    if (!entry) return;

    setSelected(entry);
    setVerifyRef(pendingVerification.reference);
    setMsg("Flutterwave payment detected — confirming…");
    onVerificationHandled?.();

    const token = getStoredAccessToken();
    if (!token) return;

    confirmVerification(token, entry.id, pendingVerification.reference)
      .then((res) => {
        setMsg(res.message);
        if (res.verified) onChanged();
      })
      .catch((err) => {
        setMsg(err instanceof ApiError ? err.message : "Confirmation failed. Try manually.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVerification?.entryId]);

  async function handleVerify(entry: SavingsEntry) {
    const token = getStoredAccessToken();
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const res = await initiateVerification(token, entry.id);
      setVerifyUrl(res.attempt.paymentUrl);
      setVerifyRef(res.attempt.reference);
      setMsg(res.message);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Failed to initiate verification.");
    } finally { setBusy(false); }
  }

  async function handleConfirm(entry: SavingsEntry) {
    if (!verifyRef) return;
    const token = getStoredAccessToken();
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const res = await confirmVerification(token, entry.id, verifyRef);
      setMsg(res.message);
      if (res.verified) { setVerifyUrl(null); setVerifyRef(null); onChanged(); }
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Confirmation failed.");
    } finally { setBusy(false); }
  }

  async function handleWithdraw(entry: SavingsEntry) {
    const token = getStoredAccessToken();
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const res = await withdrawSavings(token, entry.id);
      setMsg(res.message);
      onChanged();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Withdrawal failed.");
    } finally { setBusy(false); }
  }

  async function handleDelete(entry: SavingsEntry) {
    const token = getStoredAccessToken();
    if (!token) return;
    setBusy(true);
    try {
      await deleteSavingsEntry(token, entry.id);
      setSelected(null);
      onChanged();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Delete failed.");
    } finally { setBusy(false); }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-[24px] bg-white px-6 py-12 text-center shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
        <PiggyBank className="mx-auto mb-4 size-12 text-[#94a3b8]" />
        <p className="text-[20px] font-extrabold text-[#071122]">No savings yet</p>
        <p className="mt-2 text-[16px] text-[#64748b]">Record your first saving in the Today tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-[14px] bg-[#dffbea] px-4 py-3 text-[15px] font-semibold text-[#065f46]">{msg}</div>
      )}
      {entries.map((entry) => (
        <div key={entry.id}>
          <button
            type="button"
            onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
            className="w-full rounded-[20px] bg-white p-5 text-left shadow-[0_4px_16px_rgba(15,23,42,0.07)] active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[22px] font-extrabold text-[#071122]">{formatMoney(entry.amount)}</p>
                <p className="mt-0.5 text-[14px] text-[#94a3b8]">
                  {formatDate(entry.savedAt)}
                  {entry.note && ` · ${entry.note}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={entry.status} payoutStatus={entry.payoutStatus} />
                <ChevronDown className={cn("size-5 text-[#94a3b8] transition-transform", selected?.id === entry.id && "rotate-180")} />
              </div>
            </div>
          </button>

          {/* Expanded actions */}
          {selected?.id === entry.id && (
            <div className="mt-2 rounded-[18px] bg-[#f8fafc] p-4 space-y-3">
              {entry.status !== "VERIFIED" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerify(entry)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-[14px] bg-[#1557df] px-4 py-3 text-[16px] font-bold text-white disabled:opacity-60"
                  >
                    <span>Verify via Flutterwave</span>
                    <ExternalLink className="size-4" />
                  </button>
                  {verifyUrl && (
                    <div className="space-y-2">
                      <a href={verifyUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 rounded-[12px] bg-[#eef4ff] px-4 py-3 text-[15px] font-bold text-[#1557df]">
                        <ExternalLink className="size-4" /> Open Payment Page
                      </a>
                      <button type="button" onClick={() => handleConfirm(entry)} disabled={busy}
                        className="w-full rounded-[12px] bg-[#059669] py-3 text-[15px] font-bold text-white disabled:opacity-60">
                        {busy ? "Checking…" : "I've Paid — Confirm"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {entry.status === "VERIFIED" && entry.payoutStatus !== "SUCCESS" && (
                <button type="button" onClick={() => handleWithdraw(entry)} disabled={busy}
                  className="flex w-full items-center justify-between rounded-[14px] bg-[#059669] px-4 py-3 text-[16px] font-bold text-white disabled:opacity-60">
                  <span>Withdraw to Bank</span>
                  <Banknote className="size-5" />
                </button>
              )}

              {entry.payoutStatus === "SUCCESS" && (
                <div className="flex items-center gap-2 rounded-[12px] bg-[#dffbea] px-4 py-3 text-[15px] font-bold text-[#059669]">
                  <CheckCircle2 className="size-5" /> Withdrawn successfully
                </div>
              )}

              {entry.status !== "VERIFIED" && (
                <button type="button" onClick={() => handleDelete(entry)} disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#fff0f0] py-3 text-[15px] font-bold text-[#ef3b42] disabled:opacity-60">
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── SETUP tab ────────────────────────────────────────────────────────────────

function SetupTab({
  progress, account, onChanged,
}: {
  progress: TargetProgress | null;
  account: SavingsAccount | null;
  onChanged: () => void;
}) {
  const [targetAmount, setTargetAmount] = useState(String(progress?.target?.amount ?? ""));
  const [period, setPeriod] = useState<SavingsPeriod>(progress?.target?.period ?? "DAILY");
  const [banks, setBanks] = useState<FlwBank[]>([]);
  const [bankCode, setBankCode] = useState(account?.bankCode ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(account?.accountName ?? "");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    listBanks(token)
      .then((res) => setBanks(res.banks))
      .catch((err) => setMsg(err instanceof ApiError ? err.message : "Could not load banks — check gateway env vars"));
  }, []);

  async function handleResolve() {
    if (!bankCode || accountNumber.length < 10) return;
    const token = getStoredAccessToken();
    if (!token) return;
    setResolving(true); setAccountName(""); setBankName("");
    try {
      const res = await resolveAccount(token, { bankCode, accountNumber });
      setAccountName(res.accountName);
      const bank = banks.find((b) => String(b.code) === bankCode);
      setBankName(bank?.name ?? "");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Could not resolve account.");
    } finally { setResolving(false); }
  }

  async function handleSaveTarget() {
    const n = Number(targetAmount);
    if (!n || n <= 0) { setMsg("Enter a valid target amount."); return; }
    const token = getStoredAccessToken();
    if (!token) return;
    setSaving(true); setMsg(null);
    try {
      await updateSavingsTarget(token, { amount: n, period });
      setMsg("Savings target updated!");
      onChanged();
    } catch (err) { setMsg(err instanceof ApiError ? err.message : "Failed to update target."); }
    finally { setSaving(false); }
  }

  async function handleSaveAccount() {
    if (!bankCode || !accountNumber || !accountName || !bankName) { setMsg("Resolve your account first."); return; }
    const token = getStoredAccessToken();
    if (!token) return;
    setSaving(true); setMsg(null);
    try {
      await updateSavingsAccount(token, { bankName, bankCode, accountNumber, accountName });
      setMsg("Bank account saved!");
      onChanged();
    } catch (err) { setMsg(err instanceof ApiError ? err.message : "Failed to save account."); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className={cn("rounded-[14px] px-4 py-3 text-[15px] font-semibold",
          msg.includes("!") ? "bg-[#dffbea] text-[#065f46]" : "bg-[#fff0f0] text-[#ef3b42]")}>
          {msg}
        </div>
      )}

      {/* Savings Target */}
      <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="size-5 text-[#059669]" />
          <p className="text-[18px] font-extrabold text-[#071122]">Savings Target</p>
        </div>
        <label className="mb-2 block text-[16px] font-semibold">Target Amount (₦)</label>
        <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="e.g. 10000"
          className="mb-4 h-[58px] w-full rounded-[12px] border border-[#d3dbe6] px-5 text-[20px] font-bold outline-none focus:border-[#059669]" />
        <label className="mb-2 block text-[16px] font-semibold">Period</label>
        <div className="mb-5 flex gap-3">
          {(["DAILY", "WEEKLY", "MONTHLY"] as SavingsPeriod[]).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={cn("flex-1 rounded-[12px] py-3 text-[15px] font-bold transition-colors",
                period === p ? "bg-[#059669] text-white" : "bg-[#f1f5f9] text-[#334155]")}>
              {p[0] + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button type="button" onClick={handleSaveTarget} disabled={saving}
          className="h-[54px] w-full rounded-[14px] bg-[#059669] text-[17px] font-bold text-white disabled:opacity-60">
          Save Target
        </button>
      </div>

      {/* Withdrawal Bank Account */}
      <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
        <div className="mb-4 flex items-center gap-2">
          <Banknote className="size-5 text-[#1557df]" />
          <p className="text-[18px] font-extrabold text-[#071122]">Withdrawal Account</p>
        </div>

        {account && (
          <div className="mb-4 rounded-[12px] bg-[#eef4ff] px-4 py-3">
            <p className="text-[15px] font-bold text-[#1557df]">{account.accountName}</p>
            <p className="text-[13px] text-[#64748b]">{account.bankName} · {account.accountNumber}</p>
          </div>
        )}

        <label className="mb-2 block text-[16px] font-semibold">Bank</label>
        <div className="relative mb-4">
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
            className="h-[58px] w-full appearance-none rounded-[12px] border border-[#d3dbe6] px-5 text-[17px] outline-none focus:border-[#1557df]">
            <option value="">Select bank…</option>
            {banks.map((b) => <option key={String(b.code)} value={String(b.code)}>{b.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-4 size-5 text-[#94a3b8]" />
        </div>

        <label className="mb-2 block text-[16px] font-semibold">Account Number</label>
        <div className="mb-4 flex gap-2">
          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="10-digit account number" maxLength={20}
            className="h-[58px] flex-1 rounded-[12px] border border-[#d3dbe6] px-5 text-[17px] outline-none focus:border-[#1557df]" />
          <button type="button" onClick={handleResolve} disabled={resolving || accountNumber.length < 10 || !bankCode}
            className="rounded-[12px] bg-[#1557df] px-4 text-[14px] font-bold text-white disabled:opacity-40">
            {resolving ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
          </button>
        </div>

        {accountName && (
          <div className="mb-4 rounded-[12px] bg-[#dffbea] px-4 py-3 text-[15px] font-bold text-[#059669]">
            ✓ {accountName}
          </div>
        )}

        <button type="button" onClick={handleSaveAccount} disabled={saving || !accountName}
          className="h-[54px] w-full rounded-[14px] bg-[#1557df] text-[17px] font-bold text-white disabled:opacity-60">
          Save Account
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, payoutStatus }: { status: string; payoutStatus: string | null }) {
  if (String(payoutStatus ?? "").toUpperCase() === "SUCCESS") {
    return <span className="rounded-full bg-[#e0f2fe] px-2.5 py-1 text-[12px] font-bold text-[#0284c7]">Withdrawn</span>;
  }
  const styles: Record<string, string> = {
    VERIFIED: "bg-[#dffbea] text-[#0f9f68]",
    RECONCILED: "bg-[#fff0d4] text-[#d98900]",
    DECLARED: "bg-[#f1f5f9] text-[#64748b]",
  };
  return <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold", styles[status] ?? styles.DECLARED)}>{status[0] + status.slice(1).toLowerCase()}</span>;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
