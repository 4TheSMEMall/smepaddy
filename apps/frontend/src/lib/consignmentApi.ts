import { getJson, postJson } from "@/lib/api";

export type ConsignmentSupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  address: string | null;
  notes: string | null;
  itemCount: number;
  totalOwed: number;
  totalSettled: number;
  outstanding: number;
  status: "PARTIAL" | "SETTLED";
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentItem = {
  id: string;
  name: string;
  quantity: number;
  ownerCost: number;
  sellingPrice: number;
  unitsSold: number;
  totalOwed: number;
  totalSettled: number;
  outstanding: number;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentSettlement = {
  id: string;
  amount: number;
  paymentMethod: "CASH" | "TRANSFER" | "CARD";
  reference: string | null;
  notes: string | null;
  item: { id: string; name: string } | null;
  createdAt: string;
};

export type ConsignmentOverview = {
  summary: {
    supplierCount: number;
    itemCount: number;
    totalOwed: number;
    totalSettled: number;
    outstanding: number;
  };
  suppliers: ConsignmentSupplierRow[];
};

export type ConsignmentSupplierDetails = {
  supplier: ConsignmentSupplierRow;
  summary: {
    itemCount: number;
    totalOwed: number;
    totalSettled: number;
    outstanding: number;
  };
  items: ConsignmentItem[];
  settlements: ConsignmentSettlement[];
};

export function listConsignmentSuppliers(token: string) {
  return getJson<ConsignmentOverview>("/consignment", token);
}

export function getConsignmentSupplier(token: string, supplierId: string) {
  return getJson<ConsignmentSupplierDetails>(
    `/consignment/suppliers/${supplierId}`,
    token,
  );
}

export function createConsignmentSettlement(
  token: string,
  payload: {
    supplierId: string;
    stockItemId?: string;
    amount: number;
    paymentMethod: "CASH" | "TRANSFER" | "CARD";
    reference?: string;
    notes?: string;
  },
) {
  return postJson<{ settlement: Omit<ConsignmentSettlement, "item"> }>(
    "/consignment/settlements",
    payload,
    token,
  );
}
