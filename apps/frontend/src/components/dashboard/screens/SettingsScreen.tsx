"use client";

import { Bell, BellOff, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { settingRows } from "@/data/dashboard";
import { forceResubscribe, requestPushPermission, type PushResult } from "@/lib/firebase";
import { registerDeviceToken, sendTestNotification } from "@/lib/notificationApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

import { IconBubble } from "../IconBubble";
import { ScreenTitle } from "../ScreenTitle";

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [permState, setPermState] = useState<NotificationPermission | "unsupported">("default");
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setPermState("unsupported");
      } else {
        setPermState(Notification.permission);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function handleEnableNotifications() {
    setRegistering(true);
    setEnableError(null);
    try {
      // If already granted, force a fresh subscription (re-enable after it disabled itself)
      const result: PushResult = permState === "granted"
        ? await forceResubscribe()
        : await requestPushPermission();
      setPermState(
        typeof window !== "undefined" && "Notification" in window
          ? Notification.permission
          : "default",
      );
      if (!result.ok) {
        setEnableError(result.reason);
        return;
      }
      const authToken = getStoredAccessToken();
      if (authToken) {
        await registerDeviceToken(result.token, result.subscription, authToken);
        setRegistered(true);
      }
    } catch (err) {
      setEnableError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRegistering(false);
    }
  }

  async function handleTest() {
    const authToken = getStoredAccessToken();
    if (!authToken) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendTestNotification(authToken);
      setTestResult(
        res.ok
          ? `Sent to ${res.tokenCount} device — check your notifications`
          : `Failed: ${res.reason ?? "unknown error"}`,
      );
    } catch (err: unknown) {
      setTestResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setTesting(false);
    }
  }

  const notifLabel =
    permState === "granted"
      ? registered
        ? "Notifications enabled"
        : "Already enabled — tap to re-register"
      : permState === "denied"
        ? "Blocked in browser — reset in Chrome settings"
        : permState === "unsupported"
          ? "Not supported on this browser"
          : "Tap to enable push notifications";

  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <ScreenTitle title="Settings" plan="Free Plan" onBack={onBack} />

      {/* Push notification row */}
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <button
          type="button"
          disabled={permState === "denied" || permState === "unsupported" || registering}
          onClick={handleEnableNotifications}
          className="flex w-full items-center gap-3 px-4 py-4 text-left disabled:opacity-60"
        >
          <div className={cn(
            "grid size-11 shrink-0 place-items-center rounded-[14px] text-white",
            permState === "granted" ? "bg-gradient-to-br from-[#059669] to-[#047857]" : "bg-gradient-to-br from-[#d97706] to-[#b45309]",
          )} style={{ boxShadow: permState === "granted" ? "0 4px 12px rgba(5,150,105,0.3)" : "0 4px 12px rgba(217,119,6,0.3)" }}>
            {permState === "denied" ? <BellOff className="size-5" /> : <Bell className="size-5" />}
          </div>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[#071122]">
              {registering ? "Enabling…" : "Push Notifications"}
            </span>
            <span className={cn("text-[12px]", permState === "granted" ? "text-[#059669]" : "text-[#94a3b8]")}>
              {notifLabel}
            </span>
          </span>
          {permState !== "denied" && permState !== "unsupported" && (
            <ChevronRight className="size-5 text-[#c1cad8]" />
          )}
        </button>
      </div>

      {enableError && (
        <p className="mb-3 rounded-[12px] bg-[#fff0f0] px-4 py-3 text-[15px] font-semibold text-[#ef3b42]">
          {enableError}
        </p>
      )}

      {/* Test button — only shown when notifications are enabled */}
      {(permState === "granted" || registered) && (
        <div className="mb-4 px-1">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="w-full rounded-[14px] bg-[#f1f5f9] py-3 text-[15px] font-semibold text-[#334155] disabled:opacity-60 sm:text-[18px]"
          >
            {testing ? "Sending…" : "Send Test Notification"}
          </button>
          {testResult && (
            <p className={cn(
              "mt-2 text-center text-[16px] font-semibold",
              testResult.startsWith("Sent") ? "text-[#059669]" : "text-[#ef3b42]",
            )}>
              {testResult}
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        {settingRows.map((row, index) => (
          <button
            key={row.title}
            className="flex w-full items-center gap-3 border-b border-[#f1f5f9] px-4 py-4 text-left last:border-0 active:bg-[#f8fafc]"
          >
            <IconBubble tone={row.tone}>
              <row.icon className="size-5" />
            </IconBubble>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-[#071122]">{row.title}</span>
              <span className="text-[12px] text-[#94a3b8]">{row.text}</span>
            </span>
            <ChevronRight className="size-4 text-[#c1cad8]" />
          </button>
        ))}
      </div>
    </div>
  );
}
