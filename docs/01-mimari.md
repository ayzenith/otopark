# 1. Teknik Mimari

## 1.1 Özet karar

| Katman | Seçim |
|---|---|
| Çatı (framework) | **Next.js 15 (App Router)** — React Server Components + Server Actions |
| Dil | **TypeScript** (strict mode) |
| Arayüz | **Tailwind CSS 4** + küçük, kendi yazdığımız bileşen kümesi (shadcn/ui tabanlı) |
| Veritabanı | **PostgreSQL 16** |
| ORM | **Prisma** |
| Kimlik doğrulama | **Auth.js (NextAuth v5)** — Credentials sağlayıcı, veritabanı oturumu (DB session) |
| Parola | **Argon2id** (`@node-rs/argon2`) |
| Doğrulama | **Zod** — aynı şema hem istemcide hem sunucuda |
| Form | **react-hook-form** + Zod resolver |
| Tablo/filtre | **TanStack Table** (sadece masaüstü yoğun tablolarda) |
| Grafik | **Recharts** |
| Test | **Vitest** (birim/iş kuralı), **Playwright** (uçtan uca + mobil viewport) |
| Dağıtım | Docker Compose ile tek VPS (Hetzner/DigitalOcean), Caddy ile otomatik SSL |
| Yedekleme | `pg_dump` + şifreli nesne depolama (S3 uyumlu), günlük + haftalık |

Tüm arayüz **Türkçe**; tarih/saat `Europe/Istanbul`, para `tr-TR` + `TRY`, plaka Türkiye formatında.

## 1.2 Neden bu mimari — gerekçeler

**Next.js + Server Actions.** Projenin kritik gereksinimi şu: *"Kullanıcı yetkilerini
hem arayüzde hem sunucuda uygula"* ve *"önemli işlemleri sunucu tarafında doğrula"*.
Server Actions ile her yazma işlemi (araç girişi, çıkış tahsilatı, tarife değişikliği)
sunucuda çalışan tek bir fonksiyona iner; yetki kontrolü ve Zod doğrulaması o
fonksiyonun ilk iki satırıdır. İstemciden gönderilen tutar, süre veya fiyat **asla**
kabul edilmez — ücret her zaman sunucuda yeniden hesaplanır. Ayrı bir REST/GraphQL API
katmanı yazma, sözleşme senkronizasyonu ve iki kez doğrulama yükü ortadan kalkar.

**Tek uygulama, iki yüz.** Kurumsal web sitesi ile yönetim paneli aynı Next.js
projesinde ama ayrı route group'larda yaşar: `(public)` ve `(panel)`. Böylece
web sitesindeki fiyat listesi, hizmetler ve iletişim bilgileri panelden düzenlenebilir
(tek veritabanı), fakat panel verisi public tarafa sızmaz — `(public)` altındaki
sayfalar yalnızca `isPublic = true` işaretli, beyaz listeye alınmış alanları okur.
Ayrı iki proje olsaydı fiyat senkronizasyonu için ek entegrasyon gerekirdi.

**PostgreSQL.** Para ve süre hesabı var; `NUMERIC(12,2)` ile kuruş hatası olmaz
(float kullanılmayacak). İşlemsel bütünlük (transaction) şart: araç çıkışı +
ödeme kaydı + kasa hareketi + denetim kaydı **tek transaction**'da yazılır. Ayrıca
`TIMESTAMPTZ`, kısmi tekil indeks (aynı plakadan ikinci aktif giriş engelleme) ve
`GENERATED` kolonlar gibi ihtiyacımız olan özellikler var.

**Prisma.** Şema tek dosyada okunur, migration'lar sürümlenir (geri alma prosedürü
için kritik), tip güvenliği uçtan uca. Prisma'nın karmaşık rapor sorgularında
yetersiz kaldığı yerde `$queryRaw` ile elle yazılmış SQL kullanılacak (finansal
özetler, dönem karşılaştırmaları).

