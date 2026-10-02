# 4. Ekranlar ve Akışlar

## 4.1 Ekran listesi

### Personel (mobil öncelikli)
| # | Ekran | Yol | Not |
|---|---|---|---|
| P1 | Giriş | `/giris` | Kullanıcı adı + parola |
| P2 | **Ana ekran (Vardiya)** | `/vardiya` | Girişten sonra varsayılan ekran |
| P3 | Aktif araçlar | `/araclar/aktif` | Kart listesi, plaka arama |
| P4 | Araç çıkış sayfası (alt panel) | `/vardiya` içinde sheet | Süre + tutar + tahsilat |
| P5 | Araç geçmişi | `/araclar/gecmis` | Tarih filtresi, kendi yetkisi kadar |
| P6 | Yıkama kuyruğu | `/yikama` | Sırada / Yıkamada / Tamamlandı sekmeleri |
| P7 | Yeni yıkama | `/yikama/yeni` | Plaka + hizmet seçimi |
| P8 | Abonman sorgulama | `/abonmanlar/sorgu` | Salt okunur plaka sorgusu |
| P9 | Vardiyam / kasam | `/kasa/vardiyam` | Kendi tahsilat özeti, kasa kapanışı (yetkiliyse) |
| P10 | Fiyat listesi (bakış) | `/tarife` | Geçerli otopark + yıkama fiyatları |

### Yönetim (masaüstü + mobil kart düzeni)
| # | Ekran | Yol |
|---|---|---|
| Y1 | **Yönetici ana paneli** | `/yonetim` |
| Y2 | Finans — gelir/gider | `/yonetim/finans` |
| Y3 | Gider ekleme/kayıtları | `/yonetim/finans/giderler` |
| Y4 | Raporlar (tarih aralığı + dışa aktarma) | `/yonetim/raporlar` |
| Y5 | Kasa ve vardiya raporları | `/yonetim/kasa` |
| Y6 | Abonman listesi ve yönetimi | `/abonmanlar` |
| Y7 | Abonman detay / yenileme / özel fiyat | `/abonmanlar/[id]` |
| Y8 | Müşteri listesi ve profili | `/musteriler`, `/musteriler/[id]` |
| Y9 | Personel yönetimi | `/yonetim/personel` |
| Y10 | Ayarlar — otopark tarifeleri | `/yonetim/ayarlar/tarifeler` |
| Y11 | Ayarlar — yıkama fiyatları | `/yonetim/ayarlar/yikama` |
| Y12 | Ayarlar — işletme bilgileri ve kapasite | `/yonetim/ayarlar/isletme` |
| Y13 | Ayarlar — web sitesi içeriği ve public fiyatlar | `/yonetim/ayarlar/site` |
| Y14 | Denetim kayıtları | `/yonetim/denetim` |
| Y15 | Yıkama raporları ve stok | `/yonetim/yikama` |

### Kurumsal web sitesi (herkese açık)
`/` · `/hizmetler` · `/abonman` · `/oto-yikama` · `/galeri` · `/iletisim` · `/sss`

## 4.2 Personel mobil ana ekranı (P2) — taslak

Tek ekranda, kaydırmadan: plaka girişi + giriş butonu + sayaçlar.
Alt kısımda son işlemler ve hızlı eylemler.

