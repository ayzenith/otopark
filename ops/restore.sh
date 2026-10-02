#!/bin/sh
# ---------------------------------------------------------------------------
# Yedekten geri yukleme
#
# KULLANIM:
#   ./restore.sh /yedekler/gunluk/otopark-20261002-030000.sql.gz.gpg
#
# UYARI: Bu islem MEVCUT VERITABANINI SILER ve yedekteki haliyle degistirir.
# Once mevcut durumun yedegini alin.
#
# TEST EDILMEMIS YEDEK, YEDEK SAYILMAZ: bu betik her ceyrekte bir kez
# gercek bir yedekle denenmeli ve sonucu ops/RUNBOOK.md'ye kaydedilmeli.
# ---------------------------------------------------------------------------
set -eu

if [ $# -lt 1 ]; then
  echo "Kullanım: $0 <yedek-dosyasi>"
  exit 1
fi

KAYNAK="$1"
[ -f "$KAYNAK" ] || { echo "Dosya bulunamadı: $KAYNAK"; exit 1; }

echo "DİKKAT: '$PGDATABASE' veritabanının mevcut içeriği SİLİNECEK."
printf "Devam etmek için 'EVET' yazın: "
read -r ONAY
[ "$ONAY" = "EVET" ] || { echo "İptal edildi."; exit 1; }

GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT

DOSYA="$KAYNAK"

# --- Sifre cozme ---
case "$KAYNAK" in
  *.gpg)
    [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE gerekli."; exit 1; }
    gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" \
        --decrypt --output "$GECICI/yedek.sql.gz" "$KAYNAK"
    DOSYA="$GECICI/yedek.sql.gz"
    ;;
esac

echo "Geri yükleniyor…"
# Semayi tamamen sifirla, sonra yedegi uygula.
psql -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
gunzip -c "$DOSYA" | psql -v ON_ERROR_STOP=1

echo "Tamamlandı. Doğrulama:"
psql -tAc "select count(*) || ' kullanıcı' from \"User\";"
psql -tAc "select count(*) || ' park kaydı' from \"ParkingSession\";"
psql -tAc "select count(*) || ' ödeme kaydı' from \"Payment\";"
echo
echo "Uygulamayı yeniden başlatın:  docker compose restart app"
