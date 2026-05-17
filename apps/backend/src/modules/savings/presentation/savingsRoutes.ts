import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { requireAuth } from "../../../shared/presentation/authenticatedRequest.js";
import { handleOptions, readJson, sendJson } from "../../../shared/presentation/http.js";
import { savingsService } from "../application/savingsService.js";

export function createSavingsHandler() {
  return async function savingsHandler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === "OPTIONS") { handleOptions(response); return; }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const p = url.pathname;

      // ── Webhooks (no auth) ───────────────────────────────────────────────
      if (request.method === "POST" && p === "/savings/webhook/provider-callback") {
        const providedSecret = Array.isArray(request.headers["x-smepaddy-payout-secret"])
          ? request.headers["x-smepaddy-payout-secret"][0]
          : (request.headers["x-smepaddy-payout-secret"] as string | undefined);
        const body = await readJson<Record<string, unknown>>(request);
        const result = await savingsService.handleProviderCallback(
          body as { reference?: string; transferId?: string; status?: string },
          providedSecret,
        );
        sendJson(response, 200, result); return;
      }
      if (request.method === "POST" && p === "/savings/webhook/flutterwave") {
        const signature = Array.isArray(request.headers["verif-hash"])
          ? request.headers["verif-hash"][0]
          : (request.headers["verif-hash"] as string | undefined);
        const body = await readJson<Record<string, unknown>>(request);
        const result = await savingsService.handleFlutterwaveWebhook(body, signature);
        sendJson(response, 200, result); return;
      }

      // ── Banks (no auth needed in practice, but let's protect it) ────────
      if (request.method === "GET" && p === "/savings/banks") {
        await requireAuth(request);
        const banks = await savingsService.listBanks();
        sendJson(response, 200, { banks }); return;
      }

      // ── Resolve account ──────────────────────────────────────────────────
      if (request.method === "POST" && p === "/savings/accounts/resolve") {
        const context = await requireAuth(request);
        const body = await readJson<{ bankCode?: string; accountNumber?: string }>(request);
        const result = await savingsService.resolveAccount(context, body);
        sendJson(response, 200, result); return;
      }

      // ── Target ───────────────────────────────────────────────────────────
      if (request.method === "GET" && p === "/savings/target") {
        const context = await requireAuth(request);
        sendJson(response, 200, await savingsService.getTargetProgress(context)); return;
      }
      if ((request.method === "PUT" || request.method === "PATCH") && p === "/savings/target") {
        const context = await requireAuth(request);
        const body = await readJson<{ amount?: number; period?: string }>(request);
        sendJson(response, 200, await savingsService.updateTarget(context, body)); return;
      }

      // ── Savings account ───────────────────────────────────────────────────
      if (request.method === "GET" && p === "/savings/account") {
        const context = await requireAuth(request);
        sendJson(response, 200, { account: await savingsService.getAccount(context) }); return;
      }
      if ((request.method === "PUT" || request.method === "PATCH") && p === "/savings/account") {
        const context = await requireAuth(request);
        const body = await readJson<{ bankName?: string; bankCode?: string; accountNumber?: string; accountName?: string }>(request);
        sendJson(response, 200, { account: await savingsService.updateAccount(context, body) }); return;
      }

      // ── Entry CRUD ────────────────────────────────────────────────────────
      if (request.method === "GET" && p === "/savings") {
        const context = await requireAuth(request);
        const result = await savingsService.list(context, {
          cursor: url.searchParams.get("cursor") ?? undefined,
          pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
          from: url.searchParams.get("from") ?? undefined,
          to: url.searchParams.get("to") ?? undefined,
        });
        sendJson(response, 200, result); return;
      }
      if (request.method === "POST" && p === "/savings") {
        const context = await requireAuth(request);
        const body = await readJson<{ amount?: number; savedAt?: string; note?: string }>(request);
        sendJson(response, 201, await savingsService.create(context, body)); return;
      }

      const entryMatch   = p.match(/^\/savings\/([^/]+)$/);
      const verifyMatch  = p.match(/^\/savings\/([^/]+)\/verify$/);
      const confirmMatch = p.match(/^\/savings\/([^/]+)\/confirm-verification$/);
      const withdrawMatch = p.match(/^\/savings\/([^/]+)\/withdraw$/);
      const previewMatch = p.match(/^\/savings\/([^/]+)\/verify-preview$/);

      if (request.method === "GET" && previewMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await savingsService.getVerificationPreview(context, previewMatch[1]!)); return;
      }
      if (request.method === "POST" && verifyMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await savingsService.initiateVerification(context, verifyMatch[1]!)); return;
      }
      if (request.method === "POST" && confirmMatch) {
        const context = await requireAuth(request);
        const body = await readJson<{ reference?: string }>(request);
        sendJson(response, 200, await savingsService.confirmVerification(context, confirmMatch[1]!, body)); return;
      }
      if (request.method === "POST" && withdrawMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await savingsService.withdraw(context, withdrawMatch[1]!)); return;
      }
      if (request.method === "PUT" && entryMatch) {
        const context = await requireAuth(request);
        const body = await readJson<{ amount?: number; savedAt?: string; note?: string }>(request);
        sendJson(response, 200, await savingsService.update(context, entryMatch[1]!, body)); return;
      }
      if (request.method === "DELETE" && entryMatch) {
        const context = await requireAuth(request);
        sendJson(response, 200, await savingsService.remove(context, entryMatch[1]!)); return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message, code: error.code });
        return;
      }
      logger.error("Unhandled savings route error", { method: request.method, url: request.url, error: error instanceof Error ? error.message : "Unknown" });
      throw error;
    }
  };
}
