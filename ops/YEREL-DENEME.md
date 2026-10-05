# Sistemi kendi bilgisayarında açma

Bu dosya, sistemi **incelemek** için kendi bilgisayarında çalıştırmanı anlatır.
Gerçek sunucuya kurulum ayrı bir iştir, `RUNBOOK.md` bölüm 2'de.

> Burada üretilen veri **senin bilgisayarında** kalır, internete açılmaz.
> Dışarıdan kimse erişemez; telefonundan bakmak için aşağıdaki "Telefondan
> bakmak" bölümüne bak.

---

## A) Docker ile (önerilen — tek komut)

### 1. Docker Desktop kur
<https://www.docker.com/products/docker-desktop/> — Windows ve Mac için
ücretsiz. Kurduktan sonra **bir kez aç** ve çalışır durumda bırak
(simge yeşil/çalışıyor görünmeli).

### 2. Projeyi indir
Git kuruluysa:

```bash
git clone https://github.com/ayzenith/otopark.git
cd otopark
git checkout claude/londra-camping-parking-system-3zwfd8
```

Git yoksa: GitHub'da depo sayfasında yeşil **Code → Download ZIP** ile indir,
klasörü aç, o klasörde bir terminal (Windows'ta PowerShell) aç.

### 3. Çalıştır

```bash
docker compose -f ops/yerel-deneme.yml up -d --build
```

İlk çalıştırma **5–10 dakika** sürer (bağımlılıklar indirilir, uygulama
derlenir). Sonraki açılışlar saniyeler sürer.

### 4. Aç

Tarayıcıda: **<http://localhost:3000>**

| | |
|---|---|
| Kullanıcı adı | `patron` |
| Parola | `LondraKamp2026` |

İlk girişte parola değiştirmen istenir — bu kasıtlı, gerçek kurulumda da böyle.

### 5. Kapatma

```bash
docker compose -f ops/yerel-deneme.yml down      # durdur (veri kalır)
docker compose -f ops/yerel-deneme.yml down -v   # durdur ve veriyi de sil
```

### Güncelleme (yeni özellik geldiğinde)

```bash
git pull
docker compose -f ops/yerel-deneme.yml up -d --build
```

---

## B) Docker olmadan (Node.js + PostgreSQL kuruluysa)

Node.js 22+ ve PostgreSQL 16 kuruluysa `RUNBOOK.md` bölüm 1'i izle.
Özet:

```bash
npm install
cp .env.example .env     # DATABASE_URL ve AUTH_SECRET doldur
npx prisma migrate deploy
npm run db:seed          # patron parolası ekrana BİR KEZ yazılır, not al
npm run fiyatlar:kur
npm run dev              # http://localhost:3000
```

---

## Telefondan bakmak

Uygulama bilgisayarında çalışırken, telefon **aynı Wi-Fi ağındaysa**
bilgisayarının yerel IP adresiyle girebilirsin:

- Windows: `ipconfig` → "IPv4 Adresi" (ör. `192.168.1.25`)
- Mac: `ipconfig getifaddr en0`

Telefonda: `http://192.168.1.25:3000`

> Giriş yapamazsan sebebi `AUTH_URL`'dir: `ops/yerel-deneme.yml` içinde
> `AUTH_URL: http://localhost:3000` satırını `http://192.168.1.25:3000`
> yapıp yeniden başlat.

Bu yalnızca ev/işyeri ağı içindedir. **Her yerden erişim** ancak gerçek
sunucu + alan adı ile olur (Aşama 8).

---

## Sorun çıkarsa

| Belirti | Sebep / çözüm |
|---|---|
| `docker: command not found` | Docker Desktop kurulu değil ya da açık değil |
| `port is already allocated` | 3000 portu dolu. Başka bir uygulamayı kapat, ya da `yml` içinde `"3000:3000"` yerine `"3001:3000"` yaz, `localhost:3001`'e gir |
| Sayfa açılmıyor, "başlatılıyor" | İlk derleme sürüyor. `docker compose -f ops/yerel-deneme.yml logs -f app` ile izle |
| Parola kabul edilmiyor | Veritabanı önceden kurulmuşsa parola değişmiş olabilir. `down -v` ile sıfırla ve baştan başlat |
