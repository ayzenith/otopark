-- Başlangıç verileri: araç sınıfları, gider kategorileri, tarife, yıkama, patron hesabı

SET session_replication_role = 'replica';

-- VehicleClass
INSERT INTO "VehicleClass" VALUES ('cmv47hybx00007d0i58o57kxt', 'MOTOSIKLET', 'Motosiklet', 10, true, false) ON CONFLICT DO NOTHING;
INSERT INTO "VehicleClass" VALUES ('cmv47hycm00017d0i7ats3rgn', 'OTOMOBIL', 'Otomobil', 20, true, false) ON CONFLICT DO NOTHING;
INSERT INTO "VehicleClass" VALUES ('cmv47hycr00027d0i2pl2vslg', 'SUV', 'SUV / Arazi', 30, true, false) ON CONFLICT DO NOTHING;
INSERT INTO "VehicleClass" VALUES ('cmv47hycu00037d0i4a6hbyfw', 'MINIBUS', 'Minibüs', 40, true, false) ON CONFLICT DO NOTHING;
INSERT INTO "VehicleClass" VALUES ('cmv47hycw00047d0i5fahurt0', 'KAMYONET', 'Kamyonet', 50, true, false) ON CONFLICT DO NOTHING;
INSERT INTO "VehicleClass" VALUES ('cmv47hycz00057d0iaqmfr5z8', 'KARAVAN', 'Karavan', 60, true, true) ON CONFLICT DO NOTHING;
INSERT INTO "VehicleClass" VALUES ('cmv47hyd200067d0iil0bpzdi', 'CEKICI', 'Çekici / Römork', 70, true, false) ON CONFLICT DO NOTHING;

-- ExpenseCategory
INSERT INTO "ExpenseCategory" VALUES ('cmv47hyd500077d0i5zt22x86', 'MAAS', 'Personel maaşı', true, true, 10) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hydf00087d0i6zghjtvx', 'AVANS', 'Personel avansı (kullanım dışı)', true, false, 20) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hydk00097d0iyet21ow1', 'PRIM', 'Personel primi', true, true, 30) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hydr000a7d0iz2fji6f1', 'SGK', 'Sigorta / SGK', true, true, 40) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hydt000b7d0irc2dmzjr', 'YEMEK', 'Yemek', true, true, 50) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hydw000c7d0iwycvb2ho', 'ELEKTRIK', 'Elektrik', true, true, 60) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hydy000d7d0i41yxloez', 'SU', 'Su', true, true, 70) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hye0000e7d0imcrmetnj', 'KIRA', 'Kira', true, true, 80) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hye3000f7d0iqpn8qwal', 'YIKAMA_MALZEME', 'Oto yıkama malzemesi', true, true, 90) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hye5000g7d0i2p3rg945', 'TEMIZLIK_SARF', 'Temizlik ve sarf malzemesi', true, true, 100) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hye7000h7d0idy7oyj3o', 'BAKIM_ONARIM', 'Bakım ve onarım', true, true, 110) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hyea000i7d0inm8sn0q3', 'VERGI', 'Vergi ve resmî ödemeler', true, true, 120) ON CONFLICT DO NOTHING;
INSERT INTO "ExpenseCategory" VALUES ('cmv47hyec000j7d0ia6pzxp4g', 'DIGER', 'Diğer işletme gideri', true, true, 999) ON CONFLICT DO NOTHING;

-- BusinessSetting
INSERT INTO "BusinessSetting" VALUES ('singleton', 'Londra Camping Otopark', '', 'https://maps.app.goo.gl/rLR4CvWx5VsCNLr5A', NULL, NULL, '0555 056 79 79', '0555 056 79 79', '7/24 AÇIK', NULL, 'Europe/Istanbul', 0, 'TRY', '2026-10-11 19:18:54.056', NULL, '[]') ON CONFLICT DO NOTHING;

-- ParkingCapacitySetting
INSERT INTO "ParkingCapacitySetting" VALUES ('singleton', 0, 0, 90, '2026-10-11 19:18:42.29', NULL) ON CONFLICT DO NOTHING;

-- User (patron) — şifre: Mehmetabi1.. (Argon2id hash)
INSERT INTO "User" VALUES ('cmv47hyi9000k7d0igefqhqy0', 'patron', '$argon2id$v=19$m=19456,t=2,p=1$Vs1CjPdvMHvP0unCu0Hstw$cUPMwAQjbnYixhK9kkFaKJS7W/Eiasiy++pb2tumNNY', 'İşletme Sahibi', NULL, 'İşletme Sahibi', 'OWNER', true, true, 0, NULL, NULL, '2026-10-11 19:18:42.417', '2026-10-11 19:18:42.417', NULL, NULL, NULL) ON CONFLICT DO NOTHING;