```
┌─────────────────────────────────────┐
│ Londra Camping         Ahmet ▾      │  ← 44px üst bar, vardiya saati
│ Vardiya: 08:00'den beri             │
├─────────────────────────────────────┤
│                                     │
│   PLAKA                             │  ← etiket 13px
│  ┌───────────────────────────────┐  │
│  │  34 ABC 123                   │  │  ← 64px yükseklik, 28px mono yazı
│  └───────────────────────────────┘  │     büyük harf otomatik, sayı+harf klavye
│                                     │
│  ┌─────────────────┬─────────────┐  │
│  │  ↓ ARAÇ GİRİŞİ  │  ↑ ÇIKIŞ/   │  │  ← 2 buton, her biri 64px
│  │     (lacivert)  │    SORGULA  │  │     en belirgin öğeler
│  └─────────────────┴─────────────┘  │
│                                     │
├─────────────────────────────────────┤
│  ┌────────┬────────┬────────┐       │
│  │  47    │   112  │   98   │       │  ← 3 sayaç kartı, tek dokunuşla
│  │OTOPARK │ GİRİŞ  │ ÇIKIŞ  │       │     ilgili listeye gider
│  │ ŞU AN  │ BUGÜN  │ BUGÜN  │       │
│  └────────┴────────┴────────┘       │
│  Kapasite: 47/80  ▓▓▓▓▓▓░░░  %59    │
├─────────────────────────────────────┤
│  BENİM TAHSİLATIM (bugün)           │  ← yalnızca cash.report.self izni
│  Nakit 2.450 ₺  ·  Kart 1.180 ₺     │
│  Toplam 3.630 ₺              Detay →│
├─────────────────────────────────────┤
│  ┌───────────────┬───────────────┐  │
│  │ 🧼 YIKAMA     │ 🎫 ABONMAN    │  │  ← 2 hızlı eylem, 56px
│  │    BAŞLAT     │    SORGULA    │  │
│  └───────────────┴───────────────┘  │
├─────────────────────────────────────┤
│  SON İŞLEMLER                 Tümü →│
│  ┌─────────────────────────────────┐│
│  │ 34 ABC 123  ÇIKIŞ  3s 12dk      ││
│  │ 150 ₺ · Nakit · 14:32           ││
│  ├─────────────────────────────────┤│
│  │ 06 XYZ 456  GİRİŞ  14:28        ││
│  │ ABONMANLI ✓ Mehmet Y.           ││  ← abonman yeşil etiket
│  ├─────────────────────────────────┤│
│  │ 34 DEF 789  YIKAMA  İç-Dış      ││
│  │ 250 ₺ · Kart · 14:05            ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
│ 🏠 Ana  🚗 Araçlar  🧼 Yıkama  ☰ Diğer│  ← alt gezinme, 4 sekme, 56px
└─────────────────────────────────────┘
```

**Tasarım notları**
- Plaka alanı ekranın en belirgin öğesi; sayfa açılınca **otomatik odaklanmaz**
  (klavye hemen açılıp sayaçları gizlemesin), tek dokunuşla odaklanır.
- "ÇIKIŞ/SORGULA" butonu plaka yazılıysa sorgular, boşsa aktif araç listesini açar.
- Sayaçlar 20 saniyede bir sessizce yenilenir; kullanıcı yazarken yenileme durur.
- Tahsilat kartı izni olmayan personelde hiç çizilmez.

## 4.3 Araç girişi akışı

```
Personel plakayı yazar → [ARAÇ GİRİŞİ]
        │
        ├─ Plaka formatı geçersiz ──────► ⚠ "Plaka formatı hatalı: 34ABC123 gibi yazın"
        │                                   (yine de kaydetmek için "Yine de kaydet" seçeneği
        │                                    — yabancı/geçici plakalar için, not zorunlu)
        │
        ├─ Bu plaka ZATEN AKTİF ────────► ⛔ "Bu araç 14:28'de giriş yapmış, hâlâ içeride.
        │                                     Çıkış yapmak ister misiniz?" [ÇIKIŞA GİT]
        │                                   → mükerrer giriş engellenir (DB kısıtı da korur)
        │
        ├─ Kapasite dolu ───────────────► ⚠ "Otopark dolu (80/80). Yine de giriş alınsın mı?"
        │                                   (yetkiliyse onayla devam)
        │
        └─ Geçerli
             │
             ├─ ABONMANLI araç mı? (plaka → aktif Subscription?)
             │     ├─ AKTİF abonman  → billingMode = SUBSCRIPTION
             │     │    ✅ Yeşil onay: "GİRİŞ ALINDI · ABONMANLI
             │     │        Mehmet Yılmaz · Abonman bitiş: 28.10.2026 (26 gün)"
             │     ├─ Bitişe ≤ 7 gün → ⚠ Sarı: "Abonman 5 gün sonra doluyor"
             │     └─ SÜRESİ DOLMUŞ  → ⚠ Turuncu ve BÜYÜK uyarı:
             │          "ABONMAN 28.09.2026'DA BİTTİ — NORMAL TARİFE UYGULANACAK"
             │          (personel müşteriye söyleyebilsin; billingMode = TARIFF)
             │
             └─ Kayıt: entryAt = sunucu saati, entryUserId, entryShiftId,
                       uygulanacak TariffVersion + TariffRule çözümlenir ve
                       tariffSnapshot JSONB olarak **girişte** yazılır
                       (fiyat sonradan değişse bile bu araç giriş anındaki
                        tarifeyle ücretlendirilir — bkz. Açık Soru S5)
                  ↓
             ✅ Tam ekran onay (1,5 sn) → plaka alanı temizlenir, odak hazır
                 Fiş no: P-260402-0143 · Giriş 14:28 · Araç sınıfı: Otomobil
```

