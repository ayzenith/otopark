# Londra Camping Otopark — Proje Hafızası

> Bu dosya her oturum başında otomatik okunur. Yeni bir oturum açıldığında
> **önce bunu oku**, sonra çalışmaya başla. Konuşma geçmişi silinse bile
> proje durumu burada.

## Proje nedir

Gerçek bir işletme için üretime çıkacak otopark + oto yıkama + abonman +
kasa yönetim sistemi. Demo değil. Türkçe arayüz, TR tarih/saat/para/plaka
biçimleri.

**En önemli tasarım kararı: MOBİL ÖNCELİKLİ.** Personel telefondan
kullanacak. Büyük butonlar (birincil 64px, ikincil 56px, minimum dokunma
hedefi 48px), en az dokunuş, küçük yazı yok, yatay kaydırmalı tablo yok,
hatada açık uyarı, başarıda net onay. Masaüstü de kusursuz çalışmalı.

**Dal:** `claude/londra-camping-parking-system-3zwfd8` — `main` dalına ASLA
dokunma (hâlâ 0 commit). Her aşama sonunda commit + push.

## Durum (04.10.2026)

| Aşama | Kapsam | Durum |
|---|---|---|
| 0 | Mimari, veri modeli, plan dokümanları | ✅ |
| 1 | Altyapı, DB, kimlik doğrulama, yetki, denetim kaydı, mobil kabuk | ✅ |
| 2 | Tarife sistemi, ücret motoru, araç giriş-çıkış, tahsilat | ✅ |
| 3 | Müşteriler, abonmanlar, dönem/yenileme, abonman tahsilatı | ✅ |
| **5** | **SIRADAKİ:** kasa, gelir-gider, **malzeme stoğu (Aşama 4'ten taşındı)** | ⏳ |
| 6 | Personel yönetimi, patron raporları | ⏳ |
| 7 | Kurumsal web sitesi | ⏳ |
| 8 | Devreye alma, gerçek cihaz testleri | ⏳ |

Aşama 4 (oto yıkama) ✅ tamamlandı. Son commit: `63caf09`.

**670 test geçiyor**, başarısız yok: 191 birim + 287 entegrasyon + 192 E2E
(3 ekran boyutu × 64). Her aşamada önce mevcut testleri çalıştır, sonra
yenileri ekle, sonra hepsini tekrar çalıştır.

## İşletme sahibinin verdiği KESİN kararlar

Bunlar karara bağlandı, tekrar sorma. Ayrıntı: `docs/05` bölüm 0 ve `docs/07`.

### Otopark tarifesi
0–1 sa **100 ₺**, sonra her saat **+50 ₺** (1–2:150, 2–3:200 … 8–9:500),
9–24 sa **500 ₺ sabit**, 24 saatten sonra **başlayan her 24 saat +600 ₺**.

Motor karşılığı: ilk blok 60 dk/100 ₺, saatlik 50 ₺ (başlayan saat tam),
günlük üst limit 500 ₺, `extraDayBlockPrice` 600 ₺.

- **Gece tarifesi YOK**, **hafta sonu farkı YOK**, **ücretsiz süre YOK**
- **Otoparkta araç sınıfına göre fiyat farkı YOK** (tek genel kural)
- Ek gün bloğu **orantılı bölünmez**: 24 sa = 500 ₺, 24 sa 1 dk = 1.100 ₺,
  48 sa = 1.100 ₺, 48 sa 1 dk = 1.700 ₺. Bu yorum kullanıcıya bildirildi,
  onay beklemedi ama itiraz da gelmedi.

### Karavan
Normal otopark tarifesinin **DIŞINDA**
(`VehicleClass.excludeFromStandardTariff = true`). Tarife çözümleyici bu
sınıfta genel kurala **düşmez**. Karavana özel kural girilene kadar çıkışta
ücret hesaplanmaz, personele açık uyarı çıkar. **Karavan fiyatı
belirlenmedi** — varsayma.

### Oto yıkama
**Araç tipine göre fiyatlandırma YALNIZCA yıkamada var.** Başlangıç:
Otomobil 600 ₺, SUV 700 ₺, Motosiklet 400 ₺ (İç Dış Yıkama).
**Motor Yıkama ücreti belirlenmedi** — hizmet fiyatsız duruyor.
**Abonmanın yıkamada indirimi YOK.**

### Abonman
- **7/24 geçerli, sınırsız giriş-çıkış** (S11)
- **Standart süre 1 AY**, şu anda tek süre seçeneği. Arayüzde bitiş +1 ay ön
  dolu. İleride süre eklemek için `SURE_SECENEKLERI` listesine satır eklemek
  yeterli
- **Fiyat müşteriye özel**, ön dolu GELMEZ. "Genel abonman fiyatı" kavramı
  sistemde yok
- Abonman oluşturmak tahsilat üretmez; tahsilat ayrı işlem, tahsil edeni
  kaydeder (S9/S10 kararları `docs/05`'te)

### Hâlâ belirlenmeyen (VARSAYMA, sor)
Karavan otopark ücreti · motor yıkama ücreti · diğer yıkama hizmetleri
(iç temizlik, pasta cila…) · otopark kapasitesi (S3) · S12, S14–S20.

## Değişmez mimari kurallar

1. **Fiyat koda sabitlenmez.** Tüm fiyatlar veritabanında sürümlü kayıt;
   patron panelinden değiştirilir. `npm run fiyatlar:kur` başlangıç
   fiyatlarını **veri olarak** yazar, mevcut fiyatları ezmez (idempotent).
2. **Tutar istemciden alınmaz.** Çıkış/tahsilat ücreti her zaman sunucuda
   yeniden hesaplanır. İstisna: indirim ve elle tutar — ikisi de izne bağlı,
   gerekçe zorunlu.
3. **Tarihsel değişmezlik.** Fiyat değişikliği eski satırı güncellemez, yeni
   sürüm açar. Üstüne her kayıt kendi anlık kopyasını taşır
   (`tariffSnapshot`, `WashJobItem.unitPrice/serviceNameSnapshot`,
   `SubscriptionPeriod.price`). Geçmiş işlem tutarı asla değişmez.
4. **Finansal kayıt SİLİNMEZ.** İptal = `VOIDED` + gerekçe. DB tetikleyicisi
   DELETE'i reddeder.
5. **İptalde çifte muhasebe tuzağı.** Para fiilen iade edildiyse orijinal
   `CONFIRMED` kalır + ters kayıt (`direction = OUT`); para el değiştirmediyse
   orijinal `VOIDED` olur, ters kayıt ÜRETİLMEZ. İkisini birlikte yapmak
   tutarı iki kez düşürür — Aşama 2'de yaşanan gerçek hata.
6. **Para kuruş tamsayı.** Float yok. DB'de `Decimal(12,2)`,
   uygulamada kuruş (`src/lib/money.ts`).
7. **Her yazma işlemi idempotency anahtarı taşır.** Personel butona iki kez
   basınca ikinci kayıt oluşmaz.
8. **Her yazma işlemi denetim kaydı üretir** (kim/ne zaman/önce/sonra).
   `AuditLog` append-only, DB tetikleyicisiyle korunur.
9. **Her Server Action'ın ilk satırı `requirePermission()`.** Arayüzdeki izin
   kontrolü yalnızca butonu gizler; güvenlik sunucuda.
10. **Fiyat tanımsızsa 0 ₺ demek DEĞİL.** `null` döner, personele büyük uyarı
    çıkar, kayda not düşer, patron panelinde uyarı sayacına girer. Sessizce
    "0 ₺ tahsil edildi" asla olmaz.
11. **Otopark ve yıkama fiyatlandırması TAMAMEN AYRI.** Ne tablo, ne kod, ne
    hesaplama paylaşırlar. Testlerle kanıtlı — bu ayrımı bozma.
12. **İş hataları kullanıcıya AYNEN gösterilir** (`IslemHatasi`). Genel
    "işlem tamamlanamadı" mesajına çevirmek arayüzü kullanılamaz yapar —
    Aşama 2'de yaşanan gerçek hata.

## Kod haritası

```
src/lib/           money.ts (kuruş) · datetime.ts (Europe/Istanbul) ·
                   plate.ts (normalize/doğrula/biçimle) · permissions.ts (52 izin)
src/server/auth/   password (Argon2id) · session (özel DB oturum katmanı,
                   Auth.js sapması docs/01 §1.3.1) · login · authz
src/server/pricing/ types.ts (Zod snapshot, sürüm 2) · calculate.ts (SAF
                   fonksiyon, DB/now/rastgele YOK) · resolve.ts · admin.ts
src/server/parking/ entry · exit · void · queries · codes
src/server/subscription/ rules.ts (saf kural motoru) · customer · manage ·
                   payment · queries · resolve
src/server/wash/   pricing · admin · job · payment · queries
src/server/actions/ ince kabuk: yetki + Zod + servis çağrısı
src/components/panel/ islem-paneli.tsx (7 adımlık park akışı) ·
                   yikama-paneli.tsx · abonman-karti.tsx
src/app/(panel)/   vardiya · araclar · yikama · abonmanlar · musteriler ·
                   abonmanli-araclar · tarife · yonetim/**
scripts/baslangic-fiyatlari.ts   fiyatları DB'ye yazar (idempotent)
```

## Komutlar

```bash
npm run typecheck && npm run lint && npm run build
npm run test              # birim (191)
npm run test:integration  # entegrasyon, gerçek PostgreSQL (287)
npm run test:e2e          # Playwright, 3 ekran boyutu (192)
npm run fiyatlar:kur      # başlangıç fiyatları (mevcut fiyatları ezmez)
npm run db:seed           # araç sınıfları, kategoriler, patron hesabı
```

## Konteyner kurulumu (yeni oturumda PostgreSQL yoksa)

Docker daemon YOK; PostgreSQL 16 apt ile kurulu, `pg_ctl` ile çalıştırılır:

```bash
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/16/main \
  -l /tmp/pg.log -o '-c config_file=/etc/postgresql/16/main/postgresql.conf \
  -c listen_addresses=127.0.0.1 -p 5432' start"
# pg_hba.conf'ta 127.0.0.1 satırlarını scram-sha-256 -> trust yap, reload et
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE otopark;" -c "CREATE DATABASE otopark_test;"
npx prisma migrate deploy
DATABASE_URL="$(grep DATABASE_URL_TEST .env|cut -d'"' -f2)" npx prisma migrate deploy
npx prisma generate && npm run db:seed && npm run fiyatlar:kur
```

Playwright: Chromium `/opt/pw-browsers/chromium`'da, `playwright.config.ts`
bunu otomatik bulur. `playwright install` ÇALIŞTIRMA. **WebKit yok** — gerçek
iOS Safari testi Aşama 8'de gerçek cihazda yapılacak.

## Migration üretimi

`prisma migrate dev` etkileşimsiz ortamda reddediyor. Bunun yerine:

```bash
mkdir -p prisma/migrations/<tarih>_<ad>
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null \
  > prisma/migrations/<tarih>_<ad>/migration.sql
# elle SQL (CHECK, tetikleyici, kısmi indeks, geri doldurma) EKLE, sonra:
npx prisma migrate deploy   # her iki veritabanına
```

Sürüklenme kontrolü: `npx prisma migrate diff ... --exit-code` → 0 olmalı.

## Test altyapısı tuzakları (hepsi yaşandı)

- `temizle()` **TRUNCATE CASCADE** kullanır, DELETE değil.
  `session_replication_role` bağlantı bazlıdır ve Prisma havuzdan başka
  bağlantı verince sessizce etkisiz kalır.
- `VehicleClass` de temizlenir; aksi halde bir testte eklenen araç tipi
  sonraki koşuda "kod zaten kullanılıyor" verir.
- E2E veritabanı **3 Playwright projesi arasında paylaşılır**. "Liste boş"
  varsayımı yapma; doğrulamayı o plakanın satırına daralt
  (`toHaveCount(0)`).
- Playwright başarısız testten sonra **işçi sürecini yeniden başlatır** ve
  modül sayacı sıfırlanır. Plaka üretimi `process.pid` tabanından türetilir.
- Fixture sürelerini **sabit metinle** doğrulama; paket uzadıkça geçen dakika
  büyür. Tutarı doğrula (bant değişmediği sürece sabit).
- `not.toContainText` var olmayan öğede başarısız olur; `toHaveCount(0)` kullan.
- Türkçe `.sort()` beklediğin sırayı vermez (İ > M). `Set` ile karşılaştır.
- Test fixture plakaları `34Z` ile başlar, müşteriler `E2E ` ile —
  global-setup bunları temizler. Gerçek veriyi asla silme.

## Çalışma şekli (kullanıcının açık talebi)

- Her aşamada çalışan kod üret, test et, **test etmeden "tamamlandı" deme**
- Önceki aşamaların çalışan özelliklerini bozma
- Aşama sonunda rapor: değişen dosyalar, yeni özellikler, test sayıları,
  başarısız testler, yapılan varsayımlar, commit hash — sonra push
- **Kesinleşmemiş işletme kuralı veya fiyat UYDURMA.** Gerekirse sor
- Bir aşama bitmeden sonrakine geçme
- Bulduğun hataları sakla değil, raporla; kök nedeni yaz
- Eksik bıraktığın işi açıkça söyle ve gerekçesini yaz

## Dokümanlar

`docs/01` mimari · `02` veri modeli · `03` yetki matrisi · `04` ekranlar ve
akışlar · `05` **tarife + abonman (gerçek fiyatlar bölüm 0'da)** ·
`06` 8 aşamalı plan + test sayıları + bulunan hatalar · `07` **açık sorular
(hangisi karara bağlandı, hangisi değil)** · `08` maliyet/teslim ·
`09` oto yıkama · `ops/RUNBOOK.md` kurulum/yedek/geri yükleme
