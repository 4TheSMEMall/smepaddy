export type InvoiceStatus = "PAID" | "PENDING" | "OVERDUE";

export type CreateInvoiceItemData = {
  stockItemId?: string;
  description: string;
  quantity: number;
  unitPriceKobo: number;
};

export type CreateInvoiceData = {
  businessProfileId: string;
  customerName: string;
  customerPhone?: string;
  dueDate: Date;
  notes?: string;
  items: CreateInvoiceItemData[];
};

export type InvoiceRecord = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  status: InvoiceStatus;
  subtotalKobo: number;
  amountPaidKobo: number;
  balanceKobo: number;
  dueDate: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    stockItemId: string | null;
    description: string;
    quantity: number;
    unitPriceKobo: number;
    totalKobo: number;
  }[];
  payments: InvoicePaymentRecord[];
};

export type InvoicePaymentRecord = {
  id: string;
  amountKobo: number;
  paymentMethod: "CASH" | "TRANSFER" | "CARD";
  note: string | null;
  createdAt: Date;
};

export type RecordInvoicePaymentData = {
  businessProfileId: string;
  invoiceId: string;
  amountKobo: number;
  paymentMethod: "CASH" | "TRANSFER" | "CARD";
  note?: string;
};

export interface InvoiceRepository {
  createInvoice(input: CreateInvoiceData): Promise<InvoiceRecord>;
  getInvoice(input: {
    businessProfileId: string;
    invoiceId: string;
  }): Promise<InvoiceRecord | null>;
  recordPayment(input: RecordInvoicePaymentData): Promise<InvoiceRecord>;
  listInvoices(input: {
    businessProfileId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ invoices: InvoiceRecord[]; nextCursor: string | null }>;
}
