# 2. Veritabanı Şeması

## 2.1 Tasarım ilkeleri

1. **Para `Decimal(12,2)`**, asla `Float`. Tüm tutarlar TRY.
2. **Zaman `TIMESTAMPTZ` (UTC saklanır)**, arayüzde `Europe/Istanbul` gösterilir.
   Günlük raporlar **takvim günü (00:00–00:00, Europe/Istanbul)** üzerinden hesaplanır
   (karar: 02.10.2026). Sınır `BusinessSetting.businessDayStartHour = 0` ile
   yapılandırılabilir kalır.
3. **Geçmiş değişmez.** Bir işlem kapandığında uygulanan fiyatın **anlık kopyası**
   (snapshot) işlem satırına yazılır. Yönetici tarifeyi sonradan değiştirirse geçmiş
   tutarlar değişmez.
4. **Finansal satır silinmez.** Yanlış kayıt `VOIDED` (iptal) durumuna alınır; iptal
   eden kullanıcı, zaman ve gerekçe saklanır. Gerekirse ters kayıt (`reversalOfId`) üretilir.
5. **Her yazma işlemi denetim kaydı üretir** (`AuditLog`): kim, ne zaman, hangi kayıt,
   önceki değer, yeni değer.
6. **Plaka normalize edilir.** `plateNormalized` = büyük harf, boşluk/noktalama yok,
   Türkçe karakter dönüşümü. Arama ve tekillik bu alan üzerinden.
7. **Aynı plakadan iki aktif park kaydı olamaz** — kısmi tekil indeks ile DB seviyesinde
   garanti edilir (uygulama kontrolü tek başına yarış koşulunda yetersizdir).

## 2.2 Varlıklar ve ilişkiler (kuş bakışı)

```
User ──< Shift ──< CashDrawerSession ──< CashMovement
 │         │
 │         └──< ParkingSession, WashJob, Payment, Expense   (kim yaptı)
 │
 └──< AuditLog

Customer ──< Vehicle ──< ParkingSession ──< Payment
    │           │              │
    │           │              └── tariffSnapshot (JSONB) + tariffVersionId
    │           │
    │           └──< WashJob ──< Payment
    │
    └──< Subscription ──< SubscriptionVehicle (>── Vehicle)
              │
              └──< SubscriptionPayment ──< Payment

TariffPlan ──< TariffVersion ──< TariffRule
WashServiceCatalog ──< WashServicePriceVersion
ExpenseCategory ──< Expense
InventoryItem ──< InventoryMovement (>── Expense)
SitePage / SitePublicPrice          (kurumsal web sitesi içeriği)
```

## 2.3 Tablolar

### Kimlik ve yetki

**`User`** — sistem kullanıcısı (patron veya personel)
`id`, `username` (tekil), `passwordHash`, `fullName`, `phone`, `jobTitle`,
`role` (`OWNER | MANAGER | STAFF`), `isActive`, `mustChangePassword`,
`failedLoginCount`, `lockedUntil`, `lastLoginAt`, `createdAt`, `updatedAt`,
`createdById`, `deactivatedAt`, `deactivatedById`.
→ Kullanıcı **silinmez**, devre dışı bırakılır (geçmiş işlemlerin sahibi kaybolmasın).

**`UserPermission`** — rol üstüne kullanıcıya özel izin ekleme/kaldırma
`id`, `userId`, `permission` (enum metni), `granted` (true=ek izin, false=izin kaldırma),
`grantedById`, `createdAt`. Tekil: (`userId`, `permission`).

**`Session`** — Auth.js veritabanı oturumu
`id`, `sessionToken`, `userId`, `expires`, `createdAt`, `ip`, `userAgent`.

**`EmployeeProfile`** — maliyet bilgisi, yalnızca `personnel.cost.view` izniyle okunur
`id`, `userId` (tekil), `hireDate`, `endDate`, `monthlySalary` (Decimal),
`insuranceCost`, `mealAllowance`, `notes`, `updatedAt`, `updatedById`.
→ Ayrı tablo olmasının nedeni: maaş verisini `User` sorgularından tamamen uzak tutmak.

