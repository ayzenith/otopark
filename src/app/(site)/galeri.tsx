"use client";

import { useState } from "react";

/**
 * GALERİ GÖRSELİ
 *
 * Görsel adresleri panelden SERBEST METİN olarak giriliyor: dosya silinmiş,
 * adres yanlış yazılmış ya da dış sunucu kapalı olabilir. Böyle bir durumda
 * tarayıcı kırık görsel ikonu çizer ve müşteriye bakımsız bir site gösterir.
 *
 * Çözüm: yüklenemeyen görseli HİÇ GÖSTERME. Patron panelde adresi zaten
 * görüyor; ziyaretçiye kırık ikon göstermektense o kareyi atlamak doğrudur.
 * (break-ui ile bulundu, 08.10.2026.)
 */
export function GaleriGorseli({ url, alt }: { url: string; alt: string }) {
  const [kirik, setKirik] = useState(false);
  if (kirik) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       Adresler panelden girilen serbest metindir (yerel dosya ya da dış
       bağlantı); next/image uzak alan adı yapılandırması ister ve hangi
       alan adının kullanılacağı henüz belli değil. */
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setKirik(true)}
      className="h-48 w-full rounded-xl bg-kagit-200 object-cover"
    />
  );
}
