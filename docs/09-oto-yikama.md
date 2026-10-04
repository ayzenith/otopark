# 9. Oto Yıkama

> **En önemli kural:** Oto yıkama fiyatlandırması **otopark tarifesinden tamamen
> ayrıdır.** Ne tablo, ne kod, ne hesaplama paylaşırlar. Birinde yapılan
> değişiklik diğerini etkilemez — bu, testlerle de doğrulanır
> (`tests/integration/yikama.test.ts` → "otopark ve yıkama fiyatlandırması
> birbirinden AYRI").

## 9.1 Neden ayrı?

İşletme kararı (04.10.2026):

| | Otopark | Oto yıkama |
|---|---|---|
| Araç tipine göre fiyat farkı | **YOK** | **VAR** |
| Fiyat kaynağı | `TariffPlan / TariffVersion / TariffRule` | `WashServiceCatalog / WashServicePriceVersion` |
| Hesaplama | süreye bağlı (saatlik kademe + günlük limit + ek gün) | hizmet listesinin toplamı, süreden bağımsız |
| Yönetim ekranı | Yönetim → Tarifeler | Yönetim → Yıkama fiyatları |
| Tahsilat kaydı | `Payment.sourceType = PARKING` | `Payment.sourceType = WASH` |
| Abonman etkisi | abonmanlı araç **ücretsiz** | abonman **indirimi YOK** |

İki modülün tek ortak noktası `VehicleClass` tablosudur: araç tipleri ortaktır
ama **fiyatları ayrı yerlerde tutulur.**

## 9.2 Fiyat modeli

`WashServicePriceVersion` satırları: `(hizmet, araç tipi, fiyat, geçerlilik aralığı)`

**Çözümleme sırası** (`src/server/wash/pricing.ts`):

1. Bu araç tipine **özel** fiyat (geçerli sürüm)
2. Yoksa **genel** fiyat (`vehicleClassId = null`)
3. İkisi de yoksa **`null`** — "fiyat tanımsız"

**`null` sessizce 0 TL'ye çevrilmez.** Başka bir tipin fiyatı da
kullanılmaz. Personel ekranında hizmetin yanında **"fiyat girilmemiş"** yazar;
o hizmetle iş emri açılmak istenirse sistem **açık onay ister** ve onaylanırsa
satır 0 ₺ kaydedilir, iş emrine `FİYAT TANIMSIZ` notu düşer ve patron panelinde
uyarı sayacına girer.

### Tarihsel değişmezlik — iki katman

1. **Fiyat sürümleri:** fiyat değişince mevcut satır güncellenmez; `effectiveTo`
   kapatılır ve **yeni sürüm** yazılır.
2. **İş emri satırı kopyası:** `WashJobItem` oluşturulduğu anda hizmet adının
   ve birim fiyatın **kopyasını** saklar (`serviceNameSnapshot`, `unitPrice`).

Sonuç: fiyat zamlandığında veya hizmet adı değiştiğinde **geçmiş iş emirleri ve
ciro raporları değişmez.**

## 9.3 Başlangıç fiyatları

| Hizmet | Otomobil | SUV / Arazi | Motosiklet | Diğer tipler |
|---|---:|---:|---:|---|
| İç Dış Yıkama | 600 ₺ | 700 ₺ | 400 ₺ | tanımsız |
| Motor Yıkama | tanımsız | tanımsız | tanımsız | tanımsız |

Motor yıkama ücreti **belirlenmedi**; hizmet fiyatsız oluşturulur ve patron
panelden girer. Fiyatı olmayan tipler için yukarıdaki `null` davranışı geçerlidir.

## 9.4 İş emri akışı

```
SIRADA ──► YIKAMADA ──► TAMAMLANDI
   │           │
   └─────┬─────┘
         ▼
      İPTAL (gerekçe zorunlu)
```

- Tamamlanmış veya iptal edilmiş iş **geri alınmaz**; yanlışlık varsa iptal
  edilir ve yenisi açılır.
- `SIRADA → TAMAMLANDI` geçişine izin verilir (hızlı işler için).
- İptal **durum değiştirmeyle yapılamaz**; gerekçe zorunlu olduğu için ayrı
  işlemdir.
- Devam eden işe **hizmet eklenebilir** (müşteri motor yıkama da istedi).
  Fiyat **eklendiği anda** çözümlenir ve satıra kopyalanır.
- Tahsilatı yapılmış işe hizmet eklenemez: alınan paradan fazla hizmet
  verilmesi engellenir.
- İş emrinde **en az bir hizmet** kalmalıdır; tamamen vazgeçmek için iş iptal
  edilir.

## 9.5 Tahsilat

- **Tutar istemciden alınmaz.** Her zaman iş emri satırlarından yeniden
  hesaplanır.
- İndirim **izne** bağlıdır (`parking.discount`) ve **gerekçe zorunludur**.
  İndirim toplamı aşamaz; tahsilat negatife düşmez.
- Kart notu yalnızca **KART** ödemesinde saklanır (POS bağlantısı yoktur).
- **Mükerrer tahsilat** engellenir: kayıt `FOR UPDATE` ile kilitlenir ve
  `paymentStatus = PAID` ise ikinci tahsilat reddedilir.
- Her yazma işlemi **idempotency anahtarı** taşır: aynı anahtarla ikinci istek
  ikinci tahsilat üretmez.

### Tahsilatsız tamamlama

İş bitti ama para alınmadı (müşteri sonra ödeyecek, patron ücretsiz yaptı…).
**Gerekçe zorunludur.** İş `TAMAMLANDI` olur, `paymentStatus` `UNPAID` kalır ve
patron panelinde **"Tahsil edilmeyen yıkamalar"** listesine düşer. Kayıp sessiz
kalmaz.

### İptal ve iade

Finansal kayıt **silinmez.** Tahsilatı yapılmış iş iptal edilirken paranın
fiilen iade edilip edilmediği **ayrıca sorulur**:

| Durum | Yapılan |
|---|---|
| Para **iade edildi** | Orijinal tahsilat `CONFIRMED` kalır + **ters kayıt** (`direction = OUT`, `sourceType = REFUND`) |
| Para **el değiştirmedi** | Orijinal tahsilat `VOIDED` olur, **ters kayıt üretilmez** |

İkisini birlikte yapmak tutarı **iki kez** düşürür (Aşama 2'de yaşanan hata).

## 9.6 Ekranlar

### Personel (mobil)

`/yikama`

1. Plaka gir
2. **Araç tipini seç** — yıkama fiyatı buna bağlı olduğu için açıkça sorulur
   (otopark girişinde tip gizlidir, çünkü orada fiyat farkı yoktur)
3. Hizmetleri işaretle — fiyatlar ekranda yazılı, personel müşteriye söyleyebilir
4. **SIRAYA AL**
5. Kuyruktan tek dokunuşla **YIKAMAYA AL** → **TAMAMLA**
6. **DETAY / TAHSİLAT** ile tahsilat

`/yikama/[id]` — iş detayı: hizmetler, hizmet ekle/çıkar, tahsilat,
tahsilatsız tamamlama, iptal, tahsilat kayıtları.

### Patron

| Ekran | Adres |
|---|---|
| Yıkama raporları (bugün / son 30 gün) | `/yonetim/yikama` |
| Hizmet ve fiyat yönetimi | `/yonetim/ayarlar/yikama` |

Rapor içeriği: sıradaki/yıkamadaki/tamamlanan sayıları, **yalnızca yıkama**
tahsilatı (nakit/kart ayrımıyla), hizmet bazlı ciro (oranlı çubuk),
personel işlem sayısı, tahsil edilmeyen işler, iş listesi.

Fiyat ekranı: satır = hizmet, kolon = araç tipi ızgarası. **Boş hücre = fiyat
tanımsız**, 0 ₺ olarak kaydedilmez. Ayrıca hizmet ekleme, hizmeti pasife alma
(silme yok — geçmiş bozulmasın), yeni araç tipi ekleme ve fiyat değişiklik
geçmişi.

## 9.7 Bilinmeyen / sonraki aşamalar

- **Malzeme stoğu** (`InventoryItem`, `InventoryMovement`) tabloları hazır ama
  **modül Aşama 5'e bırakıldı**: malzeme alışının gidere bağlanması Gelir-Gider
  modülünü gerektiriyor ve o Aşama 5'te geliyor. İkisini ayrı aşamalarda yapmak
  yarım bir gider kaydı üretirdi.
- **Yıkama süresi hedefi / SLA** tanımlanmadı.
- **Web sitesinde yıkama fiyat listesi** Aşama 7'de (`isPublicOnWebsite` alanı
  hazır).
- **Motor yıkama ücreti** ve **karavan yıkama ücreti** patron tarafından
  girilecek.
