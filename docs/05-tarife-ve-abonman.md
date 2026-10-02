# 5. Tarife Hesaplama ve Abonman Kuralları

## Karara bağlanan kurallar (02.10.2026)

| Konu | Karar |
|---|---|
| Hangi tarife uygulanır | **Giriş anındaki tarife** — snapshot girişte yazılır, gün içi fiyat değişikliği içerideki araçları etkilemez |
| İşletme günü | **Takvim günü 00:00 – 00:00** (Europe/Istanbul) |
| Ödenmemiş abonmanla giriş | Abonman **geçerli sayılır**; personele uyarı + patron paneline bildirim |
| Abonman park sırasında biterse | O park **ücretsiz tamamlanır**; sonraki girişler normal tarife |

> **Uyarı:** Bu dokümandaki tüm sayısal örnekler **yalnızca algoritmayı göstermek
> için uydurulmuş** örneklerdir. Londra Camping Otopark'ın gerçek fiyatları
> **varsayılmamıştır**; doküman 07'deki sorular yanıtlanınca sisteme girilecektir.

## 5.1 Tarife çözümleme (hangi kural uygulanacak?)

Araç **girişinde** şu sırayla çözümlenir ve sonuç `tariffSnapshot` olarak kaydedilir:

```
1. Araç aktif bir abonman kapsamında mı?
      ↓ evet → billingMode = SUBSCRIPTION, ücret = 0  (bkz. 5.5)
      ↓ hayır
2. Aracın sınıfı belirlenir (kayıtlıysa kendi sınıfı, değilse varsayılan).
3. Geçerli TariffPlan'lar bulunur:
      isActive = true
      AND TariffVersion.effectiveFrom <= giriş_anı
      AND (effectiveTo IS NULL OR effectiveTo > giriş_anı)
4. Birden fazla plan uyuyorsa en yüksek `priority` kazanır;
   eşitlikte `isDefault` olan kazanır.
5. Plan içinde TariffRule seçilir:
      önce vehicleClassId = aracın sınıfı olan kural,
      yoksa vehicleClassId = NULL (genel) kural.
6. Seçilen kuralın TAM KOPYASI ParkingSession.tariffSnapshot'a yazılır.
```

**Neden girişte snapshot?** Yönetici gün içinde fiyat değiştirdiğinde, o anda içeride
olan araçlar giriş anındaki fiyatla ücretlendirilir. Bu hem adil hem de müşteriye
"girerken şu fiyatı söylemiştiniz" tartışmasını önler.
**Bu yaklaşım 02.10.2026'da işletme sahibi tarafından onaylandı (S5).**

## 5.2 Ücret hesaplama algoritması

Girdi: `entryAt`, `exitAt`, `tariffSnapshot`
Çıktı: `durationMinutes`, `calculatedAmount`, `breakdown[]` (ekranda gösterilen döküm)

```
süre_dk = (exitAt - entryAt) dakika

ADIM 1 — ÜCRETSİZ SÜRE
  if süre_dk <= freeMinutes:
        return 0 ₺   ("Ücretsiz süre içinde")

ADIM 2 — ÜCRETLENDİRİLECEK SÜRE
  ücretli_dk = süre_dk                       (varsayılan: ücretsiz süre düşülmez)
  # Ücretsiz sürenin toplam tutardan düşülüp düşülmeyeceği ayarlanabilir:
  #   freeMinutesDeductible = true  → ücretli_dk = süre_dk - freeMinutes

ADIM 3 — TAM GÜNLERİ AYIR
  tam_gün  = floor(ücretli_dk / 1440)
  artan_dk = ücretli_dk % 1440
  tutar = tam_gün × dailyPrice

ADIM 4 — ARTAN SÜREYİ HESAPLA
  artan_tutar = 0
  kalan = artan_dk

  4a) İlk blok (varsa):
      if firstPeriodMinutes > 0 and kalan > 0:
            artan_tutar += firstPeriodPrice
            kalan -= firstPeriodMinutes
            if kalan < 0: kalan = 0

  4b) Saatlik:
      if kalan > 0:
            birim = hourlyRoundingMinutes (ör. 60 → başlayan saat tam sayılır)
            saat_adedi = ceil(kalan / birim)
            artan_tutar += saat_adedi × hourlyPrice

  4c) Günlük üst limit:
      if dailyCapPrice > 0:
            artan_tutar = min(artan_tutar, dailyCapPrice)

  tutar += artan_tutar

ADIM 5 — GECE TARİFESİ  (varsa ve kural aktifse)
  Giriş ve çıkış tamamen gece aralığındaysa (nightStartMinute..nightEndMinute),
  ve nightFlatPrice tanımlıysa:
        tutar = min(tutar, nightFlatPrice)      # gece sabit ücreti avantajlıysa uygulanır
  # Gece tarifesinin "sabit ücret" mi "indirimli saatlik" mi olduğu S4'te soruluyor.

ADIM 6 — HAFTA SONU KATSAYISI (varsa)
  if weekendMultiplier and giriş günü Cumartesi/Pazar:
        tutar = tutar × weekendMultiplier

ADIM 7 — ASGARİ ÜCRET
  tutar = max(tutar, minCharge)

ADIM 8 — YUVARLAMA
  tutar = 2 ondalık basamağa yuvarla (banker's rounding yok, normal yuvarlama)

ADIM 9 — İNDİRİM (yetkili personel, gerekçe zorunlu)
  payableAmount = tutar - discountAmount   (asla 0'ın altına inmez)
```

