# İşletim Kılavuzu (Runbook)

Bu dosya sunucu kurulumu, güncelleme, yedekleme ve **geri alma** adımlarını
içerir. Aşama 1 itibarıyla kurulum ve yedekleme bölümleri hazırdır; canlıya
alma Aşama 8'de gerçek sunucuda doğrulanacak.

---

## 1. Yerel geliştirme ortamı

### 1.1 Gereksinimler
- Node.js 22+
- Docker ve Docker Compose (veya yerel PostgreSQL 16)

### 1.2 Kurulum

```bash
npm install
cp .env.example .env
```

`.env` içinde en az şunları doldurun:

```bash
DATABASE_URL="postgresql://postgres:POSTGRES_PAROLASI@localhost:5432/otopark?schema=public"
DATABASE_URL_TEST="postgresql://postgres:POSTGRES_PAROLASI@localhost:5432/otopark_test?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"
```

### 1.3 Veritabanı

Docker ile hızlı bir PostgreSQL:

```bash
docker run -d --name otopark-pg \
  -e POSTGRES_PASSWORD=gelistirme \
  -e POSTGRES_DB=otopark \
  -p 5432:5432 postgres:16-alpine

# Test veritabanını da oluşturun
docker exec otopark-pg psql -U postgres -c "CREATE DATABASE otopark_test;"
```

Şemayı uygulayın ve başlangıç verisini oluşturun:

```bash
npx prisma migrate deploy
npx prisma db seed
```

**Seed çıktısına dikkat:** başlangıç parolası yalnızca bu ekranda bir kez
gösterilir ve hiçbir dosyaya kaydedilmez. Not alın.

### 1.4 Çalıştırma

```bash
npm run dev          # http://localhost:3000
```

### 1.5 Testler

```bash
npm run test              # birim testleri (veritabanı gerektirmez)
npm run test:integration  # entegrasyon testleri (test veritabanı gerekir)
npm run build             # derleme
npm run test:e2e          # uçtan uca (derleme sonrası)
npm run typecheck         # tip kontrolü
npm run lint              # lint
```

---

## 2. Sunucu kurulumu (canlı)

### 2.1 Sunucu hazırlığı

```bash
# Güncelleme
apt update && apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sh

# Güvenlik duvarı: yalnızca SSH, HTTP, HTTPS
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Parola ile SSH girişini kapatın (anahtar kullanın)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### 2.2 Alan adı

Alan adının DNS `A` kaydını sunucunun IP adresine yönlendirin. Caddy SSL
sertifikasını bu kayıt doğruyken otomatik alır.

### 2.3 Uygulama

```bash
git clone <depo-adresi> /opt/otopark
cd /opt/otopark/ops
cp .env.example .env
```

`.env` içindeki tüm zorunlu alanları doldurun:

```bash
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 24   # BACKUP_PASSPHRASE
```

`BACKUP_PASSPHRASE` ve `AUTH_SECRET` değerlerini **güvenli bir parola
yöneticisinde** saklayın. `BACKUP_PASSPHRASE` kaybolursa yedekler açılamaz.

```bash
docker compose up -d --build
docker compose logs -f app          # migration'ların uygulanmasını izleyin
```

### 2.4 İlk patron hesabı

```bash
docker compose run --rm app npx prisma db seed
```

Üretilen parolayı not alın. İlk girişte değiştirilmesi zorunludur.

### 2.5 Doğrulama

```bash
curl -I https://ALAN-ADINIZ            # 200 ve HSTS başlığı
docker compose ps                       # tüm servisler "healthy" / "running"
```

---

## 3. Güncelleme (yeni sürüm yayınlama)

```bash
cd /opt/otopark

# 1. ÖNCE YEDEK AL
docker compose -f ops/docker-compose.yml exec -T yedek /usr/local/bin/backup.sh

# 2. Mevcut sürümü not et (geri alma için)
git rev-parse --short HEAD > /root/otopark-onceki-surum.txt

# 3. Yeni sürümü al
git fetch origin
git checkout <surum-etiketi>      # örnek: v0.2.0

# 4. Yeniden derle ve başlat (migration'lar otomatik uygulanır)
cd ops && docker compose up -d --build

