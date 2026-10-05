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

## Durum (05.10.2026)

| Aşama | Kapsam | Durum |
|---|---|---|
| 0 | Mimari, veri modeli, plan dokümanları | ✅ |
| 1 | Altyapı, DB, kimlik doğrulama, yetki, denetim kaydı, mobil kabuk | ✅ |
| 2 | Tarife sistemi, ücret motoru, araç giriş-çıkış, tahsilat | ✅ |
| 3 | Müşteriler, abonmanlar, dönem/yenileme, abonman tahsilatı | ✅ |
| 4 | Oto yıkama | ✅ |
| 5 | Kasa, gelir-gider, malzeme stoğu, CSV dışa aktarma | ✅ |
| 6 | Personel yönetimi, avans/maaş, patron paneli, uyarı merkezi, denetim ekranı | ✅ |
| 7 | Kurumsal web sitesi (iskelet + panelden içerik yönetimi) | ✅ |
| **8** | **SIRADAKİ:** devreye alma, gerçek cihaz testleri | ⏳ |

**1146 test geçiyor**, başarısız yok: 314 birim + 463 entegrasyon + 369 E2E
(3 ekran boyutu). Her aşamada önce mevcut testleri çalıştır, sonra yenileri
ekle, sonra hepsini tekrar çalıştır.

Taşınmayan işler (docs/06 sonunda tam liste): XLSX/PDF dışa aktarma
(bağımlılık onayı bekliyor), stok değerlemesi, prim sistemi (karar gereği
yok), KVKK otomasyonu (ertelendi), çoklu POS (karar gereği yok), grafiklerin
zenginleştirilmesi, personel maliyetlerinin otomatik gider üretmesi.

**Son commit:** Aşama 7 (kurumsal site iskeleti) tamamlandı ve push edildi.
`main` dalı hâlâ 0 commit, dokunulmadı.

## Site için 05.10.2026'da VERİLEN bilgiler (uydurma değil, sahibinden)

`npm run isletme:kur` bunları veritabanına **veri olarak** yazar (idempotent,
dolu alanı ezmez). Kaynak: işletme sahibi, 05.10.2026.

| Alan | Değer |
|---|---|
| WhatsApp | `0555 056 79 79` → `wa.me/905550567979` |
| Google Maps | `https://maps.app.goo.gl/rLR4CvWx5VsCNLr5A` |
| Çalışma saatleri | **7/24 AÇIK** — sahibi "bu bilgi kesin olsun, çok önemli" dedi |
| Hizmetler | Otopark + oto yıkama (ana sayfada madde listesi) |
| Sitede fiyat | **YAZILMAYACAK** (S19 kapandı). Fiyat satırı girilmediği sürece bölüm çizilmez |
| Ana eylem (CTA) | Ana sayfada ve iletişimde büyük **YOL TARİFİ AL** butonu; telefonda Maps uygulamasını açar |

**HÂLÂ VERİLMEYEN — VARSAYMA:**
- **Açık adres metni** (yalnızca harita bağlantısı var)
- **Arama için telefon.** Verilen numara WhatsApp olarak bildirildi; aynı
  numaradan arama alınıp alınmadığı TEYİT EDİLMEDİ. `phone` boş; sitede arama
  butonu çıkmıyor. Teyit gelince panelden girilir
- Instagram · logo · fotoğraflar · işletmenin tam ticari unvanı

## ⚠️ AŞAMA 8 ÖNCESİ SORULACAKLAR

1. **S17 — Barındırma (05.10.2026):** sahibi "Turhost'tan alan adı + hosting
   alacağım, ayzenith.com gibi" dedi. **UYARI: Turhost'un PAYLAŞIMLI HOSTING
   paketleri bu sistemi ÇALIŞTIRAMAZ** — Next.js (Node.js) + PostgreSQL
   gerekiyor, paylaşımlı paketler PHP/MySQL'dir. **VPS/sunucu paketi**
   alınmalı. Bu kullanıcıya bildirildi; alan adı henüz alınmadı
2. **S18 — kalan künye alanları:** yukarıdaki "hâlâ verilmeyen" listesi
3. **S20 — Teslim ve erişim:** depo/sunucu/yedek kimde olacak?
4. **S12 — KVKK saklama süresi** · **XLSX/PDF için bağımlılık onayı**

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