Bu algoritma `src/server/pricing/calculate.ts` içinde **saf fonksiyon** olarak yazılır
(veritabanına erişmez), böylece onlarca senaryo birim testiyle doğrulanabilir.

### Örnek hesaplar (uydurma tarife ile)

Örnek kural: `freeMinutes=15`, `firstPeriodMinutes=60`, `firstPeriodPrice=40`,
`hourlyPrice=25`, `hourlyRoundingMinutes=60`, `dailyCapPrice=250`,
`dailyPrice=200`, `minCharge=40`

| Süre | Hesap | Tutar |
|---|---|---|
| 12 dk | ücretsiz süre içinde | **0 ₺** |
| 45 dk | ilk blok 40 ₺ | **40 ₺** |
| 1 sa 10 dk | ilk 60 dk = 40 ₺ + başlayan 1 saat × 25 = 25 ₺ | **65 ₺** |
| 3 sa 12 dk | 40 ₺ + ceil(132/60)=3 × 25 = 75 ₺ | **115 ₺** |
| 11 saat | 40 ₺ + ceil(600/60)=10 × 25 = 250 ₺ → cap 250 | **250 ₺** (üst limit) |
| 26 saat | 1 tam gün 200 ₺ + artan 2 sa (40+25) = 65 ₺ | **265 ₺** |
| 3 gün 4 sa | 3 × 200 = 600 ₺ + (40 + 4×25=100) = 140 ₺ | **740 ₺** |

## 5.3 Yönetici tarife düzenleme akışı

```
/yonetim/ayarlar/tarifeler
   ├─ Plan listesi (Standart · Hafta Sonu · Kampanya) — aktif/pasif anahtarı
   ├─ Plan seç → Sürüm geçmişi
   │     v1  01.01.2026 – 31.05.2026   (kapalı, salt okunur)
   │     v2  01.06.2026 – 01.10.2026   (kapalı, salt okunur)
   │     v3  02.10.2026 –  …           (AKTİF, düzenlenebilir mi? HAYIR)
   │
   └─ [YENİ SÜRÜM OLUŞTUR]
         → mevcut sürüm kopyalanır, fiyatlar düzenlenir
         → "Geçerlilik başlangıcı" seçilir (şimdi / ileri tarih)
         → değişiklik notu ZORUNLU
         → ÖNİZLEME: "Örnek: 3 saat park → 115 ₺ yerine 130 ₺ olacak"
         → [ONAYLA] → eski sürümün effectiveTo'su kapanır, yeni sürüm açılır
         → AuditLog + TariffChangeLog yazılır
```

**Kural: aktif sürüm bile doğrudan düzenlenmez.** Her fiyat değişikliği yeni sürüm
üretir. Bu, "geçmişteki park ücretleri geriye dönük değişmesin" gereksiniminin
teknik garantisidir.

Yıkama fiyatları aynı mantıkla `WashServicePriceVersion` üzerinden sürümlenir.

## 5.4 Abonman modeli

