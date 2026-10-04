"use client";

/**
 * MUSTERI FORMLARI
 *
 * Mobil kurallar: her alan 48px, yazi 16px (iOS yakinlastirmasin), kaydet
 * butonu 56px ve tam genislik. Hata mesaji formun EN USTUNDE gorunur ki
 * klavye acikken de okunabilsin.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { aracBaglaAction, aracCozAction, musteriGuncelleAction, musteriOlusturAction } from "@/server/actions/musteri";

export interface MusteriVarsayilan {
  id?: string;
  adSoyad?: string;
  telefon?: string;
  ikinciTelefon?: string | null;
  eposta?: string | null;
  kurumsalMi?: boolean;
  firmaAdi?: string | null;
  vergiNo?: string | null;
  notlar?: string | null;
}

export function MusteriFormu({ varsayilan }: { varsayilan?: MusteriVarsayilan }) {
  const router = useRouter();
  const duzenleme = Boolean(varsayilan?.id);
  const [hata, setHata] = useState<string | null>(null);
  const [kurumsal, setKurumsal] = useState(varsayilan?.kurumsalMi ?? false);
  const [bekliyor, basla] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const girdi = {
            adSoyad: String(formData.get("adSoyad") ?? ""),
            telefon: String(formData.get("telefon") ?? ""),
            ikinciTelefon: String(formData.get("ikinciTelefon") ?? "") || null,
            eposta: String(formData.get("eposta") ?? "") || null,
            kurumsalMi: kurumsal,
            firmaAdi: String(formData.get("firmaAdi") ?? "") || null,
            vergiNo: String(formData.get("vergiNo") ?? "") || null,
            notlar: String(formData.get("notlar") ?? "") || null,
          };

          const sonuc = duzenleme
            ? await musteriGuncelleAction({ ...girdi, musteriId: varsayilan!.id })
            : await musteriOlusturAction(girdi);

          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          router.push(`/musteriler/${sonuc.data.id}`);
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}

      <Input
        name="adSoyad"
        etiket="Ad soyad"
        defaultValue={varsayilan?.adSoyad ?? ""}
        required
        maxLength={120}
        autoComplete="name"
        data-test="musteri-ad"
      />
      <Input
        name="telefon"
        etiket="Telefon"
        type="tel"
        inputMode="tel"
        defaultValue={varsayilan?.telefon ?? ""}
        placeholder="0532 111 22 33"
        required
        data-test="musteri-telefon"
      />
      <Input
        name="ikinciTelefon"
        etiket="İkinci telefon (isteğe bağlı)"
        type="tel"
        inputMode="tel"
        defaultValue={varsayilan?.ikinciTelefon ?? ""}
      />
      <Input
        name="eposta"
        etiket="E-posta (isteğe bağlı)"
        type="email"
        inputMode="email"
        defaultValue={varsayilan?.eposta ?? ""}
      />

      <label className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3">
        <input
          type="checkbox"
          checked={kurumsal}
          onChange={(e) => setKurumsal(e.target.checked)}
          className="size-6"
        />
        <span className="text-base font-semibold text-lacivert-700">Kurumsal müşteri</span>
      </label>

      {kurumsal ? (
        <>
          <Input
            name="firmaAdi"
            etiket="Firma adı"
            defaultValue={varsayilan?.firmaAdi ?? ""}
            maxLength={160}
          />
          <Input
            name="vergiNo"
            etiket="Vergi / TC no (isteğe bağlı)"
            defaultValue={varsayilan?.vergiNo ?? ""}
            maxLength={40}
          />
        </>
      ) : null}

      <Input
        name="notlar"
        etiket="Not (isteğe bağlı)"
        defaultValue={varsayilan?.notlar ?? ""}
        maxLength={1000}
      />

      <Button
        type="submit"
        variant="birincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        data-test="musteri-kaydet"
      >
        {bekliyor ? "Kaydediliyor…" : duzenleme ? "DEĞİŞİKLİKLERİ KAYDET" : "MÜŞTERİYİ KAYDET"}
      </Button>
    </form>
  );
}

/** Musteriye plaka baglama. Arac baska musteride ise ONAY ister. */
export function AracBaglaFormu({ musteriId }: { musteriId: string }) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [zorla, setZorla] = useState<{ bicim?: boolean; devral?: boolean }>({});
  const [bekliyor, basla] = useTransition();

  function gonder(formData: FormData, ek?: { bicim?: boolean; devral?: boolean }) {
    setHata(null);
    setBasari(null);
    basla(async () => {
      const sonuc = await aracBaglaAction({
        musteriId,
        plaka: String(formData.get("plaka") ?? ""),
        markaModel: String(formData.get("markaModel") ?? "") || null,
        renk: String(formData.get("renk") ?? "") || null,
        bicimiZorla: ek?.bicim ?? zorla.bicim,
        devralmayiOnayla: ek?.devral ?? zorla.devral,
      });
      if (!sonuc.ok) {
        setHata(sonuc.error);
        if (sonuc.code === "PLAKA_BICIMI") setZorla((z) => ({ ...z, bicim: true }));
        if (sonuc.code === "ARAC_BASKA_MUSTERIDE") setZorla((z) => ({ ...z, devral: true }));
        return;
      }
      setBasari(`${sonuc.data.plaka} müşteriye bağlandı.`);
      setZorla({});
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-3"
      action={(formData) => gonder(formData)}
      onReset={() => {
        setHata(null);
        setBasari(null);
      }}
    >
      {hata ? (
        <Alert tur="uyari" baslik={hata}>
          {zorla.bicim || zorla.devral ? (
            <Button
              size="normal"
              variant="uyari"
              className="mt-2"
              disabled={bekliyor}
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                if (form) gonder(new FormData(form), { bicim: true, devral: true });
              }}
            >
              Yine de bağla
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {basari ? <Alert tur="basari" baslik={basari} /> : null}

      <Input
        name="plaka"
        etiket="Plaka"
        placeholder="34 ABC 123"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={12}
        required
        className="font-mono text-lg tracking-wider"
        data-test="arac-plaka"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input name="markaModel" etiket="Marka / model" maxLength={80} />
        <Input name="renk" etiket="Renk" maxLength={40} />
      </div>
      <Button
        type="submit"
        variant="ikincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        data-test="arac-bagla"
      >
        {bekliyor ? "Kaydediliyor…" : "ARACI BAĞLA"}
      </Button>
    </form>
  );
}

export function AracCozButonu({
  vehicleId,
  musteriId,
  plaka,
}: {
  vehicleId: string;
  musteriId: string;
  plaka: string;
}) {
  const router = useRouter();
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!onay) {
    return (
      <>
        {hata ? <Alert tur="hata" baslik={hata} className="mb-2" /> : null}
        <Button size="normal" variant="sade" onClick={() => setOnay(true)}>
          Müşteriden ayır
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-lacivert-700">
        {plaka} bu müşteriden ayrılsın mı? Geçmiş kayıtlar silinmez.
      </p>
      <div className="flex gap-2">
        <Button
          size="normal"
          variant="tehlike"
          disabled={bekliyor}
          onClick={() =>
            basla(async () => {
              const sonuc = await aracCozAction({ vehicleId, musteriId });
              if (!sonuc.ok) {
                setHata(sonuc.error);
                setOnay(false);
                return;
              }
              setOnay(false);
              router.refresh();
            })
          }
        >
          {bekliyor ? "…" : "Evet, ayır"}
        </Button>
        <Button size="normal" variant="sade" onClick={() => setOnay(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
