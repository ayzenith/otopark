"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { kapasiteAction } from "@/server/actions/tarife";

export function KapasiteFormu({
  mevcutKapasite,
  mevcutEsik,
}: {
  mevcutKapasite: number;
  mevcutEsik: number;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        setBasari(null);
        basla(async () => {
          const sonuc = await kapasiteAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setBasari("Kapasite kaydedildi.");
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} /> : null}

      <Input
        name="kapasite"
        etiket="Toplam kapasite (araç)"
        type="number"
        min={0}
        max={100000}
        defaultValue={mevcutKapasite || ""}
        placeholder="Bilinmiyorsa boş bırakın"
        yardim="Boş veya 0 = tanımsız; giriş engellenmez."
      />
      <Input
        name="uyariEsigi"
        etiket="Uyarı eşiği (%)"
        type="number"
        min={1}
        max={100}
        defaultValue={mevcutEsik}
        yardim="Doluluk bu yüzdeyi aşınca personel ekranında çubuk uyarı rengine döner."
      />
      <Button type="submit" variant="birincil" size="ikincil" tamGenislik disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "KAYDET"}
      </Button>
    </form>
  );
}
