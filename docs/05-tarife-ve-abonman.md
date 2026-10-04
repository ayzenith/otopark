# 5. Tarife Hesaplama ve Abonman Kuralları

## Karara bağlanan kurallar (02.10.2026)

| Konu | Karar |
|---|---|
| Hangi tarife uygulanır | **Giriş anındaki tarife** — snapshot girişte yazılır, gün içi fiyat değişikliği içerideki araçları etkilemez |
| İşletme günü | **Takvim günü 00:00 – 00:00** (Europe/Istanbul) |
| Ödenmemiş abonmanla giriş | Abonman **geçerli sayılır**; personele uyarı + patron paneline bildirim |
| Abonman park sırasında biterse | O park **ücretsiz tamamlanır**; sonraki girişler normal tarife |
| Abonman kapsamı (S11, 04.10.2026) | **7/24 geçerli, sınırsız giriş-çıkış.** Günlük giriş/çıkış sayısında limit yok |
| Abonman süresi (04.10.2026) | **1 ay.** Şu anda tek süre seçeneği |
| Abonmanın yıkama indirimi (04.10.2026) | **YOK.** Yıkama ücreti abonmandan etkilenmez |
| Otoparkta araç sınıfı farkı (04.10.2026) | **YOK.** Tip farkı yalnızca yıkamada |
| Karavan (04.10.2026) | **Normal tarifenin dışında, kendi kuralı var: 700 ₺ / 24 saat**, her ek 24 saat +700 ₺ |
| Otopark kapasitesi (S3, 04.10.2026) | **SINIR YOK.** Doluluk yüzünden araç girişi engellenmez |

> **Uyarı:** Bu dokümandaki sayısal örneklerin bir kısmı **yalnızca algoritmayı
> göstermek için uydurulmuş** örneklerdir. Gerçek fiyatlar aşağıdaki
> "0. İşletmenin gerçek fiyatları" bölümünde ayrıca işaretlenmiştir.

## 0. İşletmenin gerçek fiyatları (karar: 04.10.2026)

Bu bölümdeki değerler **işletme sahibinin verdiği gerçek fiyatlardır.**
**Koda sabitlenmemiştir:** veritabanında sürümlü kayıt olarak tutulur ve patron
panelinden değiştirilir. `npm run fiyatlar:kur` komutu bunları ilk kurulumda
veritabanına **veri olarak** yazar (mevcut fiyatları ezmez).

### 0.1 Normal otopark tarifesi

| Süre | Ücret |
|---|---:|
| 0–1 saat | 100 ₺ |
| 1–2 saat | 150 ₺ |
| 2–3 saat | 200 ₺ |
| 3–4 saat | 250 ₺ |
| 4–5 saat | 300 ₺ |
| 5–6 saat | 350 ₺ |
| 6–7 saat | 400 ₺ |
| 7–8 saat | 450 ₺ |
| 8–9 saat | 500 ₺ |
| 9–24 saat | 500 ₺ |
| 24 saatten sonra **her ek 24 saat** | +600 ₺ |

**Motor parametrelerine dönüşümü** (panelde girilen alanlar):

| Alan | Değer |
|---|---:|
| İlk blok | 60 dk / 100 ₺ |
| Saatlik ücret | 50 ₺ (başlayan saat tam sayılır) |
| Günlük üst limit | 500 ₺ |
| 24 sa sonrası her ek gün | 600 ₺ |

- **Gece tarifesi YOK.** (S4 kapandı.)
- **Hafta sonu farkı YOK.**
- **Ücretsiz süre YOK:** 1 dakikalık park da 100 ₺.
- **Araç sınıfına göre fiyat farkı YOK:** kural geneldir (`vehicleClassId = null`).

**24 saat sınırı — dikkat edilecek nokta:** "24 saatten sonra her ek 24 saat"
kuralı **başlayan bloğu tam sayar.** Yani:

| Süre | Ücret | Neden |
|---|---:|---|
| tam 24 saat | 500 ₺ | ilk gün, üst limitte |
| 24 sa 1 dk | 1.100 ₺ | 500 + bir ek blok başladı |
| 48 saat | 1.100 ₺ | hâlâ tek ek blok |
| 48 sa 1 dk | 1.700 ₺ | ikinci ek blok başladı |
| 7 gün | 4.100 ₺ | 500 + 6 × 600 |

