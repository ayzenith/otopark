-- AlterTable
ALTER TABLE "TariffRule" ADD COLUMN     "extraDayBlockPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VehicleClass" ADD COLUMN     "excludeFromStandardTariff" BOOLEAN NOT NULL DEFAULT false;


-- Negatif olamaz: ek gun blok ucreti de para alanidir.
ALTER TABLE "TariffRule"
  ADD CONSTRAINT "tariff_extra_day_block_non_negative" CHECK ("extraDayBlockPrice" >= 0);

-- KARAVAN standart otopark tarifesinin DISINDA (karar 04.10.2026).
-- Fiyati henuz belirlenmedi; sinifa ozel kural yazilana kadar karavan
-- cikislarinda ucret hesaplanmaz ve islem "tarife tanimsiz" isaretlenir.
UPDATE "VehicleClass" SET "excludeFromStandardTariff" = true WHERE "code" = 'KARAVAN';