# 5. Doğrula
docker compose logs --tail=50 app
curl -I https://ALAN-ADINIZ
```

---

## 4. Geri alma (rollback)

Yeni sürüm sorun çıkarırsa:

```bash
cd /opt/otopark
git checkout "$(cat /root/otopark-onceki-surum.txt)"
cd ops && docker compose up -d --build
```

**Migration'lar neden geri alınmıyor?** Migration'lar geriye dönük uyumlu
yazılır (önce ekle → sonra kullan → en son kaldır), bu yüzden eski uygulama
sürümü yeni şemayla çalışabilir. Veri kaybı olmaz.

Şema gerçekten bozulduysa yedekten geri yükleme gerekir (bölüm 5.2).

---

## 5. Yedekleme

### 5.1 Yedek alma

Otomatik: `yedek` servisi günde bir kez çalışır.
Saklama: günlük 30 gün, haftalık 12 hafta, aylık 12 ay.

Elle yedek:

```bash
cd /opt/otopark/ops
docker compose exec -T yedek /usr/local/bin/backup.sh
docker compose exec yedek ls -lh /yedekler/gunluk
```

### 5.2 Geri yükleme

```bash
cd /opt/otopark/ops
docker compose exec yedek ls /yedekler/gunluk
docker compose exec -it yedek /usr/local/bin/restore.sh /yedekler/gunluk/DOSYA.sql.gz.gpg
docker compose restart app
```

Betik onay ister (`EVET` yazılmalı) ve sonunda kayıt sayılarını gösterir.

### 5.3 Yedekleri sunucu dışına kopyalama

**Bu adım zorunludur.** Sunucu kaybolursa içindeki yedek de kaybolur.

S3 uyumlu depoya kopyalama örneği (rclone ile, sunucuda bir cron kaydı olarak):

```bash
# /etc/cron.daily/otopark-yedek-kopya
#!/bin/sh
docker run --rm \
  -v otopark_yedekler:/yedekler:ro \
  -v /root/.config/rclone:/config/rclone:ro \
  rclone/rclone sync /yedekler uzak:otopark-yedekleri
```

### 5.4 Geri yükleme testi — ÜÇ AYDA BİR

> **Test edilmemiş yedek, yedek sayılmaz.**

1. Yedek dosyasını ayrı bir test veritabanına geri yükleyin.
2. Kayıt sayılarını canlıyla karşılaştırın.
3. Sonucu aşağıdaki tabloya kaydedin.

| Tarih | Kullanılan yedek | Sonuç | Yapan |
|---|---|---|---|
| _(ilk test Aşama 8'de yapılacak)_ | | | |

---

## 6. İzleme

```bash
docker compose ps                        # servis durumu
docker compose logs --tail=100 app       # uygulama kayıtları
docker compose logs --tail=100 postgres  # veritabanı kayıtları
df -h                                    # disk doluluğu
docker system df                         # Docker disk kullanımı
```

Disk dolarsa kullanılmayan imajları temizleyin: `docker system prune -a`

---

## 7. Sorun giderme

| Belirti | Kontrol |
|---|---|
| Site açılmıyor | `docker compose ps`, Caddy kayıtları, DNS `A` kaydı |
| SSL hatası | DNS kaydının doğru IP'yi gösterdiğini doğrulayın; Caddy kayıtlarına bakın |
| Giriş yapılamıyor | `AUTH_SECRET` tanımlı mı, veritabanı erişilebilir mi |
| "Oturumunuz sona ermiş" döngüsü | Sunucu saati doğru mu (`timedatectl`); çerez `secure` iken HTTPS şart |
| Hesap kilitli | 15 dakika beklenir; patron `user.manage` yetkisiyle kilidi açabilir (Aşama 6) |
| Migration hatası | `docker compose logs app`; yedekten geri yükleyip tekrar deneyin |

---

## 8. Erişim devri (teslim)

Teslimde işletme sahibine devredilecekler:

- [ ] GitHub deposu (sahiplik veya yönetici erişimi)
- [ ] Sunucu SSH erişimi
- [ ] `ops/.env` içindeki sırlar (parola yöneticisi üzerinden)
- [ ] `BACKUP_PASSPHRASE` (bu kaybolursa yedekler açılamaz)
- [ ] Dış yedek depolama hesabı
- [ ] Alan adı kayıt hesabı
- [ ] Patron paneli hesabı

Detay: `docs/08-maliyet-ve-teslim.md`
