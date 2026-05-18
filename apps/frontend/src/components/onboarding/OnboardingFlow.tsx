"use client";

import {
  ArrowRight,
  ChevronDown,
  KeyRound,
  MapPin,
  Mail,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  createPin,
  requestEmailOtp,
  saveAboutYou,
  saveBusinessInfo,
  saveLocation,
  verifyEmailOtp,
} from "@/lib/onboardingApi";
import { cn } from "@/lib/utils";

type Step = "email" | "otp" | "pin" | "business" | "about" | "location";

const businessTypes = [
  "Retail / Shop",
  "Food & Restaurant",
  "Fashion & Clothing",
  "Electronics",
  "Beauty & Cosmetics",
  "Pharmacy",
  "Services",
  "Agriculture",
  "Other",
];

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [authEmail, setAuthEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [businessName, setBusinessName] = useState("Mikama Services");
  const [businessType, setBusinessType] = useState("");
  const [fullName, setFullName] = useState("Abraham Michael");
  const [location, setLocation] = useState("satellite town, Lagos");
  const [businessOpen, setBusinessOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  const setupSteps: Record<Step, number> = {
    email: 0,
    otp: 0,
    pin: 0,
    business: 1,
    about: 2,
    location: 3,
  };
  const currentSetupStep = setupSteps[step];

  function goBack() {
    setError("");
    const order: Step[] = ["email", "otp", "pin", "business", "about", "location"];
    const index = order.indexOf(step);
    if (index > 0) setStep(order[index - 1]);
  }

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

  function validateEmailForSubmit() {
    const normalizedEmail = authEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return false;
    }

    return true;
  }

  async function requestOtpByEmail() {
    if (!validateEmailForSubmit()) return;

    await submit(async () => {
      const normalizedEmail = authEmail.trim().toLowerCase();
      await requestEmailOtp(normalizedEmail);
      setAuthEmail(normalizedEmail);
      setResendAvailableAt(Date.now() + 60_000);
      setStep("otp");
    });
  }

  async function resendEmailOtp() {
    const secondsLeft = getCooldownSeconds(resendAvailableAt);
    if (secondsLeft > 0) {
      setError(`Please wait ${secondsLeft}s before requesting another OTP.`);
      return;
    }

    if (!validateEmailForSubmit()) return;

    await submit(async () => {
      await requestEmailOtp(authEmail.trim().toLowerCase());
      setResendAvailableAt(Date.now() + 60_000);
    });
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] text-[#071122]">
      <div className="px-4 pt-4 sm:px-5 sm:pt-6">
        {currentSetupStep > 0 ? (
          <SetupProgress
            step={currentSetupStep}
            label={
              step === "business"
                ? "Business Info"
                : step === "about"
                  ? "About You"
                  : "Location"
            }
          />
        ) : (
          <div className="mx-auto flex max-w-[1080px] items-center justify-between">
            <Logo />
            <p className="text-[14px] font-semibold text-[#64748b] sm:text-[15px]">
              Secure setup
            </p>
          </div>
        )}
      </div>

      <section className="mx-auto flex min-h-[calc(100vh-88px)] max-w-[520px] flex-col px-4 pb-24 pt-5 sm:min-h-[calc(100vh-104px)] sm:px-5 sm:pt-7">
        {step === "email" && (
          <AuthPanel
            icon={<Mail className="size-10" />}
            title="Enter your email"
            subtitle="We will send a verification code before your workspace opens."
          >
            <Field
              label="Email Address"
              value={authEmail}
              onChange={setAuthEmail}
              placeholder="e.g. you@example.com"
              inputMode="email"
              type="email"
            />
            <PrimaryButton
              disabled={authEmail.trim().length < 6 || isSubmitting}
              onClick={requestOtpByEmail}
            >
              {isSubmitting ? "Sending..." : "Send OTP"}
              <ArrowRight className="size-5" />
            </PrimaryButton>
            <ErrorMessage message={error} />
          </AuthPanel>
        )}

        {step === "otp" && (
          <AuthPanel
            icon={<ShieldCheck className="size-10" />}
            title="Verify OTP"
            subtitle={`OTP sent to ${authEmail || "your email"}. Enter the code to continue.`}
          >
            <CodeField
              label="OTP Code"
              value={otp}
              onChange={setOtp}
              length={6}
            />
            <p className="text-center text-[14px] font-medium text-[#64748b]">
              Didn&apos;t get it?{" "}
              <button
                className="font-bold text-[#2563eb]"
                disabled={isSubmitting}
                onClick={resendEmailOtp}
              >
                Resend OTP
              </button>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <SecondaryButton onClick={goBack}>Back</SecondaryButton>
              <PrimaryButton
                disabled={otp.trim().length < 6 || isSubmitting}
                onClick={() =>
                  submit(async () => {
                    const result = await verifyEmailOtp(authEmail, otp);
                    setOnboardingToken(result.onboardingToken);
                    setStep("pin");
                  })
                }
              >
                {isSubmitting ? "Verifying..." : "Verify"}
                <ArrowRight className="size-5" />
              </PrimaryButton>
            </div>
            <ErrorMessage message={error} />
          </AuthPanel>
        )}

        {step === "pin" && (
          <AuthPanel
            icon={<KeyRound className="size-10" />}
            title="Create your PIN"
            subtitle="Use this PIN to unlock SME Paddy quickly when you return."
          >
            <CodeField
              label="4-digit PIN"
              value={pin}
              onChange={setPin}
              length={4}
              secret
            />
            <p className="text-center text-[14px] font-medium leading-6 text-[#64748b]">
              Choose numbers you can remember. You can change this later in settings.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <SecondaryButton onClick={goBack}>Back</SecondaryButton>
              <PrimaryButton
                disabled={pin.trim().length < 4 || isSubmitting}
                onClick={() =>
                  submit(async () => {
                    await createPin(onboardingToken, pin);
                    setStep("business");
                  })
                }
              >
                {isSubmitting ? "Saving..." : "Next"}
                <ArrowRight className="size-5" />
              </PrimaryButton>
            </div>
            <ErrorMessage message={error} />
          </AuthPanel>
        )}

        {step === "business" && (
          <SetupPanel icon={<Store className="size-10" />} title="Business Info">
            <Field
              label="Business Name"
              placeholder="e.g. Mama Nkechi Store"
              value={businessName}
              onChange={setBusinessName}
            />
            <div className="relative">
              <label className="mb-1.5 block text-[15px] font-semibold text-[#111827]">
                Business Type
              </label>
              <button
                className="flex h-[48px] min-w-[154px] items-center justify-between gap-3 rounded-[11px] border border-[#d8e0eb] bg-white px-3.5 text-[15px] font-medium text-[#374151] shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                onClick={() => setBusinessOpen((value) => !value)}
              >
                {businessType || "Select type"}
                <ChevronDown className="size-4 text-[#94a3b8]" />
              </button>
              {businessOpen && (
                <div className="absolute z-10 mt-2 w-[226px] overflow-hidden rounded-[12px] bg-white py-1.5 text-[15px] shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
                  {businessTypes.map((type) => (
                    <button
                      key={type}
                      className="block w-full px-3.5 py-2 text-left hover:bg-[#f3f6fb]"
                      onClick={() => {
                        setBusinessType(type);
                        setBusinessOpen(false);
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <SetupActions
              isSubmitting={isSubmitting}
              disabled={!businessName.trim() || !businessType}
              onNext={() =>
                submit(async () => {
                  await saveBusinessInfo(onboardingToken, {
                    businessName,
                    businessType,
                  });
                  setStep("about");
                })
              }
            />
            <ErrorMessage message={error} />
          </SetupPanel>
        )}

        {step === "about" && (
          <SetupPanel icon={<UserRound className="size-10" />} title="About You">
            <Field label="Your Full Name" value={fullName} onChange={setFullName} />
            <SetupActions
              isSubmitting={isSubmitting}
              disabled={!fullName.trim()}
              onBack={goBack}
              onNext={() =>
                submit(async () => {
                  await saveAboutYou(onboardingToken, { fullName });
                  setStep("location");
                })
              }
            />
            <ErrorMessage message={error} />
          </SetupPanel>
        )}

        {step === "location" && (
          <SetupPanel icon={<MapPin className="size-10" />} title="Location">
            <Field label="Business Location" value={location} onChange={setLocation} />
            <SetupActions
              nextLabel="Finish"
              isSubmitting={isSubmitting}
              disabled={!location.trim()}
              onBack={goBack}
              onNext={() =>
                submit(async () => {
                  await saveLocation(onboardingToken, location);
                  onComplete();
                })
              }
            />
            <ErrorMessage message={error} />
          </SetupPanel>
        )}
      </section>
    </main>
  );
}

function SetupProgress({ step, label }: { step: number; label: string }) {
  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-2.5 flex items-center justify-between text-[14px] font-medium text-[#374151] sm:text-[15px]">
        <span>Step {step} of 3</span>
        <span>{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#bdd5ff]">
        <div
          className="h-full rounded-full bg-[#2563eb]"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}

function AuthPanel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="m-auto w-full max-w-[430px] rounded-[20px] border border-[#dfe7f2] bg-white/78 px-5 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
      <div className="mx-auto mb-4 grid size-[56px] place-items-center rounded-full bg-[#dfeaff] text-[#2563eb] shadow-[0_10px_18px_rgba(37,99,235,0.12)] [&_svg]:size-7">
        {icon}
      </div>
      <h1 className="text-center text-[23px] font-extrabold leading-tight sm:text-[24px]">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-[350px] text-center text-[14px] leading-6 text-[#52617a] sm:text-[15px]">
        {subtitle}
      </p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function SetupPanel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto mb-4 grid size-[56px] place-items-center rounded-full bg-[#dfeaff] text-[#2563eb] [&_svg]:size-7">
        {icon}
      </div>
      <h1 className="text-center text-[23px] font-extrabold sm:text-[24px]">
        {title}
      </h1>
      <div className="mx-auto mt-7 w-full max-w-[430px] space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  defaultValue,
  inputMode,
  maxLength,
  type = "text",
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-semibold text-[#111827]">
        {label}
      </span>
      <input
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        type={type}
        className="h-[48px] w-full rounded-[11px] border border-[#d8e0eb] bg-white px-3.5 text-[15px] font-medium text-[#071122] shadow-[0_1px_3px_rgba(15,23,42,0.08)] outline-none transition placeholder:text-[#7b8798] focus:border-[#2563eb] focus:ring-3 focus:ring-[#c7d8ff]"
      />
    </label>
  );
}

function CodeField({
  label,
  value,
  onChange,
  length,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  length: number;
  secret?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cells = Array.from({ length }, (_, index) => value[index] ?? "");

  return (
    <label className="block">
      <span className="mb-2.5 block text-center text-[15px] font-semibold text-[#071122]">
        {label}
      </span>
      <div
        className={cn(
          "grid gap-2",
          length === 4 ? "grid-cols-4 px-10 sm:px-14" : "grid-cols-6", 
        )}
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
            {secret && digit ? "*" : digit}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, length);
          onChange(digits);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        className="sr-only"
      />
    </label>
  );
}

function SetupActions({
  onBack,
  onNext,
  nextLabel = "Next",
  isSubmitting,
  disabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 mx-auto grid max-w-[430px] grid-cols-2 gap-3 px-4 sm:bottom-6 sm:px-0">
      {onBack ? (
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
      ) : (
        <span />
      )}
      <PrimaryButton disabled={disabled || isSubmitting} onClick={onNext}>
        {isSubmitting ? "Saving..." : nextLabel}
        <ArrowRight className="size-5" />
      </PrimaryButton>
    </div>
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
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-[12px] bg-[#2563eb] text-[12px] font-black text-white">
        SP
      </div>
      <span className="text-[19px] font-black sm:text-[20px]">SME Paddy</span>
    </div>
  );
}

function getCooldownSeconds(timestamp: number) {
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="rounded-[12px] border border-[#fecaca] bg-[#fff1f2] px-3.5 py-2.5 text-center text-[13px] font-semibold text-[#be123c] sm:text-[14px]">
      {message}
    </p>
  );
}