**Araç sınıfı nasıl belirlenir?** Plaka daha önce kayıtlıysa aracın kayıtlı sınıfı
kullanılır (ek dokunuş yok). Yeni plakada varsayılan **Otomobil** seçilir ve giriş
butonunun hemen altında küçük bir sınıf değiştirme şeridi görünür. Böylece normal akış
**2 dokunuş** (plaka yaz + giriş) kalır.

## 4.4 Araç çıkışı ve tahsilat akışı

```
Plaka yazılır → [ÇIKIŞ/SORGULA]   (veya aktif listeden karta dokunma)
        │
        ├─ Aktif kayıt yok ─────► ⚠ "Bu plakayla aktif araç bulunamadı."
        │                           Son 24 saatteki kayıtları gösterir:
        │                           "34 ABC 123 bugün 11:02'de çıkış yapmış (150 ₺, Nakit)"
        │                           → yanlışlıkla ikinci tahsilat engellenir
        │
        └─ Aktif kayıt bulundu → ALT PANEL (bottom sheet) açılır:

┌─────────────────────────────────────┐
│         34 ABC 123                  │  ← 32px, mono
│         Otomobil                    │
├─────────────────────────────────────┤
│  Giriş      02.10.2026  11:20       │
│  Çıkış      02.10.2026  14:32       │
│  Süre       3 saat 12 dakika        │  ← 20px kalın
│  Tarife     Standart 2026 (s.3)     │
│  Hesap      İlk 1 sa 40 ₺ +         │  ← hesap dökümü şeffaf
│             3 sa × 35 ₺ = 145 ₺     │
├─────────────────────────────────────┤
│  TAHSİL EDİLECEK                    │
│          1 8 5 , 0 0  ₺             │  ← 44px, en büyük yazı
├─────────────────────────────────────┤
│  ┌─────────────────┬─────────────┐  │
│  │   💵 NAKİT      │  💳 KART    │  │  ← 2 buton, 64px
│  └─────────────────┴─────────────┘  │
│  [ İndirim uygula ]  (yetkiliyse)   │
│  [ Vazgeç ]                         │
└─────────────────────────────────────┘
        │
        ├─ ABONMANLI araç → tutar 0 ₺, "ABONMAN KAPSAMINDA" yeşil bant,
        │                    tek buton: [ÇIKIŞI TAMAMLA] (tahsilat yok)
        │
        └─ Ödeme yöntemi seçilir → buton kilitlenir, tek transaction:
             exitAt + süre + tutar + Payment + kasa + AuditLog
                  ↓
             ✅ "TAHSİL EDİLDİ · 185,00 ₺ Nakit"  (tam ekran yeşil, 2 sn)
                 Fiş no · [Yeni işlem]
                  ↓
             Araç aktif listeden düşer, ana ekran sayaçları güncellenir
```

