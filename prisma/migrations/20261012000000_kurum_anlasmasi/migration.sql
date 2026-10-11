-- AlterEnum
ALTER TYPE "BillingMode" ADD VALUE 'AGREEMENT';

-- AlterTable
ALTER TABLE "ParkingSession" ADD COLUMN     "agreementId" TEXT,
ADD COLUMN     "agreementPriceVersionId" TEXT,
ADD COLUMN     "agreementSnapshot" JSONB;

-- AlterTable
ALTER TABLE "VehicleClass" ADD COLUMN     "washEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ParkingAgreement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ParkingAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingAgreementPriceVersion" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ParkingAgreementPriceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParkingAgreementPriceVersion_agreementId_effectiveFrom_idx" ON "ParkingAgreementPriceVersion"("agreementId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ParkingAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_agreementPriceVersionId_fkey" FOREIGN KEY ("agreementPriceVersionId") REFERENCES "ParkingAgreementPriceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAgreementPriceVersion" ADD CONSTRAINT "ParkingAgreementPriceVersion_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ParkingAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- ELLE EKLENENLER (11.10.2026, işletme sahibinin kararları)
-- ============================================================================

-- Anlaşma fiyatı her zaman pozitiftir: "0 ₺" fiyat girilemez (mimari kural 10).
ALTER TABLE "ParkingAgreementPriceVersion"
  ADD CONSTRAINT "ParkingAgreementPriceVersion_price_pozitif" CHECK ("price" > 0);

-- Bir anlaşmanın aynı anda yalnızca BİR açık (effectiveTo IS NULL) fiyatı olur.
CREATE UNIQUE INDEX "ParkingAgreementPriceVersion_acik_tek"
  ON "ParkingAgreementPriceVersion"("agreementId") WHERE "effectiveTo" IS NULL;

-- Başlangıç anlaşmaları — işletme sahibi, 11.10.2026: üç kurum, sabit 200 ₺,
-- kalış süresinden bağımsız. VERİ olarak yazılır; ad ve fiyatı patron
-- panelden değiştirir. Tekrar çalışırsa mevcut kaydı EZMEZ.
INSERT INTO "ParkingAgreement" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('anlasma_universite', 'Üniversite öğrencisi', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('anlasma_ayjet',      'AYJET',                true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('anlasma_diger',      'Diğer',                true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ParkingAgreementPriceVersion" ("id", "agreementId", "price", "effectiveFrom", "changeNote", "createdAt")
VALUES
  ('anlasma_universite_f1', 'anlasma_universite', 200.00, CURRENT_TIMESTAMP, 'Başlangıç fiyatı (işletme sahibi, 11.10.2026)', CURRENT_TIMESTAMP),
  ('anlasma_ayjet_f1',      'anlasma_ayjet',      200.00, CURRENT_TIMESTAMP, 'Başlangıç fiyatı (işletme sahibi, 11.10.2026)', CURRENT_TIMESTAMP),
  ('anlasma_diger_f1',      'anlasma_diger',      200.00, CURRENT_TIMESTAMP, 'Başlangıç fiyatı (işletme sahibi, 11.10.2026)', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Motor yıkama şimdilik verilmiyor (işletme sahibi, 11.10.2026): pasif.
-- Hizmet silinmez; patron Yönetim → Yıkama'dan "Geri aç" ile açabilir.
UPDATE "WashServiceCatalog" SET "isActive" = false WHERE "code" = 'MOTOR_YIKAMA';

-- Karavan yıkama yapılmıyor (11.10.2026): yıkamada karavan seçilemez.
UPDATE "VehicleClass" SET "washEnabled" = false WHERE "code" = 'KARAVAN';
