-- İşletme kararı (12.10.2026): otopark kapasitesi 200 araç.
-- Yalnızca tanımsızsa (0) yazılır; patronun girdiği değer ezilmez.
INSERT INTO "ParkingCapacitySetting" ("id", "totalCapacity", "warnThresholdPercent", "updatedAt")
VALUES ('singleton', 200, 90, NOW())
ON CONFLICT ("id") DO UPDATE SET "totalCapacity" = 200, "updatedAt" = NOW()
WHERE "ParkingCapacitySetting"."totalCapacity" = 0;