**Hata ve kenar durumları**
| Durum | Davranış |
|---|---|
| Aynı anda iki personel aynı aracı çıkarıyor | İkinci işlem `FOR UPDATE` kilidinde "bu araç çıkış yapmış" hatası alır; çift tahsilat yok |
| İnternet koptu, butona iki kez basıldı | `idempotencyKey` sayesinde tek kayıt oluşur |
| Tutar personelce elle değiştirilmek isteniyor | Yalnızca `parking.override_price` (sadece OWNER); gerekçe zorunlu, denetime yazılır |
| İndirim | `parking.discount` izni + sebep zorunlu (açılır liste + serbest not) |
| Yanlış çıkış yapıldı | `parking.void` izniyle iptal: kayıt silinmez, `VOIDED` olur, ters `Payment` üretilir, gerekçe zorunlu |
| Çok eski aktif kayıt (ör. 5 gün) | Uyarı: "Bu araç 5 gündür içeride görünüyor, tutar yüksek. Devam?" + yöneticiye bildirim |

## 4.5 Yıkama akışı (P6–P7)

```
[YIKAMA BAŞLAT] → plaka yaz → hizmet seç (büyük kartlar, fiyat üstünde yazılı)
   İç Dış Yıkama 250 ₺ · İç Temizlik 150 ₺ · Detaylı 600 ₺ · Pasta Cila 1.200 ₺
   (çoklu seçim mümkün, toplam altta canlı güncellenir)
        ↓
   [SIRAYA AL]  → WashJob: QUEUED, fiyat snapshot'ı satırlara yazılır
        ↓
   Kuyruk ekranı: karta dokun → [YIKAMAYA BAŞLA] → IN_PROGRESS (startedAt)
        ↓
   [TAMAMLA] → tahsilat alt paneli (Nakit / Kart) → COMPLETED + Payment
   veya [TAHSİLATSIZ TAMAMLA] (abonman/müşteri sonra ödeyecek → UNPAID kalır,
         yönetici ekranında "tahsil edilmemiş yıkamalar" listesinde görünür)
```
İptal: `[İPTAL]` → sebep zorunlu → `CANCELLED`, ödeme alınmışsa ters kayıt.

## 4.6 Abonman sorgulama (P8)

Plaka yaz → sonuç kartı:
- Müşteri adı, telefon (yetkiliyse), abonman türü, başlangıç-bitiş, kalan gün
- Durum rozetleri: `AKTİF` (yeşil) · `5 GÜN KALDI` (sarı) · `SÜRESİ DOLDU` (kırmızı) · `BEKLEMEDE` (gri)
- **Ödeme durumu** (yetkiliyse): `ÖDENDİ` / `ÖDENMEDİ`
- Müşterinin diğer plakaları listelenir
- Personel burada **düzenleme yapamaz**; yalnızca görür.

## 4.7 Abonman listesi (Y6) — yönetim

- Üstte arama: plaka · müşteri adı · telefon (tek alan, hepsinde arar)
- Hızlı filtre çipleri: `Aktif` · `7 gün içinde bitecek` · `Süresi dolmuş` · `Ödenmemiş` · `İptal`
- Sıralama: bitiş tarihine göre (yaklaşan önce)
- Mobilde kart, masaüstünde tablo
- Her satır: müşteri · plakalar · bitiş tarihi · kalan gün · **anlaşılan ücret** (yetkiliyse) · ödeme durumu
- Toplu işlem yok (yanlışlıkla kitlesel değişiklik riski); yenileme tek tek ve onaylı

## 4.8 Yönetici ana paneli (Y1) — taslak

Üstte tarih aralığı: `Bugün | Bu hafta | Bu ay | Bu yıl | Özel aralık`

