"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { vardiyaBaslatAction, vardiyaKapatAction } from "@/server/actions/vardiya";

export function VardiyaBaslatButonu() {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="space-y-2">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Button
        variant="birincil"
        size="islem"
        tamGenislik
        disabled={bekliyor}
        data-test="vardiya-baslat"
        onClick={() =>
          basla(async () => {
            setHata(null);
            const sonuc = await vardiyaBaslatAction();
            if (!sonuc.ok) setHata(sonuc.error);
            else router.refresh();
          })
        }
      >
        {bekliyor ? "Başlatılıyor…" : "VARDİYAYI BAŞLAT"}
      </Button>
    </div>
  );
}

export function VardiyaKapatButonu() {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [ozet, setOzet] = useState<string | null>(null);
  const [onayBekliyor, setOnayBekliyor] = useState(false);
  const [bekliyor, basla] = useTransition();

  if (ozet) {
    return <Alert tur="basari" baslik="Vardiya kapatıldı">{ozet}</Alert>;
  }

  if (!onayBekliyor) {
    return (
      <Button variant="sade" size="ikincil" tamGenislik onClick={() => setOnayBekliyor(true)}>
        Vardiyayı kapat
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Alert tur="uyari" baslik="Vardiyanızı kapatmak üzeresiniz">
        Kapanıştan sonra işlem yapmak için yeniden vardiya başlatmanız gerekir.
      </Alert>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="uyari"
          size="ikincil"
          disabled={bekliyor}
          onClick={() =>
            basla(async () => {
              setHata(null);
              const sonuc = await vardiyaKapatAction();
              if (!sonuc.ok) {
                setHata(sonuc.error);
                return;
              }
              setOzet(
                `${sonuc.data.tahsilatAdedi} tahsilat kaydedildi. ` +
                  `Otoparkta ${sonuc.data.devredilenArac} araç devredildi.`,
              );
              router.refresh();
            })
          }
        >
          {bekliyor ? "Kapatılıyor…" : "Evet, kapat"}
        </Button>
        <Button variant="sade" size="ikincil" onClick={() => setOnayBekliyor(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