**Auth.js + Credentials + DB session.** Kullanıcı adı/parola isteniyor, dış kimlik
sağlayıcı istenmiyor. JWT yerine **veritabanı oturumu** seçildi: patron bir personelin
hesabını devre dışı bıraktığında oturumu **anında** düşmeli. JWT ile token süresi
bitene kadar erişim sürerdi — kasa ve tahsilat yetkisi olan bir sistemde bu kabul
edilemez.

## 1.3 Değerlendirilen alternatifler ve neden seçilmedi

| Alternatif | Neden seçilmedi |
|---|---|
| **Ayrı backend (NestJS/Express) + React SPA** | İki ayrı dağıtım, iki ayrı yetki katmanı, API sözleşme bakımı. Tek işletme için gereksiz karmaşıklık ve daha yüksek 1 yıllık destek maliyeti. |
| **Supabase / Firebase (BaaS)** | Veri işletme sahibinin kontrolünde olmalı (teslim yapısı gereği) ve KVKK açısından veri yeri önemli. İş kuralları (tarife hesabı, abonman kesişimi) satır-seviyesi güvenlik kurallarıyla ifade edilmesi zor; ayrıca kullanım arttıkça süregelen maliyet. |
| **MySQL / MariaDB** | Olurdu, ama `NUMERIC` + `TIMESTAMPTZ` + kısmi indeks konforu ve rapor sorguları (window function, `FILTER`) PostgreSQL'de daha temiz. |
| **Drizzle ORM** | Prisma'ya göre daha hafif ama migration ve tooling olgunluğu bir yıllık destek sürecinde Prisma'da daha güvenli. |
| **React Native / yerel mobil uygulama** | Personel telefonundan kullanacak, ama **PWA yeterli**: app store süreci yok, güncelleme anında, tek kod tabanı. Ana ekrana eklenebilir, çevrimdışı önbellek eklenebilir. Donanım entegrasyonu (bariyer, plaka okuma kamerası) gerekirse ayrı kapsam. |
| **Vercel (barındırma)** | Kolay, ama veritabanı ayrı servis olur (ek maliyet + veri dışarıda). Tek VPS'te Postgres + uygulama + yedek, işletmenin kontrolünde ve ucuz. Vercel yine de bir seçenek olarak açık bırakılıyor (bkz. doküman 08). |

## 1.4 Mobil öncelikli uygulama kararları