```
┌──────────── ÜST ŞERİT (4 kart) ─────────────┐
│ OTOPARKTA   GİRİŞ/ÇIKIŞ   AKTİF ABONMAN   DOLULUK │
│    47        112 / 98          38            %59   │
└────────────────────────────────────────────┘

┌──────────── GELİR (gün) ────────┬──── GİDER (gün) ────┐
│ Otopark        6.420 ₺          │ Maaş/avans   0 ₺    │
│ Abonman        3.000 ₺          │ Elektrik     850 ₺  │
│ Oto yıkama     2.750 ₺          │ Malzeme      420 ₺  │
│ Diğer            180 ₺          │ Diğer        120 ₺  │
│ ── TOPLAM     12.350 ₺          │ ── TOPLAM  1.390 ₺  │
└─────────────────────────────────┴─────────────────────┘
┌──────── NET SONUÇ:  +10.960 ₺  ────────┐
└────────────────────────────────────────┘

┌─ TAHSİLAT DAĞILIMI ─┐  ┌─ 30 GÜNLÜK GELİR TRENDİ ──────┐
│ Nakit  7.900 ₺ %64  │  │  (çizgi grafik, 3 seri:        │
│ Kart   4.450 ₺ %36  │  │   otopark / abonman / yıkama)  │
└─────────────────────┘  └───────────────────────────────┘

┌─ AKTİF VARDİYA ──────┐  ┌─ UYARILAR ───────────────────┐
│ Ahmet  08:00–  3.630₺│  │ ⚠ 6 abonman 7 gün içinde biter│
│ Veli   08:00–  2.110₺│  │ ⚠ 2 araç 48 saatten uzun içeride│
│ Kasa: AÇIK           │  │ ⚠ Dün kasa farkı: −120 ₺      │
└──────────────────────┘  │ ⚠ 3 yıkama tahsil edilmemiş   │
                          └──────────────────────────────┘
┌─ SON İŞLEMLER (canlı) ──────────────────────────────────┐
└─────────────────────────────────────────────────────────┘
```
Mobilde aynı veriler tek kolon kart olarak, grafikler sadeleştirilmiş halde.

## 4.9 Kasa akışı (P9 / Y5)

```
Vardiya başı: [VARDİYAYI BAŞLAT] → Shift OPEN
   Kasa yetkisi varsa: [KASA AÇ] → açılış nakdi girilir (CashDrawerSession OPEN)
        ↓
   Gün boyu tahsilatlar otomatik bu kasa oturumuna bağlanır
        ↓
Vardiya sonu: [KASA KAPAT]
   Sistem gösterir:  Beklenen nakit 7.900 ₺ · Beklenen kart 4.450 ₺
   Personel girer:   Sayılan nakit [______]  ·  Kart dekont toplamı [______]
   Fark otomatik:    −120 ₺  → ⚠ açıklama ZORUNLU
        ↓
   [KAPAT] → CLOSED; patron panelinde fark uyarısı belirir
   Patron inceleyip [MUTABAKAT TAMAM] işaretler → RECONCILED
```
Kart ödemeleri **personel tarafından elle kaydedilir**; sistemde POS entegrasyonu
yoktur ve arayüzde "POS'tan otomatik geldi" gibi hiçbir ifade kullanılmaz.
Kart satırları "elle kaydedilen kart tahsilatı" olarak etiketlenir.

## 4.10 Mobil tasarım kuralları (uygulanacak ölçüler)

| Öğe | Değer |
|---|---|
| Birincil buton yüksekliği | 64 px (ana işlemler), 56 px (ikincil) |
| Minimum dokunma hedefi | 48 × 48 px |
| Taban yazı boyutu | 16 px; sayısal tutarlar 32–44 px |
| Plaka yazı tipi | mono, 28 px, harf aralığı geniş |
| Kenar boşluğu | 16 px |
| Alt gezinme | 56 px + güvenli alan dolgusu |
| Renkler | Lacivert `#0B2447` · Mavi `#19A7CE` · Beyaz · Başarı `#15803D` · Uyarı `#B45309` · Hata `#B91C1C` |
| Kontrast | Tüm metinlerde en az WCAG AA (4.5:1) |
| Animasyon | Yalnızca 150–200 ms geçişler; gereksiz efekt yok |
| Yatay kaydırma | **Hiçbir ekranda yok** |
