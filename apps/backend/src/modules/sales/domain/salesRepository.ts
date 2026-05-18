export type PaymentStatus = "PAID" | "PART_PAYMENT" | "WILL_PAY_LATER";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type CreateInvoiceData = {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  dueDate: Date;
  notes?: string;
};

export type CreateSaleData = {
  businessProfileId: string;
  stockItemId: string;
  quantity: number;
  unitPriceKobo: number;
  customerId?: string;
  customerName?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaidKobo: number;
  invoiceId?: string;
  createInvoice?: CreateInvoiceData;
};

export type SaleRecord = {
  id: string;
  invoiceId: string | null;
  customerName: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  subtotalKobo: number;
  amountPaidKobo: number;
  balanceKobo: number;
  createdAt: Date;
};

export type SaleListItem = SaleRecord & {
  itemNames: string[];
};

export type ListSalesInput = {
  businessProfileId: string;
  limit: number;
  cursor?: string;
};

export interface SalesRepository {
  createSale(input: CreateSaleData): Promise<SaleRecord>;
  listSales(input: ListSalesInput): Promise<{
    sales: SaleListItem[];
    nextCursor: string | null;
  }>;
}
