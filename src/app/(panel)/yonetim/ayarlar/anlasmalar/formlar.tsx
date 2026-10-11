"use client";

/**
 * KURUM ANLAŞMASI FORMLARI (patron)
 *
 * Formlar KONTROLLÜDÜR (mimari kural 18): hata sonrası girilen değer
 * kaybolmaz. Fiyat değişikliği yeni SÜRÜM açar; geçmiş çıkışların tutarı
 * değişmez (park kaydında anlaşmanın kopyası durur).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import {
  anlasmaFiyatiGuncelleAction,
  anlasmaGuncelleAction,
  anlasmaOlusturAction,
} from "@/server/actions/anlasma";

function kurusuMetne(kurus: number | null): string {
  if (kurus === null) return "";
  return kurus % 100 === 0 ? String(kurus / 100) : (kurus / 100).toFixed(2).replace(".", ",");
}

export function AnlasmaSatiri({
  id,
  ad,
  aktif,
  fiyatKurus,
}: {
  id: string;
  ad: string;
  aktif: boolean;
  fiyatKurus: number | null;
}) {
  const router = useRouter();
  const [yeniAd, setYeniAd] = useState(ad);
  const [fiyat, setFiyat] = useState(kurusuMetne(fiyatKurus));
  const [not, setNot] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function calistir(is: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, basari: string) {
    setHata(null);
    setMesaj(null);
    basla(async () => {
      const sonuc = await is();
      if (!sonuc.ok) {
        setHata(sonuc.error ?? "İşlem yapılamadı.");
        return;
      }
      setMesaj(basari);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3" data-test="anlasma-satiri" data-anlasma-adi={ad}>
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {mesaj ? <Alert tur="basari" baslik={mesaj} /> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Input
          etiket="Anlaşma adı"
          value={yeniAd}
          onChange={(e) => setYeniAd(e.target.value)}
          maxLength={60}
          data-test="anlasma-ad"
        />
        <Button
          variant="ikincil"
          disabled={bekliyor || yeniAd.trim() === ad}
          onClick={() =>
            calistir(() => anlasmaGuncelleAction({ id, ad: yeniAd }), "Anlaşma adı kaydedildi.")
          }
        >
          Adı kaydet
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Input
          etiket="Sabit ücret (₺)"
          inputMode="decimal"
          value={fiyat}
          onChange={(e) => setFiyat(e.target.value)}
          placeholder="200"
          data-test="anlasma-fiyat"
        />
        <Input
          etiket="Değişiklik notu (isteğe bağlı)"
          value={not}
          onChange={(e) => setNot(e.target.value)}
          maxLength={300}
        />
        <Button
          variant="birincil"
          disabled={bekliyor || fiyat.trim() === "" || fiyat.trim() === kurusuMetne(fiyatKurus)}
          onClick={() =>
            calistir(
              () => anlasmaFiyatiGuncelleAction({ id, fiyat, not: not || undefined }),
              "Yeni fiyat kaydedildi. Bundan sonraki çıkışlarda geçerli.",
            )
          }
          data-test="anlasma-fiyat-kaydet"
        >
          Fiyatı kaydet
        </Button>
      </div>

      <Button
        variant={aktif ? "sade" : "ikincil"}
        disabled={bekliyor}
        onClick={() =>
          calistir(
            () => anlasmaGuncelleAction({ id, aktif: !aktif }),
            aktif ? "Anlaşma pasife alındı; çıkışta artık görünmez." : "Anlaşma yeniden açıldı.",
          )
        }
        data-test="anlasma-durum"
      >
        {bekliyor ? "…" : aktif ? "Pasife al" : "Geri aç"}
      </Button>
    </div>
  );
}

export function AnlasmaEkleFormu() {
  const router = useRouter();
  const [ad, setAd] = useState("");
  const [fiyat, setFiyat] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="space-y-3">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Input
          etiket="Anlaşma adı"
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          maxLength={60}
          placeholder="Örnek: Kurum adı"
          data-test="yeni-anlasma-ad"
        />
        <Input
          etiket="Sabit ücret (₺)"
          inputMode="decimal"
          value={fiyat}
          onChange={(e) => setFiyat(e.target.value)}
          placeholder="200"
          data-test="yeni-anlasma-fiyat"
        />
        <Button
          variant="birincil"
          disabled={bekliyor || ad.trim().length < 2 || fiyat.trim() === ""}
          onClick={() => {
            setHata(null);
            basla(async () => {
              const sonuc = await anlasmaOlusturAction({ ad, fiyat });
              if (!sonuc.ok) {
                setHata(sonuc.error);
                return;
              }
              setAd("");
              setFiyat("");
              router.refresh();
            });
          }}
          data-test="yeni-anlasma-kaydet"
        >
          {bekliyor ? "…" : "Anlaşma ekle"}
        </Button>
      </div>
    </div>
  );
}
