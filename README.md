# Londra Camping Otopark — İşletme Yönetim Sistemi

Otopark giriş-çıkış, abonman, oto yıkama, kasa, gelir-gider ve kurumsal web
sitesini tek platformda birleştiren, **mobil öncelikli** işletme yönetim yazılımı.

**Durum: Aşama 4 tamamlandı** (04.10.2026)

| Aşama | Kapsam | Durum |
|---|---|---|
| 0 | Mimari, veri modeli, geliştirme planı dokümanları | ✅ |
| 1 | Altyapı, veritabanı, kimlik doğrulama, yetki, denetim kaydı, mobil kabuk | ✅ |
| 2 | Tarife sistemi, ücret hesaplama motoru, araç giriş-çıkış, tahsilat | ✅ |
| 3 | Müşteriler, abonmanlar, dönem/yenileme, abonman tahsilatı, abonmanlı araçlar | ✅ |
| 4 | Oto yıkama: hizmet kataloğu, araç tipine göre fiyat, kuyruk, tahsilat, raporlar | ✅ |
| 5–8 | Kasa/finans, personel, web sitesi, devreye alma | ⏳ |

**670 test geçiyor** (191 birim · 287 entegrasyon · 192 uçtan uca ×3 ekran boyutu),
başarısız test yok. Ayrıntı: `docs/06-gelistirme-plani.md`.

**Fiyatlar koda sabitlenmemiştir.** Otopark tarifesi ve yıkama fiyatları
veritabanında sürümlü kayıt olarak tutulur ve patron panelinden değiştirilir.
İşletmenin verdiği başlangıç fiyatlarını veritabanına yazmak için:

```bash
npm run fiyatlar:kur      # mevcut fiyatları EZMEZ, yalnızca eksikleri yazar
```

**Bilinçli olarak belirlenmeyen fiyatlar** (varsayılmadı): karavan otopark
ücreti (ayrı bölüm olarak tasarlanacak), motor yıkama ücreti, diğer yıkama
hizmetleri, otopark kapasitesi. Bu kalemler girilmeden sistem çalışır; ücret
hesaplanamayan işlemlerde personele büyük uyarı çıkar ve işleme not düşülür.
Açık sorular: `docs/07-acik-sorular.md`.

## Hızlı başlangıç

```bash
npm install
cp .env.example .env          # değerleri doldurun (RUNBOOK 1.2)

# PostgreSQL 16 (Docker ile)
docker run -d --name otopark-pg -e POSTGRES_PASSWORD=gelistirme \
  -e POSTGRES_DB=otopark -p 5432:5432 postgres:16-alpine
docker exec otopark-pg psql -U postgres -c "CREATE DATABASE otopark_test;"

npx prisma migrate deploy
npx prisma db seed            # ← başlangıç parolası EKRANA bir kez yazılır, not alın
npm run dev                   # http://localhost:3000
```