### Müşteri ve araç

**`Customer`**
`id`, `fullName`, `phone`, `altPhone`, `email?`, `taxId?` (kurumsal müşteri),
`isCompany`, `companyName?`, `notes` (yönetici notu), `kvkkConsentAt?`,
`createdAt`, `createdById`, `isActive`.
İndeks: `phone`, `fullName` (trigram arama).

**`Vehicle`**
`id`, `plateNormalized` (**tekil**), `plateDisplay`, `vehicleClassId`,
`customerId?` (null = tanımsız/geçici araç), `brandModel?`, `color?`, `notes?`,
`createdAt`, `createdById`.
→ Bir müşterinin birden fazla aracı olabilir (`customerId` üzerinden). Araç sonradan
başka müşteriye bağlanabilir; değişiklik `AuditLog`'a yazılır.

**`VehicleClass`** — araç sınıfı (fiyatlandırma boyutu)
`id`, `code` (`MOTOSIKLET | OTOMOBIL | SUV | MINIBUS | KAMYONET | KARAVAN | ...`),
`name`, `sortOrder`, `isActive`.
→ Sabit enum değil tablo: işletme yeni sınıf ekleyebilsin (karavan/çekici gibi).
**Gerçek sınıf listesi Açık Soru S2'de soruluyor.**

### Tarife (sürümlü)

**`TariffPlan`** — tarife planı (ör. "Standart 2026", "Hafta Sonu")
`id`, `name`, `description?`, `isDefault`, `isActive`, `priority` (çakışmada büyük kazanır),
`createdAt`, `createdById`.

**`TariffVersion`** — planın zaman içindeki sürümü (**fiyat değişikliği = yeni sürüm**)
`id`, `tariffPlanId`, `versionNo`, `effectiveFrom` (TIMESTAMPTZ), `effectiveTo?`,
`isActive`, `createdAt`, `createdById`, `changeNote`.
→ Eski sürüm **asla güncellenmez**; bu sayede geçmiş işlemler korunur.

**`TariffRule`** — sürümün kuralları (araç sınıfı başına)
`id`, `tariffVersionId`, `vehicleClassId?` (null = tüm sınıflar),
`freeMinutes` (ücretsiz süre),
`gracePeriodMinutes` (çıkış için tanınan ek süre),
`firstPeriodMinutes`, `firstPeriodPrice` (ilk blok, ör. "ilk 2 saat 50 TL"),
`hourlyPrice`, `hourlyRoundingMinutes` (ör. 60 = başlayan saat tam sayılır),
`dailyPrice`, `dailyCapPrice` (24 saatlik üst limit),
`nightFlatPrice?`, `nightStartMinute?`, `nightEndMinute?` (gece tarifesi),
`weekendMultiplier?`,
`minCharge`, `isActive`.
→ Hesaplama algoritması ve örnekleri doküman 05'te.

