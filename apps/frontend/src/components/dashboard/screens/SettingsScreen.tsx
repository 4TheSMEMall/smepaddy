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
    <div>
      <ScreenTitle title="Settings" plan="Free Plan" onBack={onBack} />

      {/* Push notification row */}
      <Card className="mb-4 overflow-hidden">
        <button
          type="button"
          disabled={permState === "denied" || permState === "unsupported" || registering}
          onClick={handleEnableNotifications}
          className="flex min-h-[86px] w-full items-center gap-3 px-4 py-4 text-left disabled:opacity-60 sm:h-[103px] sm:gap-5 sm:px-6"
        >
          <IconBubble tone={permState === "granted" ? "green" : "amber"}>
            {permState === "denied" ? (
              <BellOff className="size-6" />
            ) : (
              <Bell className="size-6" />
            )}
          </IconBubble>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-[#071122] sm:text-[23px]">
              {registering ? "Enabling…" : "Push Notifications"}
            </span>
            <span
              className={cn(
                "text-[13px] sm:text-[19px]",
                permState === "granted" ? "text-[#059669]" : "text-[#334155]",
              )}
            >
              {notifLabel}
            </span>
          </span>
          {permState !== "denied" && permState !== "unsupported" && (
            <ChevronRight className="size-6 text-[#435064]" />
          )}
        </button>
      </Card>

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

      <Card className="overflow-hidden">
        {settingRows.map((row, index) => (
          <button
            key={row.title}
            className={cn(
              "flex min-h-[86px] w-full items-center gap-3 border-b border-[#eef1f5] px-4 py-4 text-left last:border-0 sm:h-[103px] sm:gap-5 sm:px-6",
              index === 1 && "bg-[#f9f7fb]",
            )}
          >
            <IconBubble tone={row.tone}>
              <row.icon className="size-6" />
            </IconBubble>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-[#071122] sm:text-[23px]">{row.title}</span>
              <span className="text-[13px] text-[#334155] sm:text-[19px]">{row.text}</span>
            </span>
            <ChevronRight className="size-6 text-[#435064]" />
          </button>
        ))}
      </Card>
    </div>
  );
}
