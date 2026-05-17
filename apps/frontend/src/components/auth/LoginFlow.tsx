"use client";

import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

import { requestLoginOtp, verifyLoginOtp } from "@/lib/authApi";
import { cn } from "@/lib/utils";

type LoginStep = "email" | "otp";

export function LoginFlow({
  onBack,
  onLogin,
}: {
  onBack: () => void;
  onLogin: () => void;
}) {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  async function submit(action: () => Promise<void>) {
    setError("");
    setIsSubmitting(true);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return null;
    }
    return normalizedEmail;
  }

  async function requestOtp() {
    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    await submit(async () => {
      await requestLoginOtp(normalizedEmail);
      setEmail(normalizedEmail);
      setResendAvailableAt(Date.now() + 60_000);
      setStep("otp");
    });
  }

  async function resendOtp() {
    const secondsLeft = getCooldownSeconds(resendAvailableAt);
    if (secondsLeft > 0) {
      setError(`Please wait ${secondsLeft}s before requesting another OTP.`);
      return;
    }

    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    await submit(async () => {
      await requestLoginOtp(normalizedEmail);
      setResendAvailableAt(Date.now() + 60_000);
    });
  }

  async function verifyOtp() {
    await submit(async () => {
      const result = await verifyLoginOtp(email, otp);
      window.localStorage.setItem("sme_paddy_access_token", result.accessToken);
      window.localStorage.setItem("sme_paddy_access_token_expires_at", result.expiresAt);
      window.localStorage.setItem("sme_paddy_user", JSON.stringify(result.user));
      onLogin();
    });
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] px-4 py-4 text-[#071122] sm:py-6">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#d8e0eb] bg-white px-3 text-[14px] font-bold text-[#253047] shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <Logo />
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-88px)] max-w-[520px] flex-col pb-8 pt-5 sm:min-h-[calc(100vh-104px)] sm:pt-7">
        <div className="m-auto w-full max-w-[430px] rounded-[20px] border border-[#dfe7f2] bg-white/78 px-5 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
          <div className="mx-auto mb-4 grid size-[56px] place-items-center rounded-full bg-[#dfeaff] text-[#2563eb] shadow-[0_10px_18px_rgba(37,99,235,0.12)]">
            {step === "email" ? (
              <LockKeyhole className="size-7" />
            ) : (
              <ShieldCheck className="size-7" />
            )}
          </div>

          <h1 className="text-center text-[23px] font-extrabold leading-tight sm:text-[24px]">
            {step === "email" ? "Login to SME Paddy" : "Enter your code"}
          </h1>
          <p className="mx-auto mt-2 max-w-[350px] text-center text-[14px] leading-6 text-[#52617a] sm:text-[15px]">
            {step === "email"
              ? "Use the email connected to your business workspace."
              : `We sent a verification code to ${email}.`}
          </p>

          <div className="mt-6 space-y-4">
            {step === "email" ? (
              <>
                <Field
                  icon={<Mail className="size-4" />}
                  label="Email Address"
                  value={email}
                  onChange={setEmail}
                  placeholder="e.g. you@example.com"
                  type="email"
                />
                <PrimaryButton
                  disabled={email.trim().length < 6 || isSubmitting}
                  onClick={requestOtp}
                >
                  {isSubmitting ? "Sending..." : "Send Login Code"}
                  <ArrowRight className="size-4" />
                </PrimaryButton>
              </>
            ) : (
              <>
                <CodeField value={otp} onChange={setOtp} />
                <p className="text-center text-[14px] font-medium text-[#64748b]">
                  Didn&apos;t get it?{" "}
                  <button
                    className="font-bold text-[#2563eb]"
                    disabled={isSubmitting}
                    onClick={resendOtp}
                  >
                    Resend code
                  </button>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <SecondaryButton onClick={() => setStep("email")}>
                    Back
                  </SecondaryButton>
                  <PrimaryButton
                    disabled={otp.trim().length < 6 || isSubmitting}
                    onClick={verifyOtp}
                  >
                    {isSubmitting ? "Checking..." : "Login"}
                    <ArrowRight className="size-4" />
                  </PrimaryButton>
                </div>
              </>
            )}
            <ErrorMessage message={error} />
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <span className="flex h-[48px] items-center gap-2.5 rounded-[11px] border border-[#d8e0eb] bg-white px-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition focus-within:border-[#2563eb] focus-within:ring-3 focus-within:ring-[#c7d8ff]">
        <span className="text-[#94a3b8]">{icon}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          inputMode="email"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#071122] outline-none placeholder:text-[#7b8798]"
        />
      </span>
    </label>
  );
}

function CodeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cells = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  return (
    <label className="block">
      <span className="mb-2.5 block text-center text-[15px] font-semibold text-[#071122]">
        Verification code
      </span>
      <div
        className="grid grid-cols-6 gap-2"
        onClick={() => inputRef.current?.focus()}
      >
        {cells.map((digit, index) => (
          <div
            key={index}
            className={cn(
              "grid h-[46px] place-items-center rounded-[12px] border bg-white text-[22px] font-black text-[#071122] shadow-[0_5px_12px_rgba(15,23,42,0.08)] transition sm:h-[48px]",
              digit
                ? "border-[#2563eb] ring-4 ring-[#dbe8ff]"
                : "border-[#d8e0eb]",
            )}
          >
            {digit}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(digits);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className="sr-only"
      />
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "flex h-[48px] w-full items-center justify-center gap-2 rounded-[13px] bg-[#2563eb] text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition",
        disabled && "bg-[#9bb7f2] text-white/90 shadow-none",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-[48px] w-full items-center justify-center rounded-[13px] border border-[#d8e0eb] bg-white text-[15px] font-semibold text-[#071122] shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-[12px] bg-[#2563eb] text-[12px] font-black text-white">
        SP
      </div>
      <span className="text-[19px] font-black sm:text-[20px]">SME Paddy</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="rounded-[12px] border border-[#fecaca] bg-[#fff1f2] px-3.5 py-2.5 text-center text-[13px] font-semibold text-[#be123c] sm:text-[14px]">
      {message}
    </p>
  );
}

function getCooldownSeconds(timestamp: number) {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}
