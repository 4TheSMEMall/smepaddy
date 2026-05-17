import { deleteJson, getJson, postJson, patchJson } from "@/lib/api";

export type SavingsStatus = "DECLARED" | "RECONCILED" | "VERIFIED";
export type SavingsPeriod = "DAILY" | "WEEKLY" | "MONTHLY";

export type SavingsEntry = {
  id: string;
  amount: number;
  note: string | null;
  savedAt: string;
  status: SavingsStatus;
  verifiedAt: string | null;
  payoutStatus: string | null;
  payoutTransferredAt: string | null;
  reconciledAt: string | null;
  createdAt: string;
};

export type SavingsTarget = {
  amount: number;
  period: SavingsPeriod;
  updatedAt: string;
};

export type SavingsAccount = {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  setupAt: string;
};

export type VerificationAttempt = {
  reference: string;
  expectedAmount: number;
  status: string;
  paymentUrl: string;
  accessCode: string | null;
  expiresAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export type TargetProgress = {
  target: SavingsTarget | null;
  currentSaved: number;
  remaining: number;
  progressPercent: number;
  isCompleted: boolean;
  period: { label: string; from: string; to: string } | null;
};

export type FlwBank = { id: string | number; code: string; name: string };

// ── Entries ──────────────────────────────────────────────────────────────────

export function listSavings(token: string, opts: { cursor?: string; pageSize?: number; from?: string; to?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const q = params.toString();
  return getJson<{ data: SavingsEntry[]; meta: { nextCursor: string | null; hasNextPage: boolean; pageSize: number } }>(
    `/savings${q ? `?${q}` : ""}`, token,
  );
}

export function createSavingsEntry(token: string, payload: { amount: number; savedAt: string; note?: string }) {
  return postJson<{ entry: SavingsEntry }>("/savings", payload, token);
}

export function updateSavingsEntry(token: string, id: string, payload: { amount: number; savedAt: string; note?: string }) {
  return patchJson<{ entry: SavingsEntry }>(`/savings/${id}`, payload, token);
}

export function deleteSavingsEntry(token: string, id: string) {
  return deleteJson<{ deleted: boolean }>(`/savings/${id}`, token);
}

// ── Target ───────────────────────────────────────────────────────────────────

export function getTargetProgress(token: string) {
  return getJson<TargetProgress>("/savings/target", token);
}

export function updateSavingsTarget(token: string, payload: { amount: number; period: SavingsPeriod }) {
  return patchJson<{ target: SavingsTarget }>("/savings/target", payload, token);
}

// ── Account ───────────────────────────────────────────────────────────────────

export function listBanks(token: string) {
  return getJson<{ banks: FlwBank[] }>("/savings/banks", token);
}

export function resolveAccount(token: string, payload: { bankCode: string; accountNumber: string }) {
  return postJson<{ accountName: string }>("/savings/accounts/resolve", payload, token);
}

export function getSavingsAccount(token: string) {
  return getJson<{ account: SavingsAccount | null }>("/savings/account", token);
}

export function updateSavingsAccount(token: string, payload: { bankName: string; bankCode: string; accountNumber: string; accountName: string }) {
  return patchJson<{ account: SavingsAccount }>("/savings/account", payload, token);
}

// ── Verification ─────────────────────────────────────────────────────────────

export function getVerificationPreview(token: string, id: string) {
  return getJson<{ entry: SavingsEntry; payoutDestination: SavingsAccount | null; activeAttempt: VerificationAttempt | null; canProceed: boolean; message: string }>(
    `/savings/${id}/verify-preview`, token,
  );
}

export function initiateVerification(token: string, id: string) {
  return postJson<{ entry: SavingsEntry; attempt: VerificationAttempt; message: string }>(
    `/savings/${id}/verify`, {}, token,
  );
}

export function confirmVerification(token: string, id: string, reference: string) {
  return postJson<{ verified: boolean; reference: string; status: string; entry: SavingsEntry; message: string }>(
    `/savings/${id}/confirm-verification`, { reference }, token,
  );
}

// ── Withdrawal ────────────────────────────────────────────────────────────────

export function withdrawSavings(token: string, id: string) {
  return postJson<{ entry: SavingsEntry; message: string }>(`/savings/${id}/withdraw`, {}, token);
}