### Karavan (fiyatı 04.10.2026'da karara bağlandı)
Normal otopark tarifesinin **DIŞINDA**
(`VehicleClass.excludeFromStandardTariff = true`). Tarife çözümleyici bu
sınıfta genel kurala **düşmez**; yalnızca karavana özel kural geçerlidir.

**Karavan tarifesi: 24 saate kadar 700 ₺, 24 saatten sonra başlayan her
24 saat +700 ₺.** (24 sa = 700 · 24 sa 1 dk = 1.400 · 48 sa = 1.400 ·
48 sa 1 dk = 2.100.)

Motor karşılığı: ilk blok **1440 dk / 700 ₺**, saatlik ücret **yok**,
günlük üst limit 700 ₺, `extraDayBlockPrice` 700 ₺.

> İşletme yalnızca 24 saatlik fiyatı verdi; **karavan için saatlik kademe
> VERİLMEDİ ve UYDURULMADI.** Bu yüzden 1 saatlik karavan parkı da 700 ₺'dir.
> Patron saatlik kademe isterse panelden girer.

Karavan kuralı silinirse ücret hesaplanmaz ve personele açık uyarı çıkar —
sessizce otomobil fiyatı uygulanmaz (testli).
**Karavan YIKAMA ücreti hâlâ belirlenmedi.**

### Otopark kapasitesi (S3, 04.10.2026)
**SINIR YOK.** `totalCapacity = 0` bırakıldı ("tanımlı değil"): doluluk
hesaplanmaz, kapasite çubuğu çizilmez, giriş **hiçbir zaman** engellenmez.
Kapasite mantığı koddan kaldırılmadı; patron bir sayı girerse kendiliğinden
devreye girer. **Aktif etme.**

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

### Personel, roller ve vardiya (05.10.2026 — S14/S15/S16)
- **Gerçek personel adları seed'e YAZILMAZ.** Hesaplar patron panelinden
  açılır (Yönetim → Personel). Seed yalnızca tek patron hesabı üretir.
  Test personeli ayrı fixture (`e2e_personel`).
- **Roller: PATRON + PERSONEL.** `MANAGER` aktif edilmedi; enum ve izin taban
  kümesi altyapıda duruyor, arayüzden **seçilemez**. Silme/kaldırma yapma.
- **Kasa kapatma:** patron + `cash.drawer.close` izni kullanıcı bazında
  verilen personel (`UserPermission`). STAFF taban kümesinde YOK.
- **Tek vardiya zorunluluğu yok;** personel kendi vardiyasını açıp kapatır.
  Aynı anda yalnızca **bir açık KASA** olabilir (DB kısmi unique indeks).
  **Vardiya saatleri işletme ayarından yönetilir** ama ZORLAYICI DEĞİLDİR —
  yalnızca bilgi/rapor etiketi.
- **Yıkamayı personel yapıyor; PRİM/YÜZDE YOK.** Prim altyapısı eklenmedi.
- **Personel avansı GİDER DEĞİL**, maaştan düşülecek **alacak**. Kasadan çıkar
  (nakit azalır) ama gider raporuna girmez; maaş ödemesinde mahsup edilir.
  `AVANS` gider kategorisi bu yüzden kullanım dışıdır — elle gider olarak
  girilirse çifte sayım olur.
- **Maaş/SGK/yemek** tutulabilir, **yalnızca patron görür**
  (`personnel.cost.view`; alan bazlı kısıt — izin yoksa sorgulanmaz bile).
- **Tek POS + nakit, taksit YOK.** Çoklu POS ileride genişletilebilir
  (`PosTerminal` + `Payment.posTerminalId`); şimdi eklenmedi.
- **KVKK saklama/anonimleştirme otomasyonu ERTELENDİ** (S12). Saklama süresi
  belirlenmedi, varsayma. Aşama 8'de tekrar sor.

### Hâlâ belirlenmeyen (VARSAYMA, sor)
Motor yıkama ücreti · diğer yıkama hizmetleri (iç temizlik, pasta cila…) ·
karavan **yıkama** ücreti · S12, S14–S20.

