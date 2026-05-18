import {
  Boxes,
  Car,
  CreditCard,
  FileText,
  Gift,
  Home,
  Landmark,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  Package,
  ReceiptText,
  Send,
  Settings,
  Share2,
  Sprout,
  TrendingUp,
  User,
  Users,
  WalletCards,
  Wrench,
  Zap,
} from "lucide-react";

import type { IconItem, NavItem, Period, SettingRow } from "@/types/dashboard";

export const periods: Period[] = [
  "This Week",
  "This Month",
  "This Quarter",
  "This Year",
];

export const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "transactions", label: "Transactions", icon: Send },
  { id: "stock", label: "My Stock", icon: Boxes },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "more", label: "More", icon: MoreHorizontal },
];

export const serviceItems: IconItem[] = [
  { label: "Customers", icon: Users, tone: "blue", active: true },
  { label: "Consignment", icon: Package, tone: "blue" },
  { label: "Analytics", icon: TrendingUp, tone: "purple", active: true },
  { label: "Rewards", icon: Gift, tone: "amber", active: true },
  { label: "Recurring", icon: RefreshCw, tone: "amber", active: true },
  { label: "Savings", icon: Sprout, tone: "green", active: true },
  { label: "Ajo Savings", icon: Share2, tone: "indigo" },
  { label: "Loans", icon: Landmark, tone: "blue", active: true },
  { label: "Billing", icon: CreditCard, tone: "green" },
  { label: "Profile", icon: User, tone: "green" },
  { label: "Settings", icon: Settings, tone: "slate", active: true },
  { label: "Support", icon: LockKeyhole, tone: "amber" },
];

export const settingRows: SettingRow[] = [
  {
    title: "My Profile",
    text: "View and edit business info",
    icon: User,
    tone: "blue",
  },
  {
    title: "Team",
    text: "Manage team members and roles",
    icon: Users,
    tone: "indigo",
  },
  {
    title: "Change PIN",
    text: "Update your login PIN",
    icon: LockKeyhole,
    tone: "amber",
  },
  { title: "Tax ID (TIN)", text: "Not set", icon: ReceiptText, tone: "green" },
  {
    title: "Invoice Settings",
    text: "Bank details, logo, payment terms",
    icon: FileText,
    tone: "green",
  },
  {
    title: "Billing & Subscription",
    text: "Manage your plan, view payments",
    icon: CreditCard,
    tone: "green",
  },
];

export const expenseCategoryItems: IconItem[] = [
  { label: "Transport", icon: Car },
  { label: "Rent", icon: Home },
  { label: "NEPA / Light", icon: Zap },
  { label: "Supplies", icon: Package },
  { label: "Stock Purchase", icon: WalletCards },
  { label: "Salary", icon: Users },
  { label: "Other", icon: MoreHorizontal },
];

export const saleCategoryItems: IconItem[] = [
  { label: "Product Sale", icon: Package },
  { label: "Service Sale", icon: Wrench },
  { label: "Invoice", icon: FileText },
  { label: "Other Income", icon: MoreHorizontal },
];