Ayrıntılı kurulum, canlıya alma, yedekleme ve geri alma: **[ops/RUNBOOK.md](ops/RUNBOOK.md)**

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run lint` | ESLint |
| `npm run test` | Birim testleri (veritabanı gerekmez) |
| `npm run test:integration` | Entegrasyon testleri (test veritabanı gerekir) |
| `npm run test:e2e` | Uçtan uca testler (önce `npm run build`) |
| `npm run db:migrate` | Yeni migration oluştur |
| `npm run db:deploy` | Migration'ları uygula |
| `npm run db:seed` | Başlangıç verisi |
| `npm run db:studio` | Veritabanı görüntüleyici |

## Teknoloji

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Prisma ·
Argon2id · Zod · Vitest · Playwright · Docker Compose + Caddy

Seçim gerekçeleri ve değerlendirilen alternatifler: [docs/01-mimari.md](docs/01-mimari.md)

## Proje yapısı

```
src/
├─ app/                  Sayfalar (App Router)
│  ├─ (auth)/giris/      Giriş ekranı
│  ├─ (panel)/           Oturum gerektiren bölümler
│  │  ├─ vardiya/        ★ Personel mobil ana ekranı
│  │  ├─ araclar/        Aktif araçlar
│  │  ├─ yikama/         Oto yıkama (Aşama 4)
│  │  └─ diger/          Diğer bölümler
│  └─ parola-degistir/   Zorunlu parola değişimi
├─ server/               ★ İŞ MANTIĞI — tek doğruluk kaynağı
│  ├─ auth/              Oturum, parola, yetki kontrolü
│  ├─ audit/             Denetim kaydı yazıcı
│  ├─ actions/           Server Actions
│  └─ db.ts              Prisma istemcisi
├─ components/           Arayüz bileşenleri
└─ lib/                  Plaka, para, tarih, izinler
```

**Mimari kural:** `src/app` altındaki hiçbir dosya veritabanına doğrudan yazmaz.
Her yazma `src/server/**` içindeki bir fonksiyondan geçer; o fonksiyon izin
kontrolü, doğrulama, transaction ve denetim kaydından sorumludur.

## Dokümanlar

| Doküman | İçerik |
|---|---|
| [docs/01-mimari.md](docs/01-mimari.md) | Teknoloji seçimi, gerekçeler, alternatifler, klasör yapısı |
| [docs/02-veritabani-semasi.md](docs/02-veritabani-semasi.md) | Tablolar, ilişkiler, veri bütünlüğü kuralları |
| [docs/03-roller-yetki-matrisi.md](docs/03-roller-yetki-matrisi.md) | Roller, izin listesi, yetki matrisi |
| [docs/04-ekranlar-ve-akislar.md](docs/04-ekranlar-ve-akislar.md) | Ekran taslakları, akışlar, mobil ölçüler |
| [docs/05-tarife-ve-abonman.md](docs/05-tarife-ve-abonman.md) | **İşletmenin gerçek tarifesi**, ücret hesaplama algoritması, abonman kuralları |
| [docs/06-gelistirme-plani.md](docs/06-gelistirme-plani.md) | 8 aşama, tamamlanma kriterleri, test stratejisi |
| [docs/07-acik-sorular.md](docs/07-acik-sorular.md) | **Yanıt bekleyen işletme kuralları** |
| [docs/08-maliyet-ve-teslim.md](docs/08-maliyet-ve-teslim.md) | Maliyetler, teslim, bir yıllık destek |
| [docs/09-oto-yikama.md](docs/09-oto-yikama.md) | Oto yıkama: fiyat modeli, iş emri akışı, otoparktan ayrılığı |
| [ops/RUNBOOK.md](ops/RUNBOOK.md) | Kurulum, güncelleme, yedekleme, geri alma |

## Güvenlik

- Argon2id parola özetleme; ilk girişte parola değiştirme zorunlu
- Veritabanı oturumu: hesap devre dışı bırakıldığında oturum **anında** düşer
- Oturum jetonunun yalnızca SHA-256 özeti saklanır
- 5 hatalı denemeden sonra 15 dakika hesap kilidi
- Rol tabanlı yetkilendirme; asıl koruma **sunucu tarafında**
- Finansal kayıtlar **silinemez** (veritabanı tetikleyicisi ile zorunlu)
- Denetim kayıtları değiştirilemez (append-only, tetikleyici ile zorunlu)
- Aynı plakadan ikinci aktif giriş veritabanı seviyesinde imkânsız

## Önemli not

Gerçek işletme tarifeleri, kapasite ve yıkama fiyatları **varsayılmamıştır**.
Bu değerler boş bırakıldı ve panelden girilecek. Yanıt bekleyen sorular:
[docs/07-acik-sorular.md](docs/07-acik-sorular.md)

Finansal raporlar yönetim amaçlıdır; resmî muhasebe veya yasal bilanço yerine
geçmez.
