"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import {
  siteSayfasiKaydetAction,
  siteFiyatiKaydetAction,
  siteFiyatiSilAction,
  siteGorseliKaydetAction,
  siteGorseliSilAction,
} from "@/server/actions/site";

/**
 * SİTE İÇERİĞİ FORMLARI
 *
 * Kural 18: `<form action={fn}>` React 19'da gönderimden sonra formu SIFIRLAR.
 * Bu yüzden metin alanları KONTROLLÜ tutulur — hata çıkarsa patron yazdığı
 * metni kaybetmez.
 */

export function SayfaFormu({
  anahtar,
  varsayilanBaslik,
  baslik,
  govde,
  yayinda,
}: {
  anahtar: string;
  varsayilanBaslik: string;
  baslik: string;
  govde: string;
  yayinda: boolean;
}) {
  const router = useRouter();
  const [b, setB] = useState(baslik || varsayilanBaslik);
  const [g, setG] = useState(govde);
  const [y, setY] = useState(yayinda);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function kaydet() {
    setHata(null);
    setBasari(null);
    basla(async () => {
      const sonuc = await siteSayfasiKaydetAction({
        anahtar,
        baslik: b,
        govde: g,
        yayinda: y ? "on" : "",
      });
      if (!sonuc.ok) setHata(sonuc.error);
      else {
        setBasari("Kaydedildi.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} /> : null}

      <Input etiket="Başlık" value={b} onChange={(e) => setB(e.target.value)} />

      <div>
        <label className="mb-1 block text-sm font-semibold text-lacivert-700" htmlFor={`govde-${anahtar}`}>
          Metin
        </label>
        <textarea
          id={`govde-${anahtar}`}
          data-test={`site-govde-${anahtar}`}
          value={g}
          onChange={(e) => setG(e.target.value)}
          rows={8}
          className="w-full rounded-xl border-2 border-slate-300 p-3 text-base"
          placeholder="Boş bırakılırsa bu bölüm sitede görünmez."
        />
        <p className="mt-1 text-xs text-slate-500">
          Boş satır bırakarak paragraf ayırabilirsiniz. &quot;## &quot; ile başlayan satır ara
          başlık, &quot;- &quot; ile başlayan satırlar madde listesi olur.
        </p>
      </div>

      <label className="flex min-h-12 items-center gap-3 text-base font-semibold text-lacivert-700">
        <input
          type="checkbox"
          data-test={`site-yayin-${anahtar}`}
          checked={y}
          onChange={(e) => setY(e.target.checked)}
          className="h-6 w-6"
        />
        Sitede yayınla
      </label>

      <Button
        type="button"
        variant="birincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        onClick={kaydet}
        data-test={`site-kaydet-${anahtar}`}
      >
        {bekliyor ? "Kaydediliyor…" : "KAYDET"}
      </Button>
    </div>
  );
}

export function FiyatSatiriFormu({
  mevcut,
}: {
  mevcut?: { id: string; label: string; priceText: string; sortOrder: number; isPublished: boolean; sourceNote: string | null };
}) {
  const router = useRouter();
  const [etiket, setEtiket] = useState(mevcut?.label ?? "");
  const [fiyat, setFiyat] = useState(mevcut?.priceText ?? "");
  const [sira, setSira] = useState(String(mevcut?.sortOrder ?? 0));
  const [not, setNot] = useState(mevcut?.sourceNote ?? "");
  const [yayinda, setYayinda] = useState(mevcut?.isPublished ?? true);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function kaydet() {
    setHata(null);
    basla(async () => {
      const sonuc = await siteFiyatiKaydetAction({
        id: mevcut?.id ?? "",
        etiket,
        fiyatMetni: fiyat,
        sira,
        not,
        yayinda: yayinda ? "on" : "",
      });
      if (!sonuc.ok) setHata(sonuc.error);
      else {
        if (!mevcut) {
          setEtiket("");
          setFiyat("");
          setNot("");
        }
        router.refresh();
      }
    });
  }

  function sil() {
    if (!mevcut) return;
    setHata(null);
    basla(async () => {
      const sonuc = await siteFiyatiSilAction({ id: mevcut.id });
      if (!sonuc.ok) setHata(sonuc.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3" data-test="site-fiyat-satiri">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}

      <Input
        etiket="Ne için"
        value={etiket}
        onChange={(e) => setEtiket(e.target.value)}
        placeholder="Örnek: İlk 1 saat"
        data-test="site-fiyat-etiket"
      />
      <Input
        etiket="Sitede yazacak fiyat"
        value={fiyat}
        onChange={(e) => setFiyat(e.target.value)}
        placeholder="Örnek: 100 ₺"
        yardim="Serbest metin. Tarife tablosundan otomatik alınmaz; ne yazarsanız o görünür."
        data-test="site-fiyat-tutar"
      />
      <Input etiket="Açıklama (isteğe bağlı)" value={not} onChange={(e) => setNot(e.target.value)} />
      <Input
        etiket="Sıra"
        type="number"
        min={0}
        max={999}
        value={sira}
        onChange={(e) => setSira(e.target.value)}
      />

      <label className="flex min-h-12 items-center gap-3 text-base font-semibold text-lacivert-700">
        <input
          type="checkbox"
          checked={yayinda}
          onChange={(e) => setYayinda(e.target.checked)}
          className="h-6 w-6"
        />
        Sitede göster
      </label>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="birincil"
          size="ikincil"
          tamGenislik
          disabled={bekliyor}
          onClick={kaydet}
          data-test="site-fiyat-kaydet"
        >
          {bekliyor ? "…" : mevcut ? "KAYDET" : "EKLE"}
        </Button>
        {mevcut ? (
          <Button
            type="button"
            variant="sade"
            size="ikincil"
            disabled={bekliyor}
            onClick={sil}
            data-test="site-fiyat-sil"
          >
            Sil
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function GorselFormu({
  mevcut,
}: {
  mevcut?: { id: string; url: string; alt: string; sortOrder: number; isPublished: boolean };
}) {
  const router = useRouter();
  const [url, setUrl] = useState(mevcut?.url ?? "");
  const [alt, setAlt] = useState(mevcut?.alt ?? "");
  const [sira, setSira] = useState(String(mevcut?.sortOrder ?? 0));
  const [yayinda, setYayinda] = useState(mevcut?.isPublished ?? true);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function kaydet() {
    setHata(null);
    basla(async () => {
      const sonuc = await siteGorseliKaydetAction({
        id: mevcut?.id ?? "",
        url,
        alt,
        sira,
        yayinda: yayinda ? "on" : "",
      });
      if (!sonuc.ok) setHata(sonuc.error);
      else {
        if (!mevcut) {
          setUrl("");
          setAlt("");
        }
        router.refresh();
      }
    });
  }

  function sil() {
    if (!mevcut) return;
    basla(async () => {
      const sonuc = await siteGorseliSilAction({ id: mevcut.id });
      if (!sonuc.ok) setHata(sonuc.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}

      <Input
        etiket="Görsel adresi"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://… veya /fotograflar/otopark.jpg"
        yardim="Fotoğraflar henüz verilmedi; adres girilene kadar galeri sitede görünmez."
      />
      <Input
        etiket="Görsel açıklaması"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        placeholder="Örnek: Otopark girişi"
        yardim="Görmeyen kullanıcılar ve arama motorları için zorunludur."
      />
      <Input
        etiket="Sıra"
        type="number"
        min={0}
        max={999}
        value={sira}
        onChange={(e) => setSira(e.target.value)}
      />

      <label className="flex min-h-12 items-center gap-3 text-base font-semibold text-lacivert-700">
        <input
          type="checkbox"
          checked={yayinda}
          onChange={(e) => setYayinda(e.target.checked)}
          className="h-6 w-6"
        />
        Sitede göster
      </label>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="birincil"
          size="ikincil"
          tamGenislik
          disabled={bekliyor}
          onClick={kaydet}
        >
          {bekliyor ? "…" : mevcut ? "KAYDET" : "EKLE"}
        </Button>
        {mevcut ? (
          <Button type="button" variant="sade" size="ikincil" disabled={bekliyor} onClick={sil}>
            Sil
          </Button>
        ) : null}
      </div>
    </div>
  );
}
