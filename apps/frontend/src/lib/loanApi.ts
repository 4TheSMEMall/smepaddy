import { getJson, postJson } from "@/lib/api";

export type LoanType = "NANO" | "MICRO" | "SMALL" | "GROWTH";
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";
export type LoanPaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type LoanRepayment = {
  id: string;
  amount: number;
  paymentMethod: LoanPaymentMethod;
  paidOnTime: boolean;
  note: string | null;
  createdAt: string;
};

export type Loan = {
  id: string;
  loanType: LoanType;
  status: LoanStatus;
  principal: number;
  interest: number;
  total: number;
  amountRepaid: number;
  balance: number;
  tenureDays: number;
  dueDate: string;
  pcsAtApplication: number;
  disbursedAt: string;
  completedAt: string | null;
  createdAt: string;
  repayments?: LoanRepayment[];
};

export type PCSComponent = {
  score: number;
  max: number;
  label: string;
  detail: string;
};

export type EligibilityResult = {
  pcs: number;
  pcsLabel: string;
  pcsBreakdown: {
    consistency: PCSComponent;
    quality:     PCSComponent;
    repayment:   PCSComponent;
    discipline:  PCSComponent;
    tenure:      PCSComponent;
    trust:       PCSComponent;
  };
  daysActive: number;
  totalEarned: number;
  coinBalance: number;
  activeLoan: Loan | null;
  eligibility:
    | { eligible: true; tier: LoanType; maxAmount: number; minAmount: number }
    | { eligible: false; reason: string; daysNeeded: number; coinsNeeded: number };
};

export function getLoanEligibility(token: string) {
  return getJson<EligibilityResult>("/loans/eligibility", token);
}

export function listLoans(token: string) {
  return getJson<{ loans: Loan[] }>("/loans", token);
}

export function getLoan(token: string, loanId: string) {
  return getJson<{ loan: Loan }>(`/loans/${loanId}`, token);
}

export function applyForLoan(token: string, payload: { amount: number; tenureDays: number }) {
  return postJson<{ loan: Loan }>("/loans", payload, token);
}

export function repayLoan(
  token: string,
  loanId: string,
  payload: { amount: number; paymentMethod: LoanPaymentMethod; note?: string; coinsToUse?: number },
) {
  return postJson<{ loan: Loan; coinDiscount?: number }>(`/loans/${loanId}/repay`, payload, token);
}
