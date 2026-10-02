#!/bin/sh
# ---------------------------------------------------------------------------
# Veritabani yedekleme
#
# Saklama: gunluk 30 gun, haftalik 12 hafta, aylik 12 ay (docs/08).
# Yedekler BACKUP_PASSPHRASE verildiginde GPG ile sifrelenir.
#
# ONEMLI: Yedek, sunucu disinda bir yere de kopyalanmalidir. Sunucu kaybolursa
# icindeki yedek de kaybolur. Dis kopyalama adimi ops/RUNBOOK.md'de anlatiliyor.
# ---------------------------------------------------------------------------
set -eu

YEDEK_DIZIN="${YEDEK_DIZIN:-/yedekler}"
TARIH="$(date +%Y%m%d-%H%M%S)"
GUN="$(date +%u)"   # 1-7, pazartesi=1
AYIN_GUNU="$(date +%d)"

mkdir -p "$YEDEK_DIZIN/gunluk" "$YEDEK_DIZIN/haftalik" "$YEDEK_DIZIN/aylik"

DOSYA="$YEDEK_DIZIN/gunluk/otopark-$TARIH.sql.gz"

echo "[$(date '+%F %T')] Yedek alınıyor: $DOSYA"
pg_dump --no-owner --no-privileges | gzip -9 > "$DOSYA"

# --- Sifreleme ---
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" \
      --symmetric --cipher-algo AES256 \
      --output "$DOSYA.gpg" "$DOSYA"
  rm -f "$DOSYA"
  DOSYA="$DOSYA.gpg"
  echo "[$(date '+%F %T')] Yedek şifrelendi."
else
  echo "[$(date '+%F %T')] UYARI: BACKUP_PASSPHRASE tanımlı değil, yedek ŞİFRELENMEDİ."
fi

# --- Haftalik ve aylik arsiv ---
[ "$GUN" = "7" ] && cp "$DOSYA" "$YEDEK_DIZIN/haftalik/"
[ "$AYIN_GUNU" = "01" ] && cp "$DOSYA" "$YEDEK_DIZIN/aylik/"

# --- Saklama suresi ---
find "$YEDEK_DIZIN/gunluk" -type f -mtime +30 -delete
find "$YEDEK_DIZIN/haftalik" -type f -mtime +84 -delete
find "$YEDEK_DIZIN/aylik" -type f -mtime +365 -delete

BOYUT="$(du -h "$DOSYA" | cut -f1)"
echo "[$(date '+%F %T')] Tamamlandı: $DOSYA ($BOYUT)"
