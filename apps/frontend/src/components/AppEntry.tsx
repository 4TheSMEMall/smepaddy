"use client";

import { useEffect, useState } from "react";

import { LoginFlow } from "@/components/auth/LoginFlow";
import { DashboardApp } from "@/components/dashboard/DashboardApp";
import { LandingPage } from "@/components/landing/LandingPage";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { getCurrentAccount } from "@/lib/accountApi";

export function AppEntry() {
  const [stage, setStage] = useState<
    "landing" | "login" | "onboarding" | "dashboard"
  >("landing");

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = window.localStorage.getItem("sme_paddy_access_token");
      const expiresAt = window.localStorage.getItem(
        "sme_paddy_access_token_expires_at",
      );

      if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
        clearStoredSession();
        return;
      }

      try {
        const account = await getCurrentAccount(token);
        if (cancelled) return;
        window.localStorage.setItem("sme_paddy_user", JSON.stringify(account.user));
        setStage("dashboard");
      } catch {
        if (cancelled) return;
        clearStoredSession();
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

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