İşletme 04.10.2026'da bu kalemler için **"şu an uydurma, panelden sonradan
girilebilir bırak"** dedi. Fiyatsız hizmet 0 ₺'ye çevrilmez; personel
ekranında "fiyat girilmemiş" uyarısı çıkar (mimari kural 10).

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
    Aşama 2'de yaşanan gerçek hata. **Zod doğrulama mesajları da gösterilir**
    (alan adı + Türkçe mesaj); Aşama 5'te bunun eksik olduğu bulundu.
13. **Beklenen nakit personele SAYIMDAN ÖNCE gösterilmez.** Ekranda yazarsa
    personel saymadan o rakamı yazar ve kasa farkı hiç ortaya çıkmaz.
14. **Nakit gider kasadan BİR KEZ düşer.** Gider için ayrıca kasa hareketi
    ÜRETİLMEZ; beklenen nakit hesabı gidere bağlı hareketleri toplamaz.
    (Kural 5'teki çifte muhasebe tuzağının kasa karşılığı.)
15. **Yön işaretli tutarla taşınmaz.** Kasada `direction`, stokta `type`
    belirler; tutar/miktar her zaman pozitiftir. "-500" satırı hesabı
    sessizce ters çevirebilir.
16. **Stok negatife düşmez** (uygulama + DB CHECK). Stok defteri de
    silinmez; düzeltme ters yönde hareketle yapılır.
17. **`"use server"` dosyası YALNIZCA async fonksiyon ihraç eder.** Şema,
    sabit, tip dışı bir değer ihraç etmek derlemede yakalanmaz ama **çalışma
    anında sayfayı çökertir** (Aşama 6'da yaşandı). Paylaşılan şemaları
    ayrı dosyaya koy.
18. **Kalıcı onay sunucudan okunur.** `revalidatePath` çağıran bir işlemden
    sonra istemcide tutulan özet kartı yok olur (kasa kapanışında personel
    farkı göremedi). React 19'da `<form action={fn}>` formu da SIFIRLAR;
    hata sonrası değer kaybetmemesi gereken formlar kontrollü olmalı.

19. **Site hiçbir şey uydurmaz.** Girilmemiş adres/telefon/saat/fiyat için yer
    tutucu metin yazılmaz; o bölüm hiç çizilmez ve patron panelinde "eksik
    bilgi" olarak listelenir. Sitedeki fiyat SERBEST METİNDİR ve tarife
    motorundan otomatik akmaz — kural 11'in site karşılığı.

## Kod haritası

```
src/lib/           money.ts (kuruş) · datetime.ts (Europe/Istanbul) ·
                   plate.ts (normalize/doğrula/biçimle) · permissions.ts (53 izin)
src/server/auth/   password (Argon2id) · session (özel DB oturum katmanı,
                   Auth.js sapması docs/01 §1.3.1) · login · authz
src/server/pricing/ types.ts (Zod snapshot, sürüm 2) · calculate.ts (SAF
                   fonksiyon, DB/now/rastgele YOK) · resolve.ts · admin.ts
src/server/parking/ entry · exit · void · queries · codes
src/server/subscription/ rules.ts (saf kural motoru) · customer · manage ·
                   payment · queries · resolve
src/server/wash/   pricing · admin · job · payment · queries
src/server/cash/   drawer.ts (aç/say/kapat, beklenen nakit) · movement.ts ·
                   queries.ts · codes.ts (G-, D- fiş kodları)
src/server/finance/ expense.ts · income.ts · queries.ts (gelir-gider raporu) ·
                   export.ts (CSV, tr-TR)
src/server/inventory/ items.ts (malzeme kartı) · movement.ts (stok defteri) ·
                   queries.ts
src/server/staff/  users.ts (hesap, izin sapmaları, maliyet profili) ·
                   advance.ts (avans = ALACAK, maaş mahsubu)
src/server/reports/ range.ts (dönem aralığı, SAF) · dashboard.ts (panel,
                   trend, personel tahsilatı) · alerts.ts (uyarı merkezi) ·
                   audit-query.ts (denetim filtreleri)
src/server/settings/ shift-windows.ts (vardiya pencereleri, ZORLAYICI DEĞİL) ·
                   business.ts (işletme künyesi; site bundan okur)
src/server/site/   queries.ts (public okuma + eksik bilgi listesi) ·
                   admin.ts (sayfa/fiyat/galeri yazma, denetim kaydı)
src/server/actions/ ince kabuk: yetki + Zod + servis çağrısı
src/components/panel/ islem-paneli.tsx (7 adımlık park akışı) ·
                   yikama-paneli.tsx · abonman-karti.tsx · kasa-paneli.tsx ·
                   rapor-araclari.tsx (dönem filtresi, SVG trend, denetim)
src/app/(site)/    kurumsal site: ana sayfa · fiyatlar · iletisim (oturum YOK)
src/app/manifest.ts  ana ekrana ekleme (PWA); ikon GEÇİCİ
src/app/(panel)/   vardiya · araclar · yikama · abonmanlar · musteriler ·
                   abonmanli-araclar · tarife · kasa · stok · yonetim/**
                   (yonetim/finans · yonetim/finans/giderler ·
                    yonetim/finans/csv (route handler) · yonetim/kasa ·
                    yonetim/personel[/id] · yonetim/denetim · yonetim/site ·
                    yonetim/raporlar/personel)
scripts/baslangic-fiyatlari.ts   fiyatları DB'ye yazar (idempotent)
```

## Komutlar

```bash
npm run typecheck && npm run lint && npm run build
npm run test              # birim (314)
npm run test:integration  # entegrasyon, gerçek PostgreSQL (463)
npm run test:e2e          # Playwright, 3 ekran boyutu (369)
npm run isletme:kur       # işletme künyesi başlangıç değerleri (idempotent)
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
- `StaffAdvance` de temizlik listesinde (Aşama 6).
- `VehicleClass` **ve `ExpenseCategory`** de temizlenir; aksi halde bir testte
  eklenen araç tipi / gider kategorisi sonraki koşuda "kod zaten kullanılıyor"
  verir ve **tüm dosyayı** düşürür (ikincisi Aşama 5'te yaşandı).
- E2E'de **tek açık kasa** kuralı var: kasayı açan test onu KAPATARAK bitmeli,
  yoksa sonraki proje kasayı açamaz. `global-setup` kalan açık kasaları kapatır.
- Türkçe büyük/küçük harf: PostgreSQL'in `mode: "insensitive"` karşılaştırması
  **I/ı ve İ/i çifti için doğru çalışmaz** ("Deterjanı" ≠ "DETERJANI").
  Tekillik kontrolü `toLocaleLowerCase("tr-TR")` ile uygulamada yapılır.
- Zod 4: `z.union([..., z.undefined()])` nesne doğrulamasında **eksik anahtarı
  kabul etmez**; alanın kendisi `.optional()` olmalı. Formdan gelmeyen alanlar
  yüzünden tüm işlem reddedilir.
- `selectOption({ label: ... })` **RegExp kabul etmez**; seçeneğin `value`
  değerini okuyup onu geç. (Aşama 5 ve 6'da iki kez yaşandı.)
- **Aynı testte iki kez giriş yapılamaz:** giriş yapılmış oturumda `/giris`
  sayfası `/vardiya`'ya yönlendirir. Farklı rolü test edeceksen AYRI
  `describe` + kendi `beforeEach`'i kullan.
- Aynı metin iki kartta geçiyorsa `.first()` yanlış kartı seçer; **iki filtre
  birlikte** kullan (`filter({hasText: ad}).filter({hasText: rozet})`).
- E2E personel hesapları `e2e_p` önekiyle açılır; global-setup bunları
  temizler. `e2e_personel` ve `e2e_patron` fixture'ları KORUNUR.
- Ekranda tr-TR biçimli sayı varsa testte metni ayrıştırma; makine okunur
  `data-*` değeri ekle (stok için `data-stok`).
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
`06` 8 aşamalı plan + test sayıları + **bulunan hatalar (aşama aşama)** ·
`07` **açık sorular (hangisi karara bağlandı, hangisi değil)** ·
`08` maliyet/teslim · `09` oto yıkama ·
`ops/RUNBOOK.md` kurulum/yedek/geri yükleme