Bu yorum `tests/unit/gercek-tarife.test.ts` içinde bant bant test edilmiştir.
**Orantılı bölme yapılmaz**; patron farklı istiyorsa panelden "günlük ücret"
alanı kullanılarak eski (orantılı) modele geçilebilir.

### 0.2 Karavan — ayrı tarife (karar: 04.10.2026)

Karavanlar **normal otopark tarifesine dahil değildir** ve **kendi tarifesi
vardır:**

| Süre | Ücret |
|---|---:|
| 24 saate kadar | 700 ₺ |
| 24 saatten sonra **başlayan her 24 saat** | +700 ₺ |

| Süre | Ücret | Neden |
|---|---:|---|
| 1 saat | 700 ₺ | 24 saatlik tek blok |
| tam 24 saat | 700 ₺ | ilk blok |
| 24 sa 1 dk | 1.400 ₺ | bir ek blok başladı |
| 48 saat | 1.400 ₺ | hâlâ tek ek blok |
| 48 sa 1 dk | 2.100 ₺ | ikinci ek blok başladı |
| 7 gün | 4.900 ₺ | 700 + 6 × 700 |

**Motor parametrelerine dönüşümü** (panelde girilen alanlar):

| Alan | Değer |
|---|---:|
| İlk blok | **1440 dk / 700 ₺** |
| Saatlik ücret | **yok (0)** |
| Günlük üst limit | 700 ₺ |
| 24 sa sonrası her ek gün | 700 ₺ |

> **VARSAYIM DEĞİL, AÇIK YORUM:** İşletme karavan için yalnızca **24 saatlik**
> fiyatı verdi; **saatlik kademe vermedi ve uydurulmadı.** Bu yüzden karavan
> tarifesi 24 saatlik **tek blok** olarak girildi: 1 saatlik karavan parkı da
> 700 ₺'dir. Patron karavan için saatlik kademe isterse panelden
> (Yönetim → Tarifeler) girer; kod değişikliği gerekmez.

**Teknik yapı:** `KARAVAN` araç sınıfı `excludeFromStandardTariff = true` ile
işaretlidir. Tarife çözümleyici bu sınıf için **genel kurala düşmez**; yalnızca
karavana özel yazılmış kural geçerlidir. Karavan kuralı bir gün silinirse ücret
**hesaplanmaz**, işlem `tarifeTanimsiz` işaretlenir ve personele açık uyarı
çıkar — **sessizce otomobil fiyatından ücretlendirme mümkün değildir**
(testle doğrulanıyor).

Doğrulama: `tests/unit/karavan-tarife.test.ts` (motor) ve
`tests/integration/karavan-ve-kapasite.test.ts` (gerçek veritabanı, giriş→çıkış).

**Karavan YIKAMA ücreti hâlâ belirlenmedi** — yıkamada karavan tipi fiyatsızdır.

### 0.2.1 Otopark kapasitesi — sınır yok (karar: 04.10.2026, S3)

**Kapasite sınırı uygulanmaz.** `ParkingCapacitySetting.totalCapacity = 0`
bırakılır; bu "kapasite tanımlı değil" anlamına gelir ve:

- doluluk yüzdesi **hesaplanmaz**, personel ekranında kapasite çubuğu **çizilmez**,
- araç girişi doluluk yüzünden **hiçbir zaman engellenmez**,
- kapasite uyarısı **üretilmez**.

Kapasite mantığı koddan kaldırılmadı: patron ileride bir sayı girerse
(Yönetim → Ayarlar) doluluk göstergesi ve "otopark dolu" onayı kendiliğinden
devreye girer. Şu an **aktif değildir** (testle doğrulanıyor).

### 0.3 Oto yıkama — araç tipine göre

**Araç tipine göre fiyatlandırma YALNIZCA oto yıkamada vardır.**
Başlangıç fiyatları (İç Dış Yıkama):

| Araç tipi | Ücret |
|---|---:|
| Otomobil | 600 ₺ |
| SUV / Arazi | 700 ₺ |
| Motosiklet | 400 ₺ |

- Ek hizmetler (**motor yıkama** gibi) ayrı hizmet olarak tanımlanır; fiyatı
  panelden girilir. **Motor yıkama ücreti henüz belirlenmedi** ve hizmet
  fiyatsız oluşturulur.
- Yeni araç tipi (Ticari, Minibüs, Karavan…) panelden eklenebilir; fiyatı
  ızgaradan girilir.
- **Abonmanın yıkamada indirimi YOKTUR** (karar 04.10.2026). Yıkama
  fiyatlandırması abonman tablolarına hiç bakmaz.
