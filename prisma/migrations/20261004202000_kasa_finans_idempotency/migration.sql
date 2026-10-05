-- ===========================================================================
-- ASAMA 5 - IDEMPOTENCY ANAHTARLARI (mimari kural 7)
--
-- Kasa hareketi, gider, diger gelir ve stok hareketinde "personel butona iki
-- kez basti" durumunda ikinci kayit OLUSMAMALIDIR. Anahtar NULL olabilir
-- (betikten veya eski kayitlardan gelen satirlar); PostgreSQL unique indeksi
-- birden fazla NULL'a izin verdigi icin bu guvenli.
-- ===========================================================================

-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "OtherIncome" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_idempotencyKey_key" ON "CashMovement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_idempotencyKey_key" ON "Expense"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OtherIncome_idempotencyKey_key" ON "OtherIncome"("idempotencyKey");

