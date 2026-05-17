"use client";

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  FileText,
  Package,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { cn } from "@/lib/utils";

export function LandingPage({
  onGetStarted,
  onLogin,
}: {
  onGetStarted: () => void;
  onLogin: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#071122]">
      <header className="sticky top-0 z-30 border-b border-[#e5eaf1] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[86px] max-w-[1180px] items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-9 text-[15px] font-semibold text-[#64748b] md:flex">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#rewards">Rewards</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              className="hidden h-11 rounded-[14px] border border-[#d9e0ea] bg-white px-5 text-[15px] font-bold text-[#253047] sm:block"
              onClick={onLogin}
            >
              Login
            </button>
            <button
              className="h-11 rounded-[14px] bg-[#05a970] px-5 text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(5,169,112,0.2)] sm:h-12 sm:rounded-2xl sm:px-6 sm:text-[18px]"
              onClick={onGetStarted}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-[#e5eaf1] bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-20 text-center lg:py-24">
          <div className="mx-auto mb-7 inline-flex h-11 items-center gap-2 rounded-full border border-[#cfe0ff] bg-[#f3f7ff] px-5 text-[15px] font-bold text-[#2563eb]">
            <Sparkles className="size-5" />
            Built for Nigerian small businesses
          </div>
          <h1 className="mx-auto max-w-[980px] text-[54px] font-black leading-[1.02] tracking-normal text-[#071122] md:text-[78px]">
            Run sales, stock, invoices, and rewards from one calm workspace.
          </h1>
          <p className="mx-auto mt-7 max-w-[720px] text-[22px] leading-9 text-[#52617a]">
            SME Paddy helps shop owners and service businesses record daily work,
            stay stocked, follow up payments, and grow with less admin noise.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              className="flex h-[64px] items-center gap-3 rounded-[20px] bg-[#05a970] px-8 text-[22px] font-extrabold text-white shadow-[0_14px_28px_rgba(5,169,112,0.22)]"
              onClick={onGetStarted}
            >
              Open Dashboard
              <ArrowRight className="size-6" />
            </button>
            <button
              className="flex h-[64px] items-center rounded-[20px] border border-[#d9e0ea] bg-white px-8 text-[20px] font-bold text-[#253047]"
              onClick={onLogin}
            >
              Login
            </button>
            <a
              href="#features"
              className="flex h-[64px] items-center rounded-[20px] border border-[#d9e0ea] bg-white px-8 text-[20px] font-bold text-[#253047]"
            >
              See what it handles
            </a>
          </div>
        </div>
        <ProductPreview />
      </section>

      <section className="border-b border-[#e5eaf1] bg-[#f1f5f9]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-3 px-5 py-8 text-center md:grid-cols-4">
          {[
            ["Shops", Store],
            ["Food vendors", ShoppingCart],
            ["Services", ReceiptText],
            ["Fashion", Package],
          ].map(([label, Icon]) => (
            <div
              key={label as string}
              className="flex h-20 items-center justify-center gap-3 rounded-[18px] bg-white text-[17px] font-bold text-[#64748b]"
            >
              <Icon className="size-6 text-[#9aa9bc]" />
              {label as string}
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-24">
          <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[15px] font-black uppercase tracking-[0.16em] text-[#05a970]">
                Core workspace
              </p>
              <h2 className="mt-3 max-w-[760px] text-[44px] font-black leading-tight">
                Everything a small business checks every day, already connected.
              </h2>
            </div>
            <p className="max-w-[360px] text-[19px] leading-8 text-[#52617a]">
              Built around practical workflows: sell, restock, invoice, collect,
              and understand what changed.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FeatureCard
              icon={<ShoppingCart />}
              title="Sales that update stock"
              text="Record sales from existing products, use retail or wholesale prices, and keep stock counts honest."
              tone="green"
            />
            <FeatureCard
              icon={<Boxes />}
              title="Stock with consignment logic"
              text="Track owned and supplier goods, low-stock alerts, reorder amounts, and item categories."
              tone="blue"
            />
            <FeatureCard
              icon={<FileText />}
              title="Invoices that become follow-ups"
              text="Create clean customer invoices, mark paid or pending, and connect credit sales to transactions."
              tone="purple"
            />
            <FeatureCard
              icon={<BarChart3 />}
              title="Daily money visibility"
              text="See money in, money out, cash at hand, and recent activity without opening a spreadsheet."
              tone="amber"
            />
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-[#e5eaf1] bg-[#f8fafc]">
        <div className="mx-auto max-w-[1180px] px-5 py-24">
          <h2 className="text-center text-[44px] font-black">Start in three steps</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <StepCard number="1" title="Set up the business" text="Add your business name, category, and first stock items." />
            <StepCard number="2" title="Record daily activity" text="Capture sales, expenses, invoices, and payments as they happen." />
            <StepCard number="3" title="Use the signal" text="Spot what sells, what is low, and which customers still owe." />
          </div>
        </div>
      </section>

      <section id="rewards" className="bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-24">
          <div className="overflow-hidden rounded-[28px] border border-[#fde8a9] bg-[#fffaf0] p-8 shadow-[0_18px_45px_rgba(213,122,0,0.08)] md:p-12">
            <div className="grid gap-8 md:grid-cols-[160px_1fr_220px] md:items-center">
              <div className="grid size-[118px] place-items-center rounded-[30px] bg-[#f59e0b] text-white shadow-[0_14px_28px_rgba(245,158,11,0.24)]">
                <PaddyCoinIcon className="size-16" />
              </div>
              <div>
                <h2 className="text-[38px] font-black">Paddy Coins reward useful work.</h2>
                <p className="mt-4 text-[21px] leading-8 text-[#52617a]">
                  Earn coins when you record sales, add stock, invite friends, and
                  complete setup tasks. Levels and rewards can plug into the backend later.
                </p>
              </div>
              <div className="rounded-[24px] bg-white p-5 text-center shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
                <p className="text-[15px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">
                  Starter level
                </p>
                <p className="mt-3 inline-flex items-center justify-center gap-2 text-[44px] font-black text-[#d97706]">
                  <PaddyCoinIcon className="size-9" />
                  120
                </p>
                <p className="text-[18px] text-[#52617a]">coins ready</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e5eaf1] bg-[#071122]">
        <div className="mx-auto max-w-[1180px] px-5 py-10 text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <Logo inverse />
            <p className="text-[#9aa9bc]">
              A practical business companion for Nigerian SMEs.
            </p>
            <button
              className="h-12 rounded-2xl bg-white px-6 text-[18px] font-bold text-[#071122]"
              onClick={onGetStarted}
            >
              Open Dashboard
            </button>
          </div>
          <p className="mt-8 border-t border-white/10 pt-6 text-center text-[15px] text-[#9aa9bc]">
            © 2026 SME Paddy. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Logo({ inverse }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-11 place-items-center rounded-[14px] bg-[#2563eb] text-[15px] font-black text-white">
        SP
      </div>
      <span className={cn("text-[25px] font-black", inverse ? "text-white" : "text-[#071122]")}>
        SME Paddy
      </span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-20">
      <div className="overflow-hidden rounded-[30px] border border-[#dce3ec] bg-[#eef3f9] shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
        <div className="flex h-14 items-center justify-between border-b border-[#dce3ec] bg-white px-5">
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-[#ef4444]" />
            <span className="size-3 rounded-full bg-[#f59e0b]" />
            <span className="size-3 rounded-full bg-[#10b981]" />
          </div>
          <span className="text-[14px] font-bold text-[#94a3b8]">live business workspace</span>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard label="Money In" value="₦395,000" tone="green" />
              <MetricCard label="Money Out" value="₦42,500" tone="red" />
            </div>
            <div className="rounded-[22px] bg-[#142139] p-6 text-white">
              <p className="text-[15px] font-bold uppercase text-[#9eb3cf]">Cash at hand</p>
              <p className="mt-3 text-[42px] font-black">₦352,500</p>
              <div className="mt-6 h-2 rounded-full bg-white/10">
                <div className="h-2 w-[68%] rounded-full bg-[#10b981]" />
              </div>
            </div>
          </div>
          <div className="rounded-[22px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.1)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[22px] font-black">Today’s activity</h3>
              <BadgeCheck className="size-6 text-[#10b981]" />
            </div>
            {[
              ["Hp laptop", "+₦395,000", "Wholesale sale"],
              ["Restock alert", "4 pcs", "Electronics"],
              ["Invoice draft", "₦0", "Oga Mike"],
            ].map(([title, value, meta]) => (
              <div
                key={title}
                className="flex items-center justify-between border-t border-[#eef2f7] py-4"
              >
                <div>
                  <p className="text-[18px] font-bold">{title}</p>
                  <p className="text-[15px] text-[#64748b]">{meta}</p>
                </div>
                <p className="text-[18px] font-black text-[#2563eb]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] p-6 text-white",
        tone === "green" ? "bg-[#05a970]" : "bg-[#f40652]",
      )}
    >
      <p className="text-[15px] font-bold uppercase">{label}</p>
      <p className="mt-4 text-[32px] font-black">{value}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "green" | "blue" | "purple" | "amber";
}) {
  const colors = {
    green: "bg-[#ecfdf5] text-[#05a970]",
    blue: "bg-[#eef4ff] text-[#2563eb]",
    purple: "bg-[#f5edff] text-[#8b35d6]",
    amber: "bg-[#fff7e6] text-[#f59e0b]",
  };

  return (
    <div className="flex gap-6 rounded-[26px] border border-[#e5eaf1] bg-white p-7 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className={cn("grid size-16 shrink-0 place-items-center rounded-[20px]", colors[tone])}>
        <span className="[&_svg]:size-8">{icon}</span>
      </div>
      <div>
        <h3 className="text-[24px] font-black">{title}</h3>
        <p className="mt-3 text-[19px] leading-8 text-[#52617a]">{text}</p>
      </div>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[26px] bg-white p-7 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="mx-auto grid size-16 place-items-center rounded-[20px] bg-[#05a970] text-[28px] font-black text-white">
        {number}
      </div>
      <h3 className="mt-6 text-[24px] font-black">{title}</h3>
      <p className="mt-3 text-[18px] leading-7 text-[#52617a]">{text}</p>
    </div>
  );
}
