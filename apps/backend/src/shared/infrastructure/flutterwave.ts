import https from "node:https";

import { AppError } from "../application/AppError.js";

const FLW_BASE = process.env.FLW_BASE_URL ?? "https://api.flutterwave.com";
const FLW_KEY  = process.env.FLW_SECRET_KEY ?? "";

// ─── Raw HTTPS helpers ────────────────────────────────────────────────────────

function httpsPost<T>(url: URL, headers: Record<string, string>, body: string | null): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: body ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...headers,
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          const sc = res.statusCode ?? 500;
          if (sc >= 200 && sc < 300) {
            try { resolve((data ? JSON.parse(data) : {}) as T); }
            catch (e) { reject(e); }
            return;
          }
          reject(new Error(`HTTP ${sc}: ${data || "no body"}`));
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpsGet<T>(url: URL, headers: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: "application/json", ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          const sc = res.statusCode ?? 500;
          if (sc >= 200 && sc < 300) {
            try { resolve((data ? JSON.parse(data) : {}) as T); }
            catch (e) { reject(e); }
            return;
          }
          reject(new Error(`HTTP ${sc}: ${data || "no body"}`));
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ─── Direct Flutterwave client ────────────────────────────────────────────────

function flwHeaders() {
  if (!FLW_KEY) throw new AppError("Flutterwave secret key not configured", 500, "FLW_NOT_CONFIGURED");
  return { Authorization: `Bearer ${FLW_KEY}` };
}

function flwUrl(path: string) {
  return new URL(path, FLW_BASE.endsWith("/") ? FLW_BASE : `${FLW_BASE}/`);
}

// ─── Payout gateway proxy client ──────────────────────────────────────────────

function proxyHeaders() {
  const token = process.env.SAVINGS_PAYOUT_SERVICE_TOKEN ?? "";
  if (!token) throw new AppError("Payout gateway token not configured", 500, "PAYOUT_PROXY_NOT_CONFIGURED");
  return { Authorization: `Bearer ${token}` };
}

function proxyUrl(path: string) {
  const base = process.env.SAVINGS_PAYOUT_SERVICE_URL ?? "";
  if (!base) throw new AppError("Payout gateway URL not configured", 500, "PAYOUT_PROXY_NOT_CONFIGURED");
  return new URL(path, base.endsWith("/") ? base : `${base}/`);
}

const useProxy = () => process.env.SAVINGS_PAYOUT_PROVIDER === "PROXY";

// ─── Public API ───────────────────────────────────────────────────────────────

export type FlwBank = { id: string | number; code: string; name: string };

export async function listBanks(): Promise<FlwBank[]> {
  if (useProxy()) {
    const res = await httpsGet<FlwBank[]>(proxyUrl("/api/v1/banks"), proxyHeaders());
    return res;
  }
  const res = await httpsGet<{ data?: FlwBank[] }>(flwUrl("/v3/banks/NG"), flwHeaders());
  return (res.data ?? []).filter((b) => b.code && b.name);
}

export async function resolveAccount(accountNumber: string, bankCode: string): Promise<string> {
  if (useProxy()) {
    const res = await httpsPost<{ accountName: string }>(
      proxyUrl("/api/v1/accounts/resolve"),
      proxyHeaders(),
      JSON.stringify({ accountNumber, bankCode }),
    );
    return res.accountName;
  }
  const res = await httpsPost<{ status: string; data?: { account_name?: string }; message?: string }>(
    flwUrl("/v3/accounts/resolve"),
    flwHeaders(),
    JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
  );
  const name = res.data?.account_name?.trim();
  if (!name) throw new AppError(res.message ?? "Could not resolve account", 400, "ACCOUNT_RESOLVE_FAILED");
  return name;
}

export async function initiateTransfer(input: {
  accountBank: string; accountNumber: string; beneficiaryName: string;
  bankName: string; amount: number; reference: string; callbackUrl: string; narration: string;
}): Promise<{ transferId: string | null; reference: string; status: string }> {
  if (useProxy()) {
    return httpsPost(proxyUrl("/api/v1/transfers"), proxyHeaders(), JSON.stringify(input));
  }
  const res = await httpsPost<{ data?: { id?: number | string; reference?: string; status?: string } }>(
    flwUrl("/v3/transfers"),
    flwHeaders(),
    JSON.stringify({
      account_bank: input.accountBank, account_number: input.accountNumber,
      amount: input.amount, currency: "NGN",
      beneficiary_name: input.beneficiaryName, bank_name: input.bankName,
      reference: input.reference, callback_url: input.callbackUrl, narration: input.narration,
    }),
  );
  return {
    transferId: res.data?.id ? String(res.data.id) : null,
    reference: res.data?.reference ?? input.reference,
    status: res.data?.status ?? "PENDING",
  };
}

export async function initializePayment(input: {
  email: string; amount: number; reference: string;
  redirectUrl: string; customerName: string; metadata: Record<string, unknown>;
}): Promise<{ reference: string; authorizationUrl: string; accessCode: string | null }> {
  if (useProxy()) {
    return httpsPost(proxyUrl("/api/v1/payments"), proxyHeaders(), JSON.stringify(input));
  }
  const res = await httpsPost<{ status: string; data?: { link?: string }; message?: string }>(
    flwUrl("/v3/payments"),
    flwHeaders(),
    JSON.stringify({
      tx_ref: input.reference, amount: input.amount, currency: "NGN",
      redirect_url: input.redirectUrl,
      customer: { email: input.email, name: input.customerName },
      customizations: { title: "SME Paddy Savings", description: "Verify your savings entry." },
      meta: input.metadata,
    }),
  );
  const url = res.data?.link?.trim();
  if (!url) throw new AppError(res.message ?? "Could not initialize payment", 400, "FLW_PAYMENT_INIT_FAILED");
  return { reference: input.reference, authorizationUrl: url, accessCode: null };
}

export async function verifyTransaction(txRef: string): Promise<{
  transactionId: string | null; txRef: string; status: string; amount: number; paidAt: Date | null;
}> {
  if (useProxy()) {
    const res = await httpsGet<{ transactionId: string | null; txRef: string; status: string; amount: number; paidAt: string | null }>(
      proxyUrl(`/api/v1/payments/${encodeURIComponent(txRef)}/verify`),
      proxyHeaders(),
    );
    return { ...res, paidAt: res.paidAt ? new Date(res.paidAt) : null };
  }
  const res = await httpsGet<{ status: string; data?: { id?: number | string; tx_ref?: string; status?: string; amount?: number; created_at?: string }; message?: string }>(
    flwUrl(`/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`),
    flwHeaders(),
  );
  if (!res.data?.tx_ref) throw new AppError(res.message ?? "Could not verify transaction", 400, "TRANSACTION_VERIFY_FAILED");
  return {
    transactionId: res.data.id ? String(res.data.id) : null,
    txRef: res.data.tx_ref,
    status: String(res.data.status ?? "unknown").toLowerCase(),
    amount: Number(res.data.amount ?? 0),
    paidAt: res.data.created_at ? new Date(res.data.created_at) : null,
  };
}