-- TariffPlan
INSERT INTO "TariffPlan" VALUES ('cmv47i3f600007d275jimrf83', 'Standart Otopark Tarifesi', 'İşletme sahibinin verdiği başlangıç tarifesi (04.10.2026)', true, true, 100, '2026-10-11 19:18:48.787', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;

-- TariffVersion
INSERT INTO "TariffVersion" VALUES ('cmv47i3fg00027d27cxnjzbex', 'cmv47i3f600007d275jimrf83', 1, '2026-10-11 19:18:18.789', NULL, true, 'Başlangıç tarifesi (işletme sahibinin verdiği değerler, 04.10.2026)', '2026-10-11 19:18:48.796', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;

-- TariffRule (standart + karavan)
INSERT INTO "TariffRule" VALUES ('cmv47i3fg00047d27awa5bsvl', 'cmv47i3fg00027d27cxnjzbex', NULL, 0, false, 0, 60, 100.00, 50.00, 60, 0.00, 500.00, NULL, NULL, NULL, NULL, 0.00, true, 600.00) ON CONFLICT DO NOTHING;
INSERT INTO "TariffRule" VALUES ('cmv47i3fg00057d2720ule9to', 'cmv47i3fg00027d27cxnjzbex', 'cmv47hycz00057d0iaqmfr5z8', 0, false, 0, 1440, 700.00, 0.00, 60, 0.00, 700.00, NULL, NULL, NULL, NULL, 0.00, true, 700.00) ON CONFLICT DO NOTHING;

-- WashServiceCatalog
INSERT INTO "WashServiceCatalog" VALUES ('cmv47i3go000a7d27qq9cnjmt', 'IC_DIS_YIKAMA', 'İç Dış Yıkama', 'Standart iç ve dış yıkama', 40, true, false, 10, '2026-10-11 19:18:48.841', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;
INSERT INTO "WashServiceCatalog" VALUES ('cmv47i3hu000p7d27j94bv3w8', 'MOTOR_YIKAMA', 'Motor Yıkama', 'Ek hizmet — motor bölümü yıkama', 20, true, false, 20, '2026-10-11 19:18:48.882', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;

-- WashServicePriceVersion
INSERT INTO "WashServicePriceVersion" VALUES ('cmv47i3h0000e7d27ksn942no', 'cmv47i3go000a7d27qq9cnjmt', 'cmv47hycm00017d0i7ats3rgn', 600.00, '2026-10-11 19:18:48.849', NULL, 'Başlangıç fiyatı (işletme sahibinin verdiği değerler, 04.10.2026)', '2026-10-11 19:18:48.853', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;
INSERT INTO "WashServicePriceVersion" VALUES ('cmv47i3hd000i7d278wooav8o', 'cmv47i3go000a7d27qq9cnjmt', 'cmv47hycr00027d0i2pl2vslg', 700.00, '2026-10-11 19:18:48.862', NULL, 'Başlangıç fiyatı (işletme sahibinin verdiği değerler, 04.10.2026)', '2026-10-11 19:18:48.866', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;
INSERT INTO "WashServicePriceVersion" VALUES ('cmv47i3hl000m7d27h7swj193', 'cmv47i3go000a7d27qq9cnjmt', 'cmv47hybx00007d0i58o57kxt', 400.00, '2026-10-11 19:18:48.871', NULL, 'Başlangıç fiyatı (işletme sahibinin verdiği değerler, 04.10.2026)', '2026-10-11 19:18:48.874', 'cmv47hyi9000k7d0igefqhqy0') ON CONFLICT DO NOTHING;

-- SitePage
INSERT INTO "SitePage" VALUES ('cmv47i7hr00007d3r8io8akdg', 'anasayfa', 'Ana sayfa', 'Londra Camping Otopark; metrobüs ve metroya yürüme mesafesinde, şehrin merkezinde 7 gün 24 saat açık bir otoparktır.

Aracınız profesyonel güvenlik ekibimiz ve kesintisiz çalışan kamera sistemiyle korunur. Saatlik, günlük ve aylık park seçenekleri vardır; karavanlar da kabul edilir.

Aynı çatı altında profesyonel oto yıkama hizmeti veriyoruz. Deneyimli ekibimiz ve profesyonel ekipmanlarımızla iç dış yıkama yapılır; aracınızı park ettiğiniz süre değerlendirilir, işiniz bittiğinde bakımlı ve tertemiz teslim alırsınız.', true, '2026-10-11 19:18:54.063', NULL) ON CONFLICT DO NOTHING;

SET session_replication_role = 'origin';