- **Karavan yıkama ücreti belirlenmedi**; karavan tipi yıkamada fiyatsızdır.
- **Motor yıkama, iç temizlik, pasta/cila vb. ek hizmetlerin ücretleri
  belirlenmedi** (karar 04.10.2026: "şu an uydurma, panelden sonradan
  girilebilir bırak"). Fiyatsız hizmet **0 ₺'ye çevrilmez**; personel
  ekranında "fiyat girilmemiş" uyarısı çıkar.

Ayrıntı: `docs/09-oto-yikama.md`.

### 0.4 Abonman süresi

**Standart abonman 1 AYDIR** ve şu anda **yalnızca 1 aylık abonman** vardır.
Arayüzde tek süre seçeneği sunulur; bitiş tarihi başlangıçtan +1 ay ön dolu
gelir. Veri modeli herhangi bir tarih aralığını destekler, ileride farklı
süreler `SURE_SECENEKLERI` listesine eklenerek açılabilir.

**Abonman ücreti hâlâ müşteriye özeldir** ve ön dolu gelmez.

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
| 26 saat | 1 tam gün 200 ₺ + artan 2 sa (40 + ceil(60/60)=1×25=25) = 65 ₺ | **265 ₺** |
| 3 gün 4 sa | 3 × 200 = 600 ₺ + artan 4 sa (40 + ceil(180/60)=3×25=75) = 115 ₺ | **715 ₺** |

> **Düzeltme (04.10.2026):** Bu tablonun son satırı ilk yazımda **740 ₺**
> yazılmıştı; ilk bloğun 60 dakikası kalan süreden düşülmemişti. Tablonun diğer
> satırları (1 sa 10 dk, 3 sa 12 dk, 26 saat) ilk bloğu düşerek hesaplanmıştı,
> yani doküman kendi içinde çelişiyordu. Doğru değer **715 ₺**. Hesaplama
> motoru ve birim testleri doğru kuralı uygular.

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
| Aynı plaka iki aktif abonmanda | **Engellenir.** Uygulama kontrolü + DB kısıtı + DB tetikleyicisi (üç katman). Kuralın tam tanımı: bir aracın aynı anda yalnızca **tek açık abonman bağı** olur — tarihleri çakışmasa bile. |
| Bir müşterinin birden fazla abonmanı | İzinli (farklı araç grupları). Aynı aracın gelecek dönemi için **ikinci abonman açılmaz**; doğru yol aynı abonmana **yeni dönem** eklemektir (yenileme). |
| Bir abonmanda birden fazla plaka | İzinli, `includedVehicleCount` ile sınır konabilir; aşımda uyarı. |
| Aynı müşteri hem abonmanlı hem saatlik araç kullanıyor | İzinli; yalnızca abonmana dahil plakalar ücretsiz. |
| Abonman ortasında plaka değişikliği | Eski `SubscriptionVehicle.removedAt` işaretlenir, yeni satır eklenir; geçmiş korunur. |
| Abonman bitti ama araç hâlâ içeride | Giriş anındaki `billingMode=SUBSCRIPTION` korunur → o park ücretsiz tamamlanır. Sonraki giriş normal tarifeye tabi. **(Onaylandı: S10)** |

## 5.6.1 Uygulamada alınan yapısal kararlar (fiyat varsayımı değil)

Patron bazı alanları boş bırakabilir. Boş alan "tanımlı değil" demektir ve
sistem o alana **fiyat uydurmaz**. Ancak hesabın tutarlı kalması için bazı
yapısal kurallar gerekti; bunlar fiyat değil, *davranış* kararlarıdır:

| Durum | Davranış | Gerekçe |
|---|---|---|
| Günlük ücret girilmemiş, saatlik girilmiş | Tam günler bir günlük saatlik tutardan hesaplanır | Aksi halde 26 saatlik park sessizce bedava olurdu |
| Günlük ücret girilmemiş, günlük üst limit girilmiş | Tam günler üst limitten hesaplanır | Patronun girdiği en yakın değer |
| Günlük üst limit yok, günlük ücret var | Kısmi gün tam günü aşamaz | 23 saat, 24 saatten pahalı olmamalı |
| Tarifede hiçbir fiyat yok | Ücret 0, ama `tarifeTanimsiz` işaretlenir; personel ekranında **büyük uyarı** çıkar ve işleme not düşülür | Sessizce "0 ₺ tahsil edildi" kaydı oluşmamalı |
| Park süresi 0 dakika | Ücret 0 | Yanlışlıkla girilip hemen çıkarılan araç; doğru yol iptal işlemidir |
| Kapasite girilmemiş (0) | Araç girişi **engellenmez**, doluluk gösterilmez | İşletme kapasiteyi girmeden sistemi kullanabilmeli |

Bu kuralların hepsi `tests/unit/ucret-hesaplama.test.ts` içinde test edilir.

### Aşama 3'te eklenen yapısal kararlar (abonman)

| Durum | Davranış | Gerekçe |
|---|---|---|
| Abonman ücreti | **Hiçbir yerde ön dolu gelmez**, varsayılanı yoktur | Fiyat müşteriye özeldir; "genel abonman fiyatı" kavramı sistemde yok |
| Abonman süresi | Bitiş tarihi **boş gelir**; "+1 ay / +3 ay" düğmeleri yalnızca takvim hesabı yapar | Hangi süre sunulacağı karara bağlanmadı (S11) |
| Yenilemede ücret | Yeni dönemin ücreti **boş gelir**; eski ücret yalnızca bilgi olarak yazılır | "Geçen ay 3.000'di" diye sessizce kopyalanması yanlış kayıt üretir |
| Bir aracın abonman bağı | Aynı anda **tek açık bağ**; tarihler çakışmasa bile ikinci bağ açılmaz | "Bu plaka hangi abonmanda?" sorusunun tek yanıtı olur; uzatmanın yolu yenilemedir |
| Süresi dolmuş abonmanın bağı | Yeni abonmana geçişte **otomatik kapatılır** (`removedAt`), **silinmez**, denetime yazılır | Geçmiş korunur, plaka serbest kalır |
| Dönem fiyatı düzeltme | Yalnızca **son dönem**, gerekçe zorunlu, denetime yazılır | Geçmiş dönem kapanmış muhasebe kaydıdır (kural 6) |
| Fazla tahsilat | Engellenmez; `PAID` yapılır ve **fazla tutar bildirilir** | Peşin ödeme gerçek bir durumdur; sistem parayı reddetmemeli |
| Abonman tahsilatı iptali | **İki ayrı yol:** para iade edildiyse ters kayıt (OUT), para el değiştirmediyse `VOIDED` | İkisini birlikte yapmak tutarı iki kez düşürür (Aşama 2'de yaşanan hata) |
| Abonman ücretinin görünürlüğü | Yalnızca `subscription.price.set` izni olan kullanıcıya (varsayılan: patron) | Müşteriye özel fiyat işletme bilgisidir; personel yalnızca "ödendi / ödenmedi" görür |
| Durum alanı (`status`) | Ücret hesabı **asla** buna güvenmez; kapsam daima **tarih aralığından** çözümlenir | Durum güncellemesi hiç çalışmasa bile süresi dolmuş abonman normal tarifeye düşer |

Bu kararların hepsi `tests/integration/abonman.test.ts` ve
`tests/unit/abonman-kurallari.test.ts` içinde test edilir.

## 5.6.2 İleride eklenebilecek abonman kuralları (şu anda devre dışı)

S11 kararı gereği **tek kural** kullanılıyor: `UNLIMITED_7_24`. Veri modeli
ve hesap mantığı şu kuralları da taşır; şema değişikliği gerekmeden devreye
alınabilirler ama **arayüzden seçilemezler** ve hiçbir kayıtta kullanılmazlar:

| Kural | Ne yapar | Parametresi |
|---|---|---|
| `UNLIMITED_7_24` | **Kullanılan tek kural.** Her zaman kapsamda | — |
| `TIME_WINDOW` | Belirli saat aralığı (gece yarısını aşan aralık dahil) | başlangıç/bitiş dakikası |
| `WEEKDAY_ONLY` | Yalnızca hafta içi | — |
| `WEEKEND_ONLY` | Yalnızca hafta sonu | — |
| `ENTRY_QUOTA` | Gün/dönem başına giriş sayısı limiti | adet + kapsam |

Kural, abonmanın kendisinde **ve her dönemin kopyasında** saklanır
(`SubscriptionPeriod.accessRuleKind`): abonmanın kuralı sonradan değişse bile
geçmiş dönemin kuralı değişmez (kural 6). Kapsam dışı bir an için
`cozumleAbonman` **normal tarifeyi** uygular ve personele gerekçeyi yazar.
Yeni kural devreye alınacaksa tek değişiklik noktası `SECILEBILIR_KURALLAR`
listesidir.

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
