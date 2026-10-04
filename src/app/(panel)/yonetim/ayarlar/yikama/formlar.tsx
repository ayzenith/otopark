"use client";

/**
 * OTO YIKAMA HIZMET VE FIYAT FORMLARI (patron)
 *
 * ============================================================================
 * FIYATLAR KODA SABIT DEGIL
 * ----------------------------------------------------------------------------
 * Fiyat izgarasi satirlarda HIZMET, kolonlarda ARAC TIPI gosterir. Patron
 * herhangi bir hucreyi degistirip kaydeder; degisen hucre icin yeni fiyat
 * surumu yazilir, eskisi kapatilir. Gecmis is emirleri etkilenmez.
 *
 * BOS HUCRE = FIYAT TANIMSIZ. Kaydedilirken atlanir, 0 TL olarak yazilmaz.
 * Boylece "henuz fiyat vermedim" ile "bu hizmet bedava" birbirine karismaz.
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { formatKurusPlain } from "@/lib/money";
import {
  aracSinifiOlusturAction,
  yikamaFiyatlariKaydetAction,
  yikamaHizmetiGuncelleAction,
  yikamaHizmetiOlusturAction,
} from "@/server/actions/yikama";

export interface FiyatIzgaraSinifi {
  id: string;
  kod: string;
  ad: string;
}

export interface FiyatIzgaraHizmeti {
  id: string;
  kod: string;
  ad: string;
  aciklama: string | null;
  tahminiDakika: number | null;
  aktif: boolean;
  siteGorunur: boolean;
  siraNo: number;
  genelFiyatKurus: number | null;
  sinifFiyatlari: Record<string, number | null>;
}

function liraMetni(kurus: number | null): string {
  return kurus === null ? "" : formatKurusPlain(kurus);
}

/** Fiyat izgarasi: satir = hizmet, kolon = arac tipi. */
export function FiyatIzgarasi({
  hizmetler,
  siniflar,
}: {
  hizmetler: FiyatIzgaraHizmeti[];
  siniflar: FiyatIzgaraSinifi[];
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (hizmetler.length === 0) {
    return (
      <Alert tur="bilgi" baslik="Henüz yıkama hizmeti yok">
        Aşağıdan hizmet ekleyin, sonra fiyatlarını girin.
      </Alert>
    );
  }

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setHata(null);
        setBasari(null);
        basla(async () => {
          const sonuc = await yikamaFiyatlariKaydetAction(formData);
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setBasari(
            sonuc.data.guncellenen === 0
              ? "Değişiklik yok; hiçbir fiyat güncellenmedi."
              : `${sonuc.data.guncellenen} fiyat güncellendi. Geçmiş işler etkilenmedi.`,
          );
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} data-test="fiyat-kaydet-basari" /> : null}

      {/* Mobilde kart, masaüstünde de aynı düzen: yatay kaydırma YOK. */}
      <ul className="space-y-3">
        {hizmetler.map((h) => (
          <li
            key={h.id}
            className={`rounded-2xl border-2 p-3 ${
              h.aktif ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"
            }`}
            data-test={`fiyat-satiri-${h.kod}`}
          >
            <div className="mb-2">
              <div className="font-bold text-lacivert-700">
                {h.ad}
                {h.aktif ? "" : " (pasif)"}
              </div>
              <div className="text-xs text-slate-400">
                {h.kod}
                {h.tahminiDakika ? ` · ~${h.tahminiDakika} dk` : ""}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {siniflar.map((s) => (
                <Input
                  key={s.id}
                  name={`fiyat__${h.id}__${s.id}`}
                  etiket={`${s.ad} (₺)`}
                  inputMode="decimal"
                  className="rakam"
                  defaultValue={liraMetni(h.sinifFiyatlari[s.id] ?? null)}
                  placeholder="tanımsız"
                  data-test={`fiyat-${h.kod}-${s.kod}`}
                />
              ))}
              <Input
                name={`fiyat__${h.id}__GENEL`}
                etiket="Tüm tipler (₺)"
                inputMode="decimal"
                className="rakam"
                defaultValue={liraMetni(h.genelFiyatKurus)}
                placeholder="tanımsız"
                yardim="Tipe özel fiyat girilmemişse bu kullanılır."
                data-test={`fiyat-${h.kod}-GENEL`}
              />
            </div>
          </li>
        ))}
      </ul>

      <Input name="not" etiket="Değişiklik notu (isteğe bağlı)" maxLength={300} />

      <Alert tur="bilgi" baslik="Boş bırakılan alan “fiyat tanımsız” demektir">
        0 ₺ olarak kaydedilmez. Personel o hizmeti seçtiğinde ekranda
        <strong> “fiyat girilmemiş”</strong> uyarısı görür.
      </Alert>

      <Button
        type="submit"
        variant="birincil"
        size="islem"
        tamGenislik
        disabled={bekliyor}
        data-test="fiyatlari-kaydet"
      >
        {bekliyor ? "Kaydediliyor…" : "FİYATLARI KAYDET"}
      </Button>
    </form>
  );
}

