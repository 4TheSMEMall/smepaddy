"use client";

import { useEffect, useState } from "react";

import { LoginFlow } from "@/components/auth/LoginFlow";
import { DashboardApp } from "@/components/dashboard/DashboardApp";
import { LandingPage } from "@/components/landing/LandingPage";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { ApiError } from "@/lib/api";
import { getCurrentAccount } from "@/lib/accountApi";

export function AppEntry() {
  const [stage, setStage] = useState<
    "restoring" | "landing" | "login" | "onboarding" | "dashboard"
  >("restoring");

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = window.localStorage.getItem("sme_paddy_access_token");
      const expiresAt = window.localStorage.getItem(
        "sme_paddy_access_token_expires_at",
      );

      if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
        clearStoredSession();
        if (!cancelled) setStage("landing");
        return;
      }

      try {
        const account = await getCurrentAccount(token);
        if (cancelled) return;
        window.localStorage.setItem("sme_paddy_user", JSON.stringify(account.user));
        setStage("dashboard");
      } catch (error) {
        if (cancelled) return;

        // Only a confirmed-invalid/expired token should sign the user out.
        // A network blip or a transient 5xx must not wipe a perfectly good
        // 14-day session just because one request failed on refresh.
        if (error instanceof ApiError && error.statusCode === 401) {
          clearStoredSession();
          setStage("landing");
          return;
        }

        setStage("dashboard");
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (stage === "restoring") {
    return <RestoringSplash />;
  }

  if (stage === "dashboard") {
    return <DashboardApp />;
  }

  if (stage === "onboarding") {
    return <OnboardingFlow onComplete={() => setStage("dashboard")} />;
  }

  if (stage === "login") {
    return (
      <LoginFlow
        onBack={() => setStage("landing")}
        onLogin={() => setStage("dashboard")}
      />
    );
  }

  return (
    <LandingPage
      onGetStarted={() => setStage("onboarding")}
      onLogin={() => setStage("login")}
    />
  );
}

function clearStoredSession() {
  window.localStorage.removeItem("sme_paddy_access_token");
  window.localStorage.removeItem("sme_paddy_access_token_expires_at");
  window.localStorage.removeItem("sme_paddy_user");
}

function RestoringSplash() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef3f9]">
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-14 place-items-center rounded-[16px] bg-[#2563eb] text-[14px] font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.3)]">
          SP
        </div>
        <div className="size-6 animate-spin rounded-full border-[3px] border-[#c7d8ff] border-t-[#2563eb]" />
      </div>
    </main>
  );
}