### Temel ilke
**Abonman fiyatı müşteriye özeldir.** Sistemde "aylık abonman = X TL" diye tek bir
genel fiyat **yoktur**. `SubscriptionType` yalnızca süre ve *öneri* fiyat tutar;
gerçek fiyat her abonmanda `Subscription.agreedPrice` alanında ayrı yazılır.

```
Müşteri A: Aylık abonman  →  agreedPrice = 3.000 ₺
Müşteri B: Aylık abonman  →  agreedPrice = 4.000 ₺
Müşteri C: Aylık abonman  →  agreedPrice = 2.200 ₺ (not: "esnaf anlaşması, 2 araç")
Müşteri D: Yıllık abonman →  agreedPrice = 28.000 ₺
```
Hepsi aynı sistemde, aynı ekranda, çakışma olmadan yaşar.

### Abonman oluşturma akışı
```
/abonmanlar/yeni  (subscription.create + price.set izni)
  1. Müşteri: mevcut müşteriyi ara (telefon/ad/plaka) veya yeni oluştur
  2. Plaka(lar) ekle → 1..n araç. Her plaka için araç sınıfı.
     ⛔ Plaka başka bir AKTİF abonmanda ise uyarı verir ve engeller
  3. Süre: başlangıç + bitiş (hızlı seçim: 1 ay / 3 ay / 6 ay / 1 yıl / özel)
  4. ÜCRET: [__________] ₺   ← serbest giriş, genel tarifeden bağımsız
     Fiyat notu: "neden bu fiyat" (ör. "patron onayı, 2 araç indirimi")
  5. Durum: PENDING olarak oluşur
  6. [KAYDET]
       → Subscription + SubscriptionVehicle + SubscriptionPeriod(periodNo=1) yazılır
       → paymentStatus = UNPAID  ❗ Ödeme kaydı OLUŞMAZ
       → AuditLog: SUBSCRIPTION_CREATE + agreedPrice
  7. Tahsilat ayrı adım: [ÖDEME ALINDI OLARAK KAYDET]
       → yöntem (Nakit/Kart/Havale) + tutar (kısmi ödeme mümkün)
       → Payment + SubscriptionPayment yazılır
       → paymentStatus: PARTIAL veya PAID
       → PAID olduğunda ve startDate geldiğinde status = ACTIVE
```

**Neden ödeme otomatik kaydedilmiyor?** Gereksinim açık: *"Abonman işlemlerinde ödeme
alınmış gibi otomatik kayıt oluşturma."* Para girişi ancak onu fiilen tahsil eden
kullanıcı tarafından, kendi adıyla onaylanarak kaydedilir.

### Durum geçişleri
```
PENDING ──(ödeme alındı + başlangıç tarihi geldi)──► ACTIVE
ACTIVE  ──(endDate geçti)──────────────────────────► EXPIRED
ACTIVE  ──(yönetici iptali, gerekçeli)────────────► CANCELLED
ACTIVE  ──(yönetici askıya aldı)──────────────────► SUSPENDED ──► ACTIVE
EXPIRED ──(yenileme: yeni SubscriptionPeriod)─────► ACTIVE
```
`EXPIRED` geçişi **gece yarısı çalışan bir görev** (cron) ile değil, **okuma anında**
hesaplanır (`endDate < now` → süresi dolmuş). Böylece görev çalışmazsa bile sistem
yanlış davranmaz. Ek olarak günlük bir görev `status` alanını eşitler ve
bitişe 7/3/1 gün kalan abonmanlar için patron paneline uyarı üretir.

### Yenileme
```
/abonmanlar/[id] → [YENİLE]
  - Yeni dönem: başlangıç = eski bitiş + 1 gün (önerilir, değiştirilebilir)
  - Ücret: eski dönemin fiyatı ÖNERİLİR ama serbestçe değiştirilebilir
       "Önceki dönem: 3.000 ₺ (Eylül 2026)"  →  Yeni dönem: [3.500] ₺
  - Kaydet → yeni SubscriptionPeriod (periodNo+1), paymentStatus = UNPAID
  - Eski dönemin fiyatı SubscriptionPeriod'da kalır, DEĞİŞMEZ
```
Böylece "geçmiş abonman ödemeleri ve önceki fiyatlar saklanır" gereksinimi karşılanır.
Müşteri profilinde dönem dönem fiyat geçmişi görülebilir:
`Oca 3.000 ₺ · Şub 3.000 ₺ · Mar 3.500 ₺ · …`