- Tüm ekranlar **375 px genişlikte** tasarlanır, sonra masaüstüne genişletilir.
- Dokunma hedefi **minimum 48×48 px**; birincil işlem butonları **56 px yükseklik**.
- Taban yazı boyutu **16 px** (iOS'ta otomatik yakınlaştırmayı önler).
- Mobilde **tablo yok** → kart listesi. Yatay kaydırma hiçbir ekranda olmayacak.
- Plaka girişi `inputMode="text"` + `autoCapitalize="characters"` + `autoCorrect="off"`.
- Personel alt gezinme çubuğu **en fazla 4 sekme**: Ana ekran · Aktif araçlar · Yıkama · Diğer.
- Birincil işlemler ekranın alt yarısında (başparmak erişimi).
- Her kritik işlem sonrası tam ekran, renk kodlu onay (yeşil: tahsil edildi, mavi: giriş alındı).
- Yavaş hatta karşı: işlem butonları bastıktan sonra kilitlenir (çift kayıt engeli) ve
  her işlem bir **idempotency anahtarı** ile gönderilir.

## 1.5 Klasör yapısı

```
otopark/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                  # ilk patron hesabı + örnek tarife iskeleti
├─ src/
│  ├─ app/
│  │  ├─ (public)/             # KURUMSAL WEB SİTESİ
│  │  │  ├─ page.tsx           # ana sayfa
│  │  │  ├─ hizmetler/
│  │  │  ├─ abonman/
│  │  │  ├─ oto-yikama/
│  │  │  ├─ galeri/
│  │  │  ├─ iletisim/
│  │  │  └─ sss/
│  │  ├─ (auth)/giris/
│  │  ├─ (panel)/
│  │  │  ├─ layout.tsx         # oturum + rol kontrolü (sunucu tarafı)
│  │  │  ├─ vardiya/           # PERSONEL: mobil ana ekran (varsayılan)
│  │  │  ├─ araclar/           # aktif araçlar, geçmiş
│  │  │  ├─ yikama/
│  │  │  ├─ abonmanlar/
│  │  │  ├─ musteriler/
│  │  │  ├─ kasa/
│  │  │  ├─ yonetim/           # PATRON: panel, finans, raporlar
│  │  │  │  ├─ page.tsx        # yönetici ana paneli
│  │  │  │  ├─ finans/
│  │  │  │  ├─ raporlar/
│  │  │  │  ├─ personel/
│  │  │  │  ├─ ayarlar/        # tarifeler, yıkama fiyatları, site içeriği
│  │  │  │  └─ denetim/        # audit log
│  │  │  └─ sitemap.ts, robots.ts
│  │  └─ api/                  # yalnızca webhook/cron/health uçları
│  ├─ server/                  # ★ İŞ MANTIĞI — tek doğruluk kaynağı
│  │  ├─ auth/                 # oturum, parola, izin kontrolü
│  │  ├─ parking/              # giriş, çıkış, ücret hesaplama motoru
│  │  ├─ pricing/              # tarife çözümleme (saf fonksiyonlar, test edilir)
│  │  ├─ subscription/         # abonman çözümleme
│  │  ├─ carwash/
│  │  ├─ cash/                 # kasa açılış/kapanış, vardiya
│  │  ├─ finance/              # gelir/gider, raporlar
│  │  ├─ audit/                # denetim kaydı yazıcı
│  │  └─ actions/              # Server Actions (ince kabuk: yetki + Zod + çağrı)
│  ├─ components/
│  │  ├─ ui/                   # buton, kart, sheet, alert, input
│  │  └─ panel/                # PlakaInput, AracKarti, TahsilatSheet, ...
│  ├─ lib/
│  │  ├─ plate.ts              # plaka normalizasyonu + doğrulama
│  │  ├─ money.ts              # Decimal yardımcıları, TRY biçimleme
│  │  ├─ datetime.ts           # Europe/Istanbul, süre biçimleme
│  │  └─ permissions.ts        # izin sabitleri ve kontrol fonksiyonu
│  └─ types/
├─ tests/
│  ├─ unit/                    # ücret hesaplama, abonman çözümleme, kasa
│  └─ e2e/                     # Playwright: mobil akışlar
├─ docs/
├─ ops/
│  ├─ docker-compose.yml
│  ├─ Caddyfile
│  ├─ backup.sh / restore.sh
│  └─ RUNBOOK.md               # dağıtım, yedek, geri alma adımları
└─ .github/workflows/ci.yml    # lint + typecheck + test + migration kontrolü
```

**Kural:** `src/app` altındaki hiçbir dosya veritabanına doğrudan yazmaz.
Her yazma `src/server/**` içindeki bir servis fonksiyonundan geçer; o fonksiyon
izin kontrolü, doğrulama, transaction ve denetim kaydından sorumludur.

## 1.6 Güvenlik tasarımı (özet; detay doküman 03 ve 06)

- Argon2id parola; ilk girişte parola değiştirme zorunluluğu; minimum 10 karakter.
- Veritabanı oturumu, `httpOnly` + `secure` + `sameSite=lax` çerez, 12 saat hareketsizlik sonrası düşme.
- Giriş denemesi sınırı: IP + kullanıcı adı başına 5 hatalı denemede 15 dakika kilit.
- Her Server Action: `requirePermission(...)` → `zod.parse(...)` → iş mantığı → `audit(...)`.
- Finansal kayıt **silinemez** (DB seviyesinde: uygulama kullanıcısına `DELETE` yetkisi
  verilmez; düzeltme ters kayıt/iptal ile yapılır).
- Tüm parasal ve zamansal değerler sunucuda hesaplanır; istemci girdisi yalnızca
  "hangi araç, hangi hizmet, hangi ödeme yöntemi" bilgisidir.
- KVKK: toplanan kişisel veri en aza indirilir (ad, telefon, plaka). Aydınlatma metni,
  saklama süresi ve silme/anonimleştirme prosedürü doküman 06'da.