**`TariffChangeLog`** — kim, ne zaman, neyi değiştirdi (AuditLog'a ek olarak okunabilir tarihçe)
`id`, `tariffPlanId`, `fromVersionId?`, `toVersionId`, `changedById`, `changedAt`, `note`.

### Otopark hareketleri

**`ParkingSession`** — araç giriş-çıkış kaydı (sistemin kalbi)
`id`, `code` (insan okunur fiş no, ör. `P-260402-0143`),
`vehicleId`, `plateNormalized` (denormalize, hızlı arama + araç kaydı değişse bile sabit),
`plateDisplay`, `vehicleClassId`,
`entryAt`, `entryUserId`, `entryShiftId`, `entryNote?`,
`exitAt?`, `exitUserId?`, `exitShiftId?`,
`status` (`ACTIVE | COMPLETED | VOIDED`),
`billingMode` (`TARIFF | SUBSCRIPTION | FREE | MANUAL_OVERRIDE`),
`subscriptionId?` (abonmanla girdiyse),
`tariffVersionId?`, `tariffRuleId?`,
`tariffSnapshot` (**JSONB** — uygulanan kuralın tam kopyası),
`durationMinutes?` (çıkışta yazılır),
`calculatedAmount?` (sistemin hesapladığı),
`discountAmount?`, `discountReason?`, `discountById?`,
`payableAmount?` (tahsil edilmesi gereken),
`collectedAmount?` (fiilen tahsil edilen),
`voidedAt?`, `voidedById?`, `voidReason?`,
`idempotencyKey` (tekil, çift kayıt engeli),
`createdAt`, `updatedAt`.

İndeksler / kısıtlar:
- `UNIQUE (plateNormalized) WHERE status = 'ACTIVE'` → **aynı plakadan ikinci aktif giriş imkânsız.**
- `INDEX (entryAt)`, `INDEX (exitAt)`, `INDEX (status, entryAt)`, `INDEX (plateNormalized, entryAt)`
- `INDEX (entryShiftId)`, `INDEX (exitShiftId)`

**`ParkingCapacitySetting`** — kapasite ve doluluk
`id`, `totalCapacity`, `reservedForSubscribers?`, `warnThresholdPercent`, `updatedAt`, `updatedById`.

### Abonman

**`Subscription`**
`id`, `code`, `customerId`,
`planLabel` (ör. "Aylık", "3 Aylık", "Yıllık" — serbest metin + referans tablo),
`subscriptionTypeId?`,
`startDate`, `endDate`,
`agreedPrice` (**Decimal — müşteriye özel ücret; genel tarifeden bağımsız**),
`priceNote?` (ör. "eski müşteri indirimi, patron onayı"),
`billingPeriod` (`MONTHLY | QUARTERLY | YEARLY | CUSTOM`),
`status` (`PENDING | ACTIVE | EXPIRED | CANCELLED | SUSPENDED`),
`paymentStatus` (`UNPAID | PARTIAL | PAID`),
`includedVehicleCount`, `coveredHoursNote?`,
`autoRenew` (varsayılan **false**),
`cancelledAt?`, `cancelledById?`, `cancelReason?`,
`managerNotes?`,
`createdAt`, `createdById`, `updatedAt`, `updatedById`.
→ **Abonman oluşturmak ödeme kaydı yaratmaz.** Tahsilat ayrı ve açık onayla girilir.

**`SubscriptionVehicle`** — abonmana dahil plakalar
`id`, `subscriptionId`, `vehicleId`, `addedAt`, `removedAt?`, `addedById`.
Kısıt: Bir araç aynı anda yalnızca **bir aktif** abonmanda olabilir
(`UNIQUE (vehicleId) WHERE removedAt IS NULL AND subscription.status='ACTIVE'`
— uygulama + exclusion constraint ile; detay doküman 05).

**`SubscriptionType`** — isteğe bağlı şablon (fiyat **zorunlu değil**)
`id`, `name`, `defaultDurationDays`, `suggestedPrice?`, `isActive`, `notes`.
→ Yalnızca **öneri**; her abonmanın gerçek fiyatı `Subscription.agreedPrice`.

**`SubscriptionPeriod`** — yenileme tarihçesi (fiyat geçmişi burada korunur)
`id`, `subscriptionId`, `periodNo`, `startDate`, `endDate`, `price`,
`createdAt`, `createdById`, `note`.
→ Müşterinin geçmişte ne ödediği, fiyatı sonradan değişse bile kaybolmaz.

**`SubscriptionPayment`**
`id`, `subscriptionId`, `subscriptionPeriodId?`, `paymentId`, `amount`,
`createdAt`, `createdById`.

### Oto yıkama

**`WashServiceCatalog`** — hizmet tanımı
`id`, `code`, `name` (İç Dış Yıkama, İç Temizlik, Detaylı Temizlik, Pasta Cila, ...),
`description?`, `estimatedMinutes?`, `isActive`, `isPublicOnWebsite`, `sortOrder`,
`createdAt`, `createdById`.

**`WashServicePriceVersion`** — hizmet fiyatının sürümü (araç sınıfı bazlı)
`id`, `washServiceId`, `vehicleClassId?`, `price`, `effectiveFrom`, `effectiveTo?`,
`createdById`, `changeNote`.

**`WashJob`**
`id`, `code`, `vehicleId`, `plateNormalized`, `plateDisplay`, `customerId?`,
`vehicleClassId`,
`status` (`QUEUED | IN_PROGRESS | COMPLETED | CANCELLED`),
`queuedAt`, `startedAt?`, `completedAt?`, `cancelledAt?`, `cancelReason?`,
`assignedUserId?` (yıkamayı yapan), `createdById`, `shiftId`,
`totalAmount`, `discountAmount?`, `payableAmount`, `collectedAmount?`,
`paymentStatus` (`UNPAID | PAID | VOIDED`),
`notes?`, `idempotencyKey`, `createdAt`, `updatedAt`.

**`WashJobItem`** — işe eklenen hizmet satırları (fiyat snapshot'ı ile)
`id`, `washJobId`, `washServiceId`, `washServicePriceVersionId`,
`serviceNameSnapshot`, `unitPrice`, `quantity`, `lineTotal`.

**`InventoryItem`** — yıkama malzemesi
`id`, `name`, `unit` (`LITRE | ADET | KG`), `currentStock` (Decimal),
`minStock?`, `isActive`.

**`InventoryMovement`**
`id`, `inventoryItemId`, `type` (`PURCHASE | CONSUMPTION | ADJUSTMENT | WASTE`),
`quantity`, `unitCost?`, `expenseId?` (alış gidere bağlanır), `washJobId?`,
`note?`, `createdAt`, `createdById`.

### Ödeme, kasa, finans

**`Payment`** — her tahsilat tek satır
`id`, `code`, `amount` (Decimal),
`method` (`CASH | CARD | TRANSFER | OTHER`),
`cardNote?` (manuel kart kaydı için serbest not — **POS entegrasyonu yoktur**),
`direction` (`IN | OUT` — iade için OUT),
`sourceType` (`PARKING | SUBSCRIPTION | WASH | OTHER_INCOME | REFUND`),
`parkingSessionId?`, `washJobId?`, `subscriptionId?`, `otherIncomeId?`,
`shiftId`, `cashDrawerSessionId?`, `collectedById`,
`status` (`CONFIRMED | VOIDED`),
`voidedAt?`, `voidedById?`, `voidReason?`, `reversalOfId?`,
`idempotencyKey` (tekil), `createdAt`, `paidAt`.
→ **Satır silinmez.** `status='VOIDED'` + gerekirse `reversalOfId` ile ters kayıt.

**`Shift`** — vardiya
`id`, `userId`, `startedAt`, `endedAt?`, `openingNote?`, `closingNote?`,
`status` (`OPEN | CLOSED`), `closedById?`.

**`CashDrawerSession`** — kasa oturumu (gün/vardiya bazlı)
`id`, `shiftId?`, `openedAt`, `openedById`, `openingFloat` (açılış nakdi),
`closedAt?`, `closedById?`,
`expectedCash` (sistem hesabı), `countedCash?` (sayılan),
`difference?` (GENERATED: `countedCash - expectedCash`),
`differenceReason?`,
`expectedCard` (sistem hesabı), `declaredCard?`,
`status` (`OPEN | CLOSED | RECONCILED`), `notes?`.

**`CashMovement`** — kasaya elle giren/çıkan (avans, bankaya yatırma, bozuk para)
`id`, `cashDrawerSessionId`, `type` (`DEPOSIT | WITHDRAWAL | BANK_TRANSFER | ADVANCE | CORRECTION`),
`amount`, `description`, `expenseId?`, `createdAt`, `createdById`,
`status` (`CONFIRMED | VOIDED`), `voidReason?`.

**`ExpenseCategory`**
`id`, `code`, `name` (Maaş, Avans, Prim, Elektrik, Su, Yemek, SGK/Sigorta,
Yıkama Malzemesi, Temizlik/Sarf, Bakım-Onarım, Kira, Vergi, Diğer),
`isSystem` (silinemez çekirdek kategoriler), `isActive`, `sortOrder`.

**`Expense`**
`id`, `code`, `expenseCategoryId`, `amount`, `expenseDate`,
`paymentMethod` (`CASH | CARD | TRANSFER | OTHER`),
`description`, `supplierName?`, `documentNo?`,
`relatedUserId?` (maaş/avans/prim kimin için),
`cashDrawerSessionId?` (kasadan nakit çıktıysa),
`status` (`CONFIRMED | VOIDED`), `voidedAt?`, `voidedById?`, `voidReason?`,
`createdAt`, `createdById`, `attachmentUrl?`.

**`OtherIncome`** — otopark/abonman/yıkama dışı gelir
`id`, `code`, `label`, `amount`, `incomeDate`, `method`, `description`,
`status`, `createdById`, `createdAt`.

### Web sitesi içeriği (panelden yönetilir)

**`SitePage`** — düzenlenebilir public içerik blokları
`id`, `key` (`HOME_HERO`, `ABOUT`, `PARKING_INFO`, `SUBSCRIPTION_INFO`, `WASH_INFO`, `FAQ`, `CONTACT`),
`title`, `bodyMarkdown`, `isPublished`, `updatedAt`, `updatedById`.

**`SitePublicPrice`** — web sitesinde **gösterilmesi seçilen** fiyatlar
`id`, `label`, `priceText` (ör. "Saatlik 50 ₺", "Aylık abonman için arayınız"),
`sortOrder`, `isPublished`, `sourceNote?`, `updatedById`, `updatedAt`.
→ **Önemli:** Public taraf asla `Subscription.agreedPrice` gibi müşteri verisini okumaz.
Yalnızca bu tablo ve `SitePage` + `isPublicOnWebsite=true` yıkama hizmetleri okunur.

**`SiteGalleryImage`** `id`, `url`, `alt`, `sortOrder`, `isPublished`.

**`BusinessSetting`** — işletme künyesi
`id` (tek satır), `businessName`, `addressText`, `mapsUrl`, `latitude`, `longitude`,
`phone`, `whatsappPhone`, `workingHoursText`, `instagramUrl?`, `timezone`,
`businessDayStartHour` (varsayılan **0** — takvim günü), `currency`, `updatedById`, `updatedAt`.

### Denetim

**`AuditLog`**
`id`, `at`, `userId?`, `actorLabel` (kullanıcı silinmese de metin olarak saklanır),
`action` (`PARKING_ENTRY`, `PARKING_EXIT`, `PAYMENT_VOID`, `TARIFF_UPDATE`,
`SUBSCRIPTION_PRICE_CHANGE`, `USER_DEACTIVATE`, `LOGIN_SUCCESS`, `LOGIN_FAIL`, ...),
`entityType`, `entityId`, `before` (JSONB), `after` (JSONB),
`ip?`, `userAgent?`, `note?`.
İndeks: `(at)`, `(entityType, entityId)`, `(userId, at)`.
→ **Sadece ekleme (append-only).** Uygulama kullanıcısının bu tabloda `UPDATE`/`DELETE` yetkisi yok.

## 2.4 Prisma şema taslağı (kısaltılmış — kritik kısımlar)

```prisma
// Tam şema Aşama 1'de yazılacak; burada en kritik modeller ve kısıtlar gösteriliyor.

model ParkingSession {
  id                String        @id @default(cuid())
  code              String        @unique
  vehicleId         String
  vehicle           Vehicle       @relation(fields: [vehicleId], references: [id])
  plateNormalized   String
  plateDisplay      String
  vehicleClassId    String

  entryAt           DateTime
  entryUserId       String
  entryShiftId      String
  exitAt            DateTime?
  exitUserId        String?
  exitShiftId       String?

  status            ParkingStatus @default(ACTIVE)
  billingMode       BillingMode   @default(TARIFF)
  subscriptionId    String?

  tariffVersionId   String?
  tariffRuleId      String?
  tariffSnapshot    Json?         // uygulanan kuralın tam kopyası

  durationMinutes   Int?
  calculatedAmount  Decimal?      @db.Decimal(12, 2)
  discountAmount    Decimal?      @db.Decimal(12, 2)
  discountReason    String?
  payableAmount     Decimal?      @db.Decimal(12, 2)
  collectedAmount   Decimal?      @db.Decimal(12, 2)

  payments          Payment[]
  idempotencyKey    String        @unique

  voidedAt          DateTime?
  voidedById        String?
  voidReason        String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([status, entryAt])
  @@index([plateNormalized, entryAt])
  @@index([exitAt])
}
// Ham SQL migration ile eklenecek kısmi tekil indeks:
//   CREATE UNIQUE INDEX parking_active_plate_uniq
//     ON "ParkingSession"("plateNormalized") WHERE status = 'ACTIVE';

model Subscription {
  id            String             @id @default(cuid())
  code          String             @unique
  customerId    String
  customer      Customer           @relation(fields: [customerId], references: [id])
  startDate     DateTime
  endDate       DateTime
  agreedPrice   Decimal            @db.Decimal(12, 2)   // müşteriye özel
  priceNote     String?
  status        SubscriptionStatus @default(PENDING)
  paymentStatus PaymentStatus      @default(UNPAID)
  autoRenew     Boolean            @default(false)
  vehicles      SubscriptionVehicle[]
  periods       SubscriptionPeriod[]
  payments      SubscriptionPayment[]
  managerNotes  String?
  createdById   String
  createdAt     DateTime           @default(now())

  @@index([status, endDate])
  @@index([customerId])
}

model Payment {
  id               String        @id @default(cuid())
  code             String        @unique
  amount           Decimal       @db.Decimal(12, 2)
  method           PaymentMethod
  direction        Direction     @default(IN)
  sourceType       PaymentSource
  parkingSessionId String?
  washJobId        String?
  subscriptionId   String?
  shiftId          String
  collectedById    String
  status           PaymentStatus2 @default(CONFIRMED)
  voidedById       String?
  voidReason       String?
  reversalOfId     String?
  idempotencyKey   String        @unique
  paidAt           DateTime      @default(now())

  @@index([paidAt, method])
  @@index([sourceType, paidAt])
  @@index([shiftId])
}
```

## 2.5 Çıkış işleminin transaction'ı

Araç çıkışı **tek transaction**'da şunları yapar; biri başarısızsa hiçbiri yazılmaz:

1. `ParkingSession` satırını `FOR UPDATE` ile kilitle, `status='ACTIVE'` doğrula.
2. Süreyi ve tutarı **sunucuda** hesapla (`tariffSnapshot`'tan, istemci tutarından değil).
3. `ParkingSession`'ı güncelle: `exitAt`, `durationMinutes`, `calculatedAmount`, `payableAmount`, `status='COMPLETED'`.
4. Tutar > 0 ise `Payment` satırı oluştur (`idempotencyKey` ile).
5. Nakitse açık `CashDrawerSession`'ın beklenen nakdini etkileyecek kaydı bağla.
6. `AuditLog` yaz.

Aynı araç için eşzamanlı iki çıkış denemesinde ikincisi "bu araç zaten çıkış yapmış"
hatası alır; mükerrer tahsilat oluşmaz.

## 2.6 Saklama ve yedekleme

- Günlük `pg_dump` (şifreli, 30 gün), haftalık tam yedek (12 hafta), aylık (12 ay).
- Yedekler işletme dışı bir S3 uyumlu depoya kopyalanır.
- **Geri yükleme testi** her çeyrekte bir kez yapılır ve `ops/RUNBOOK.md`'ye kaydedilir.
- KVKK: işlem görmemiş müşteri kişisel verileri (ad/telefon) için saklama süresi
  belirlenmeli — **Açık Soru S12**.
