import type { LucideIcon } from "lucide-react";

export type Tab = "home" | "transactions" | "stock" | "invoices" | "more";

export type Screen =
  | "home"
  | "transactions"
  | "transaction-detail"
  | "new-transaction"
  | "stock"
  | "new-stock-item"
  | "stock-item-details"
  | "consignment"
  | "consignment-supplier"
  | "new-supplier"
  | "invoices"
  | "invoice-details"
  | "new-invoice"
  | "more"
  | "profile"
  | "settings"
  | "recurring-expenses"
  | "expense-detail"
  | "analytics"
  | "rewards"
  | "loans"
  | "loan-apply"
  | "loan-detail"
  | "savings";

export type Period = "This Week" | "This Month" | "This Quarter" | "This Year";

export type RecordMode = "sale" | "expense";

export type Tone = "blue" | "green" | "amber" | "purple" | "indigo" | "slate";

export type NavItem = {
  id: Tab;
  label: string;
  icon: LucideIcon;
};

export type IconItem = {
  label: string;
  icon: LucideIcon;
  description?: string;
  tone?: Tone;
  active?: boolean;
};

export type SettingRow = {
  title: string;
  text: string;
  icon: LucideIcon;
  tone: Tone;
};
