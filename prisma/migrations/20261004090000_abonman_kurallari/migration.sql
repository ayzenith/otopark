-- CreateEnum
CREATE TYPE "SubscriptionAccessRuleKind" AS ENUM ('UNLIMITED_7_24', 'TIME_WINDOW', 'WEEKDAY_ONLY', 'WEEKEND_ONLY', 'ENTRY_QUOTA');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "accessRule" JSONB,
ADD COLUMN     "accessRuleKind" "SubscriptionAccessRuleKind" NOT NULL DEFAULT 'UNLIMITED_7_24';

-- AlterTable
ALTER TABLE "SubscriptionPeriod" ADD COLUMN     "accessRule" JSONB,
ADD COLUMN     "accessRuleKind" "SubscriptionAccessRuleKind" NOT NULL DEFAULT 'UNLIMITED_7_24';


-- ===========================================================================
-- AYNI PLAKA IKI AKTIF ABONMANA BAGLANAMAZ (Asama 3 kural 8)
-- ---------------------------------------------------------------------------
-- Iki katmanli garanti:
--   1) Mevcut kismi tekil indeks "subscription_vehicle_active_uniq":
--      bir aracin ayni anda yalnizca TEK acik (removedAt IS NULL) bagi olur.
--   2) Asagidaki tetikleyici: bagin ait oldugu abonmanin DURUMUNU ve TARIH
--      ARALIGINI da dikkate alir. Boylece "ayni donemde iki aktif abonman"
--      uygulama kodu atlanarak (elle SQL, baska servis) yazilmaya calisilsa
--      bile veritabani reddeder.
--
-- Cakisma tanimi: ayni arac + iki bag da acik + her iki abonman da
-- ACTIVE/PENDING + tarih araliklari KESISIYOR.
-- Tarihler kesismiyorsa (orn. onumuzdeki ay icin pesin abonman) izin verilir.
-- ===========================================================================

CREATE OR REPLACE FUNCTION "subscription_vehicle_single_active"() RETURNS TRIGGER AS $$
DECLARE
  cakisan_kod TEXT;
BEGIN
  -- Kaldirilmis bag kisitlanmaz: gecmis kayitlar korunur.
  IF NEW."removedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT eski_abonman."code" INTO cakisan_kod
  FROM "SubscriptionVehicle" eski_bag
  JOIN "Subscription" eski_abonman ON eski_abonman."id" = eski_bag."subscriptionId"
  JOIN "Subscription" yeni_abonman ON yeni_abonman."id" = NEW."subscriptionId"
  WHERE eski_bag."vehicleId" = NEW."vehicleId"
    AND eski_bag."id" <> NEW."id"
    AND eski_bag."removedAt" IS NULL
    AND eski_abonman."status" IN ('ACTIVE', 'PENDING')
    AND yeni_abonman."status" IN ('ACTIVE', 'PENDING')
    AND eski_abonman."startDate" <= yeni_abonman."endDate"
    AND eski_abonman."endDate" >= yeni_abonman."startDate"
  LIMIT 1;

  IF cakisan_kod IS NOT NULL THEN
    RAISE EXCEPTION
      'Bu arac ayni donemde baska bir aktif abonmana bagli (abonman: %).', cakisan_kod
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "subscription_vehicle_single_active_trg" ON "SubscriptionVehicle";
CREATE TRIGGER "subscription_vehicle_single_active_trg"
  BEFORE INSERT OR UPDATE ON "SubscriptionVehicle"
  FOR EACH ROW EXECUTE FUNCTION "subscription_vehicle_single_active"();

-- Abonman PENDING -> ACTIVE yapilirken de ayni kontrol: durum degisimi
-- yoluyla cakisma olusturulmasi engellenir.
CREATE OR REPLACE FUNCTION "subscription_activate_no_conflict"() RETURNS TRIGGER AS $$
DECLARE
  cakisan_kod TEXT;
BEGIN
  IF NEW."status" <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT diger_abonman."code" INTO cakisan_kod
  FROM "SubscriptionVehicle" bu_bag
  JOIN "SubscriptionVehicle" diger_bag ON diger_bag."vehicleId" = bu_bag."vehicleId"
  JOIN "Subscription" diger_abonman ON diger_abonman."id" = diger_bag."subscriptionId"
  WHERE bu_bag."subscriptionId" = NEW."id"
    AND bu_bag."removedAt" IS NULL
    AND diger_bag."removedAt" IS NULL
    AND diger_abonman."id" <> NEW."id"
    AND diger_abonman."status" IN ('ACTIVE', 'PENDING')
    AND diger_abonman."startDate" <= NEW."endDate"
    AND diger_abonman."endDate" >= NEW."startDate"
  LIMIT 1;

  IF cakisan_kod IS NOT NULL THEN
    RAISE EXCEPTION
      'Bu abonmanin araclarindan biri ayni donemde baska bir aktif abonmana bagli (abonman: %).',
      cakisan_kod
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "subscription_activate_no_conflict_trg" ON "Subscription";
CREATE TRIGGER "subscription_activate_no_conflict_trg"
  BEFORE UPDATE OF "status" ON "Subscription"
  FOR EACH ROW EXECUTE FUNCTION "subscription_activate_no_conflict"();
