-- Backward compatible: existing rows default to CASH.
ALTER TABLE "Expense" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH';
