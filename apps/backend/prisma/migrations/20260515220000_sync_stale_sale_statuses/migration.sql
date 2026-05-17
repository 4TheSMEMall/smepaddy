-- Back-fill SaleTransaction records whose paymentStatus and balanceKobo
-- were frozen at sale-creation time and never updated when invoice payments
-- were later recorded. This fixes all existing stale records in one pass.

-- 1. Fully-paid invoices → mark all linked sales as PAID
UPDATE "SaleTransaction"
SET "paymentStatus" = 'PAID',
    "balanceKobo"   = 0
WHERE "invoiceId" IS NOT NULL
  AND "paymentStatus" != 'PAID'
  AND EXISTS (
    SELECT 1 FROM "Invoice"
    WHERE "Invoice"."id"          = "SaleTransaction"."invoiceId"
      AND "Invoice"."balanceKobo" = 0
  );

-- 2. Partially-paid invoices → lift WILL_PAY_LATER to PART_PAYMENT
UPDATE "SaleTransaction"
SET "paymentStatus" = 'PART_PAYMENT'
WHERE "invoiceId" IS NOT NULL
  AND "paymentStatus" = 'WILL_PAY_LATER'
  AND EXISTS (
    SELECT 1 FROM "Invoice"
    WHERE "Invoice"."id"              = "SaleTransaction"."invoiceId"
      AND "Invoice"."amountPaidKobo"  > 0
      AND "Invoice"."balanceKobo"     > 0
  );
