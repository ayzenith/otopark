"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { kapasiteAction } from "@/server/actions/tarife";
import { vardiyaPencereleriAction, isletmeKunyesiAction } from "@/server/actions/ayarlar";

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


// ---------------------------------------------------------------------------
// VARDİYA PENCERELERİ
// ---------------------------------------------------------------------------

/**
 * VARDİYA SAATLERİ
 *
 * ============================================================================
 * KARAR (05.10.2026): TEK VARDİYA ZORUNLULUĞU YOK.
 *
 * Buradaki saatler personelin vardiya açmasını ENGELLEMEZ, uyarı bile
 * üretmez. Yalnızca:
 *   · vardiya açılırken "şu an Gündüz penceresinde" bilgisi gösterilir,
 *   · raporlarda etiket olarak kullanılabilir.
 *
 * Satırı tamamen boşaltmak o pencereyi siler. Pencere gece yarısını aşabilir
 * (20:00–08:00 gibi).
 * ============================================================================
 */
export function VardiyaPencereleriFormu({
  mevcut,
}: {
  mevcut: { ad: string; baslangic: string; bitis: string }[];
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  // 6 satır: boş olanlar atlanır. Dinamik ekleme/çıkarma yerine sabit satır
  // sayısı, mobilde daha az dokunuş demek.
  const satirlar = Array.from({ length: 6 }, (_, i) => mevcut[i] ?? { ad: "", baslangic: "", bitis: "" });

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        setBasari(null);
        basla(async () => {
          const sonuc = await vardiyaPencereleriAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setBasari(
              sonuc.data.adet === 0
                ? "Vardiya penceresi tanımı kaldırıldı."
                : `${sonuc.data.adet} vardiya penceresi kaydedildi.`,
            );
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} data-test="vardiya-penceresi-basari" /> : null}

      <Alert tur="bilgi" baslik="Bu saatler vardiya açmayı engellemez">
        Personel istediği saatte vardiya açıp kapatabilir. Saatler yalnızca bilgi ve
        raporlama etiketidir. Bir satırı tamamen boşaltıp kaydederseniz o pencere silinir.
      </Alert>

      {satirlar.map((s, i) => {
        const no = i + 1;
        return (
          <div key={no} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              name={`ad${no}`}
              etiket={`${no}. vardiya adı`}
              defaultValue={s.ad}
              placeholder={no === 1 ? "Gündüz" : no === 2 ? "Gece" : ""}
              data-test={`vardiya-ad-${no}`}
            />
            <Input
              name={`baslangic${no}`}
              etiket="Başlangıç"
              type="time"
              defaultValue={s.baslangic}
              data-test={`vardiya-baslangic-${no}`}
            />
            <Input
              name={`bitis${no}`}
              etiket="Bitiş"
              type="time"
              defaultValue={s.bitis}
              data-test={`vardiya-bitis-${no}`}
            />
          </div>
        );
      })}

      <Button
        type="submit"
        variant="birincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        data-test="vardiya-penceresi-kaydet"
      >
        {bekliyor ? "Kaydediliyor…" : "VARDİYA SAATLERİNİ KAYDET"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// İŞLETME KÜNYESİ (Aşama 7 - kurumsal site bu bilgileri kullanır)
// ---------------------------------------------------------------------------

/**
 * Adres, telefon, çalışma saatleri hem panelde hem SİTEDE görünür.
 *
 * Boş bırakılan alan sitede HİÇ ÇİZİLMEZ: yanlış bilgi göstermektense hiç
 * göstermemek doğrudur (docs/07 S18 hâlâ açık, hiçbiri varsayılmadı).
 */
export function IsletmeKunyesiFormu({
  mevcut,
}: {
  mevcut: {
    isletmeAdi: string;
    adres: string;
    telefon: string;
    whatsapp: string;
    calismaSaatleri: string;
    mapsUrl: string;
    instagramUrl: string;
  };
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
          const sonuc = await isletmeKunyesiAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setBasari("İşletme bilgileri kaydedildi. Sitede hemen görünür.");
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} /> : null}

      <Input name="isletmeAdi" etiket="İşletme adı" defaultValue={mevcut.isletmeAdi} required />
      <Input
        name="adres"
        etiket="Açık adres"
        defaultValue={mevcut.adres}
        placeholder="Girilmedi"
        yardim="Boş bırakılırsa sitede adres bölümü hiç görünmez."
      />
      <Input
        name="telefon"
        etiket="Telefon"
        defaultValue={mevcut.telefon}
        placeholder="Girilmedi"
        yardim="Sitede tek dokunuşla aranabilir buton olur."
      />
      <Input
        name="whatsapp"
        etiket="WhatsApp numarası"
        defaultValue={mevcut.whatsapp}
        placeholder="Girilmedi"
        yardim="Ülke koduyla yazın (905xx…). Boşsa WhatsApp butonu çıkmaz."
      />
      <Input
        name="calismaSaatleri"
        etiket="Çalışma saatleri"
        defaultValue={mevcut.calismaSaatleri}
        placeholder="Girilmedi"
        yardim="Serbest metin. Örnek yazım: 7/24 açık."
      />
      <Input
        name="mapsUrl"
        etiket="Google Maps bağlantısı"
        defaultValue={mevcut.mapsUrl}
        placeholder="Girilmedi"
        yardim="https:// ile başlamalı. Boşsa 'Yol tarifi al' butonu çıkmaz."
      />
      <Input
        name="instagramUrl"
        etiket="Instagram bağlantısı"
        defaultValue={mevcut.instagramUrl}
        placeholder="Girilmedi"
        yardim="https:// ile başlamalı."
      />

      <Button type="submit" variant="birincil" size="ikincil" tamGenislik disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "KAYDET"}
      </Button>
    </form>
  );
}
