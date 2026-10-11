# Vercel + Supabase ile Yayına Alma

Bu rehber, sistemi ücretsiz olarak Vercel (uygulama) + Supabase (veritabanı)
üzerinde yayına almayı anlatır.

## Neden ücretsiz çalışır

| Servis | Ücretsiz kota | Bu sistem için yeterli mi |
|---|---|---|
| Vercel | 100 GB bant genişliği, sınırsız deploy | ✅ Küçük işletme için fazlasıyla |
| Supabase | 500 MB veritabanı, 2 proje | ✅ Yıllarca yetecek kapasite |

---

## Adım 1 — Supabase veritabanı

1. **supabase.com** → "Start your project" → GitHub ile giriş yap
2. "New project" → proje adı: `otopark` → güçlü bir şifre belirle → bölge:
   **Frankfurt (eu-central-1)** (Türkiye'ye en yakın ücretsiz bölge)
3. Proje hazır olduktan sonra (1–2 dk) sol menüden **Settings → Database** aç
4. "Connection string" bölümünde **iki URL kopyala:**

   - **Transaction pooler** (Mode: Transaction, Port 6543) →
     `DATABASE_URL` olarak kullanılacak  
   - **Session pooler veya Direct connection** (Port 5432) →
     `DIRECT_URL` olarak kullanılacak

   Her iki URL'deki `[YOUR-PASSWORD]` yerine az önce belirlediğin şifreyi yaz.

---

## Adım 2 — Supabase'e migration çalıştır

Supabase projen hazır olunca **SQL Editor** açılır. Aşağıdaki komutu
kendi makinende çalıştırman gerekiyor (veya bu konteynerden):

```bash
# DIRECT_URL'yi kullan (migration için doğrudan bağlantı)
DATABASE_URL="postgresql://postgres.[proje-ref]:[sifre]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  npx prisma migrate deploy

# Başlangıç verilerini yükle
DATABASE_URL="..." npm run db:seed
DATABASE_URL="..." npm run fiyatlar:kur
DATABASE_URL="..." npm run isletme:kur
```

---

## Adım 3 — Vercel uygulaması

1. **vercel.com** → "Add New Project" → GitHub ile giriş yap
2. **ayzenith/otopark** deposunu seç → "Import"
3. Framework: **Next.js** (otomatik algılanır)
4. **Environment Variables** bölümüne şunları ekle:

```
DATABASE_URL        = [Supabase transaction pooler URL — port 6543]
DIRECT_URL          = [Supabase direct URL — port 5432]
AUTH_SECRET         = [openssl rand -base64 32 ile üret]
NEXT_PUBLIC_SITE_URL = https://londracampingtandircioglu.com
AUTH_URL            = https://londracampingtandircioglu.com
OWNER_USERNAME      = patron
OWNER_FULLNAME      = İşletme Sahibi
```

5. "Deploy" → ilk deploy 2–3 dakika sürer.

---

## Adım 4 — Alan adını Vercel'e bağla

1. Vercel'de projeye gir → **Settings → Domains**
2. `londracampingtandircioglu.com` yaz → Add
3. Vercel sana iki DNS kaydı gösterir:
   ```
   A     @      76.76.21.21
   CNAME  www   cname.vercel-dns.com
   ```
4. Turhost DNS yönetimini aç → bu iki kaydı ekle
5. SSL otomatik, 10–15 dakika içinde aktif.

---

## Adım 5 — robots.txt kilidi kaldır

Site yayına girince `src/app/(site)/layout.tsx` dosyasında:

```ts
robots: { index: false, follow: false },
```

satırını sil veya `{ index: true, follow: true }` yap.

---

## Sonraki yayınlar

Depoya her `push` → Vercel otomatik deploy yapar. Kodda değişiklik yapınca
otomatik güncellenir, elle yapılacak bir şey yok.

---

## Notlar

- Vercel sunucusuz (serverless) çalışır — bu nedenle `schema.prisma`'da
  `binaryTargets` ve `directUrl` eklendi (11.10.2026).
- Supabase ücretsiz projeler 7 gün hareketsiz kalırsa **dondurulur**; aktif
  kullanımda bu olmaz ama uzun tatillerde dikkat et.
- Yedek: Supabase Dashboard → Settings → Database → "Backups" bölümü.
  Ücretsiz planda günlük yedek 7 gün tutulur.
