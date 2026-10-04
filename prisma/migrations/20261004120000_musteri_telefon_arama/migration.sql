-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "altPhoneNormalized" TEXT,
ADD COLUMN     "phoneNormalized" TEXT;

-- CreateIndex
CREATE INDEX "Customer_phoneNormalized_idx" ON "Customer"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Customer_altPhoneNormalized_idx" ON "Customer"("altPhoneNormalized");


-- Mevcut kayitlar icin doldurma: rakam disi karakterler atilir, ulke kodu
-- (90) ve bastaki sifir dusulur. Uygulamadaki normalizeTelefon() ile ayni
-- kurali uygular.
UPDATE "Customer"
SET "phoneNormalized" = CASE
      WHEN length(regexp_replace("phone", '\D', '', 'g')) = 12
           AND regexp_replace("phone", '\D', '', 'g') LIKE '90%'
        THEN substr(regexp_replace("phone", '\D', '', 'g'), 3)
      WHEN length(regexp_replace("phone", '\D', '', 'g')) = 11
           AND regexp_replace("phone", '\D', '', 'g') LIKE '0%'
        THEN substr(regexp_replace("phone", '\D', '', 'g'), 2)
      ELSE regexp_replace("phone", '\D', '', 'g')
    END
WHERE "phoneNormalized" IS NULL;

UPDATE "Customer"
SET "altPhoneNormalized" = CASE
      WHEN length(regexp_replace("altPhone", '\D', '', 'g')) = 12
           AND regexp_replace("altPhone", '\D', '', 'g') LIKE '90%'
        THEN substr(regexp_replace("altPhone", '\D', '', 'g'), 3)
      WHEN length(regexp_replace("altPhone", '\D', '', 'g')) = 11
           AND regexp_replace("altPhone", '\D', '', 'g') LIKE '0%'
        THEN substr(regexp_replace("altPhone", '\D', '', 'g'), 2)
      ELSE regexp_replace("altPhone", '\D', '', 'g')
    END
WHERE "altPhone" IS NOT NULL AND "altPhoneNormalized" IS NULL;