/** Yeni yikama hizmeti (ornek: motor yikama, pasta cila). */
export function HizmetEkleFormu() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button
        variant="ikincil"
        size="ikincil"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="hizmet-ekle-ac"
      >
        + YENİ YIKAMA HİZMETİ
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border-2 border-lacivert-200 p-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await yikamaHizmetiOlusturAction({
            kod: String(formData.get("kod") ?? "").toUpperCase(),
            ad: String(formData.get("ad") ?? ""),
            aciklama: String(formData.get("aciklama") ?? "") || null,
            tahminiDakika: String(formData.get("tahminiDakika") ?? "") || null,
            siteGorunur: formData.get("siteGorunur") === "on",
            siraNo: String(formData.get("siraNo") ?? "0"),
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setAcik(false);
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}

      <Input
        name="ad"
        etiket="Hizmet adı"
        placeholder="Motor Yıkama"
        required
        maxLength={80}
        data-test="hizmet-ad"
      />
      <Input
        name="kod"
        etiket="Kod"
        placeholder="MOTOR_YIKAMA"
        required
        maxLength={30}
        className="font-mono uppercase"
        yardim="Büyük harf, rakam ve alt çizgi. Sonradan değişmez."
        data-test="hizmet-kod"
      />
      <Input name="aciklama" etiket="Açıklama (isteğe bağlı)" maxLength={300} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="tahminiDakika"
          etiket="Tahmini süre (dk)"
          type="number"
          min={0}
          max={1440}
        />
        <Input name="siraNo" etiket="Sıra no" type="number" min={0} max={1000} defaultValue={0} />
      </div>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3">
        <input type="checkbox" name="siteGorunur" className="size-6" />
        <span className="text-base font-semibold text-lacivert-700">
          Web sitesinde göster (Aşama 7)
        </span>
      </label>

      <Alert tur="bilgi" baslik="Fiyat ayrı girilir">
        Hizmet eklendikten sonra fiyat ızgarasından araç tiplerine göre fiyat girin.
      </Alert>

      <div className="flex gap-2">
        <Button type="submit" variant="birincil" size="ikincil" disabled={bekliyor} data-test="hizmet-kaydet">
          {bekliyor ? "…" : "HİZMETİ EKLE"}
        </Button>
        <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

/** Hizmeti pasife alma / geri acma. Silme YOKTUR: gecmis is emirleri bozulmasin. */
export function HizmetDurumButonu({
  washServiceId,
  ad,
  aciklama,
  tahminiDakika,
  siteGorunur,
  siraNo,
  aktif,
}: {
  washServiceId: string;
  ad: string;
  aciklama: string | null;
  tahminiDakika: number | null;
  siteGorunur: boolean;
  siraNo: number;
  aktif: boolean;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <>
      {hata ? <Alert tur="hata" baslik={hata} className="mt-2" /> : null}
      <Button
        size="normal"
        variant={aktif ? "sade" : "ikincil"}
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            const sonuc = await yikamaHizmetiGuncelleAction({
              washServiceId,
              ad,
              aciklama,
              tahminiDakika,
              siteGorunur,
              siraNo,
              aktif: !aktif,
            });
            if (!sonuc.ok) {
              setHata(sonuc.error);
              return;
            }
            router.refresh();
          })
        }
        data-test={`hizmet-durum-${washServiceId}`}
      >
        {bekliyor ? "…" : aktif ? "Pasife al" : "Geri aç"}
      </Button>
    </>
  );
}

/** Yeni arac tipi (ornek: Ticari, Minibus). Yikama fiyati tipe baglidir. */
export function SinifEkleFormu() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [tarifeDisi, setTarifeDisi] = useState(false);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button
        variant="sade"
        size="ikincil"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="sinif-ekle-ac"
      >
        + YENİ ARAÇ TİPİ
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border-2 border-slate-200 p-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await aracSinifiOlusturAction({
            kod: String(formData.get("kod") ?? "").toUpperCase(),
            ad: String(formData.get("ad") ?? ""),
            siraNo: String(formData.get("siraNo") ?? "0"),
            standartTarifeDisi: tarifeDisi,
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setAcik(false);
          setTarifeDisi(false);
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input name="ad" etiket="Araç tipi adı" placeholder="Ticari" required maxLength={60} data-test="sinif-ad" />
      <Input
        name="kod"
        etiket="Kod"
        placeholder="TICARI"
        required
        maxLength={30}
        className="font-mono uppercase"
        data-test="sinif-kod"
      />
      <Input name="siraNo" etiket="Sıra no" type="number" min={0} max={1000} defaultValue={0} />

      <label className="flex min-h-12 items-start gap-3 rounded-xl border-2 border-slate-300 bg-white px-3 py-2">
        <input
          type="checkbox"
          checked={tarifeDisi}
          onChange={(e) => setTarifeDisi(e.target.checked)}
          className="mt-1 size-6 shrink-0"
        />
        <span className="text-sm">
          <strong className="block text-lacivert-700">
            Normal otopark tarifesine dahil değil
          </strong>
          <span className="text-slate-500">
            Karavan gibi ayrı fiyatlandırılacak tipler için işaretleyin. Bu tipteki araçlar
            genel otopark tarifesinden ücretlendirilmez; kendi kuralı girilene kadar
            çıkışta ücret hesaplanmaz ve personele uyarı çıkar.
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <Button type="submit" variant="birincil" size="ikincil" disabled={bekliyor} data-test="sinif-kaydet">
          {bekliyor ? "…" : "TİPİ EKLE"}
        </Button>
        <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