## 5.5 Abonmanlı araç girişte nasıl tanınır?

```sql
-- Araç girişinde çalışan sorgu (özet)
SELECT s.*
FROM "Subscription" s
JOIN "SubscriptionVehicle" sv ON sv."subscriptionId" = s.id
JOIN "Vehicle" v ON v.id = sv."vehicleId"
WHERE v."plateNormalized" = $1
  AND sv."removedAt" IS NULL
  AND s.status IN ('ACTIVE')
  AND s."startDate" <= now()
  AND s."endDate"   >= now()
ORDER BY s."endDate" DESC
LIMIT 1;
```

| Sonuç | Personel ekranında | `billingMode` | Çıkışta tutar |
|---|---|---|---|
| Aktif abonman bulundu | 🟢 **ABONMANLI** + müşteri adı + kalan gün | `SUBSCRIPTION` | 0 ₺, tahsilat ekranı açılmaz |
| Bitişe ≤ 7 gün | 🟡 "Abonman 5 gün sonra doluyor" | `SUBSCRIPTION` | 0 ₺ |
| Abonman var ama `endDate` geçmiş | 🟠 **"ABONMAN 28.09'DA BİTTİ — NORMAL TARİFE"** | `TARIFF` | normal hesap |
| Abonman var ama `paymentStatus = UNPAID` | 🟠 "Abonman ödemesi alınmamış" + patron paneline uyarı | `SUBSCRIPTION` | 0 ₺ |
| `SUSPENDED` / `CANCELLED` | 🔴 "Abonman iptal/askıda — normal tarife" | `TARIFF` | normal hesap |
| Abonman yok | — | `TARIFF` | normal hesap |

**Önemli:** Abonman süresi dolduğunda sistem aracı **otomatik olarak normal tarifeye
geçirir**; personel ekranında bu durum büyük ve renkli şekilde gösterilir ki personel
müşteriye bilgi verebilsin ve ücret tahsil edebilsin.

Abonmanla girilen araç çıkışında `calculatedAmount = 0` yazılır ama `ParkingSession`
kaydı normal şekilde oluşur: böylece abonmanlı araçların otopark kullanım yoğunluğu
da raporlanabilir (kaç gün, kaç saat, hangi saatler).

## 5.6 Çakışma kuralları

| Durum | Kural |
|---|---|
| Aynı plaka iki aktif abonmanda | **Engellenir.** Kayıt sırasında kontrol + DB kısıtı. |
| Bir müşterinin birden fazla abonmanı | İzinli (farklı araç grupları / farklı dönemler). |
| Bir abonmanda birden fazla plaka | İzinli, `includedVehicleCount` ile sınır konabilir; aşımda uyarı. |
| Aynı müşteri hem abonmanlı hem saatlik araç kullanıyor | İzinli; yalnızca abonmana dahil plakalar ücretsiz. |
| Abonman ortasında plaka değişikliği | Eski `SubscriptionVehicle.removedAt` işaretlenir, yeni satır eklenir; geçmiş korunur. |
| Abonman bitti ama araç hâlâ içeride | Giriş anındaki `billingMode=SUBSCRIPTION` korunur → o park ücretsiz tamamlanır. Sonraki giriş normal tarifeye tabi. **(Onaylandı: S10)** |

## 5.7 Test edilecek senaryolar (Aşama 2–3)

- Ücretsiz süre sınırında çıkış (14 dk / 15 dk / 16 dk)
- Tam 24 saat, 24 saat 1 dk, 48 saat
- Günlük üst limitin devreye girdiği an
- Gece tarifesi içinde giriş-çıkış, gece tarifesini aşan park
- Gün içinde tarife değişikliği → içerideki araç eski fiyatla çıkar
- Abonmanlı araç girişi → 0 ₺ çıkış
- Abonmanın park sırasında bitmesi
- Süresi dolmuş abonmanla giriş → normal tarife uygulanması
- Aynı plakadan mükerrer giriş denemesi
- Eşzamanlı iki çıkış denemesi (yarış koşulu)
- Üç farklı müşteriye üç farklı abonman fiyatı → her birinin doğru tahsil edilmesi
- Yenileme sonrası eski dönem fiyatının değişmemesi
- İndirim + iptal + ters kayıt sonrası kasa bakiyesinin doğru kalması
