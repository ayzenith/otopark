"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { planOlusturAction, surumOlusturAction } from "@/server/actions/tarife";

/** Kurus degerini lira metnine cevirir. 0 -> bos (tanimli degil). */
function liraMetni(kurus: number | null): string {
  if (kurus === null || kurus === 0) return "";
  return (kurus / 100).toFixed(2).replace(".", ",");
}

function saatMetni(dakika: number | null): string {
  if (dakika === null) return "";
  return `${String(Math.floor(dakika / 60)).padStart(2, "0")}:${String(dakika % 60).padStart(2, "0")}`;
}

export function PlanOlusturFormu() {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await planOlusturAction({
            ad: String(formData.get("ad") ?? ""),
            aciklama: String(formData.get("aciklama") ?? "") || undefined,
            varsayilan: formData.get("varsayilan") === "on",
            oncelik: Number(formData.get("oncelik") ?? 0) || 0,
          });
          if (!sonuc.ok) setHata(sonuc.error);
          else router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input name="ad" etiket="Plan adı" placeholder="Standart 2026" required maxLength={80} />
      <Input name="aciklama" etiket="Açıklama (isteğe bağlı)" maxLength={300} />
      <Input
        name="oncelik"
        etiket="Öncelik"
        type="number"
        min={0}
        max={1000}
        defaultValue={0}
        yardim="Birden fazla plan geçerliyse yüksek öncelikli kazanır."
      />
      <label className="flex min-h-12 items-center gap-3 text-sm font-semibold text-lacivert-700">
        <input type="checkbox" name="varsayilan" className="h-5 w-5" />
        Varsayılan plan olsun
      </label>
      <Button type="submit" variant="birincil" size="ikincil" tamGenislik disabled={bekliyor}>
        {bekliyor ? "Oluşturuluyor…" : "PLAN OLUŞTUR"}
      </Button>
    </form>
  );
}

export interface MevcutKural {
  vehicleClassId: string | null;
  ucretsizDakika: number;
  ucretsizDusulur: boolean;
  ilkBlokDakika: number;
  ilkBlokUcretKurus: number;
  saatlikUcretKurus: number;
  saatYuvarlamaDakika: number;
  gunlukUcretKurus: number;
  gunlukUstLimitKurus: number;
  geceSabitUcretKurus: number | null;
  geceBaslangicDakika: number | null;
  geceBitisDakika: number | null;
  haftaSonuKatsayisi: number | null;
  asgariUcretKurus: number;
}

/**
 * Yeni tarife surumu formu.
 *
 * Mevcut sürüm varsa degerleri ON DOLU gelir (patron kolayca degistirsin);
 * yoksa TUM ALANLAR BOS gelir - sistem fiyat uydurmaz. Bos alan "tanimli
 * degil" demektir.
 */
export function SurumOlusturFormu({
  planId,
  planAdi,
  siniflar,
  mevcutKurallar,
}: {
  planId: string;
  planAdi: string;
  siniflar: { id: string; ad: string }[];
  mevcutKurallar: MevcutKural[];
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  // Mevcut kural yoksa tek bir genel kural ile basla.
  const [kuralSiniflari, setKuralSiniflari] = useState<(string | null)[]>(
    mevcutKurallar.length > 0 ? mevcutKurallar.map((k) => k.vehicleClassId) : [null],
  );

  if (!acik) {
    return (
      <div className="space-y-2">
        {basari ? <Alert tur="basari" baslik={basari} /> : null}
        <Button variant="ikincil" size="ikincil" tamGenislik onClick={() => setAcik(true)}>
          {mevcutKurallar.length > 0 ? "YENİ SÜRÜM OLUŞTUR" : "FİYAT GİR (ilk sürüm)"}
        </Button>
      </div>
    );
  }

  function kuralVerisi(index: number): MevcutKural | undefined {
    const sinifId = kuralSiniflari[index];
    return mevcutKurallar.find((k) => k.vehicleClassId === sinifId);
  }

  return (
    <form
      className="space-y-4 rounded-xl border-2 border-mavi-200 bg-mavi-50 p-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await surumOlusturAction(formData);
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setBasari(`${planAdi} için yeni sürüm oluşturuldu.`);
          setAcik(false);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="planId" value={planId} />

      {hata ? <Alert tur="hata" baslik={hata} /> : null}

      <Alert tur="bilgi" baslik="Boş bıraktığınız alan “tanımlı değil” sayılır">
        Sistem hiçbir alana varsayılan fiyat koymaz. Yalnızca girdiğiniz değerler uygulanır.
      </Alert>

      {kuralSiniflari.map((sinifId, i) => {
        const mevcut = kuralVerisi(i);
        return (
          <fieldset key={i} className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
            <legend className="px-1 text-sm font-bold text-lacivert-700">
              {sinifId === null
                ? "Tüm araçlar (genel kural)"
                : (siniflar.find((s) => s.id === sinifId)?.ad ?? "Araç sınıfı")}
            </legend>
            <input type="hidden" name="kuralSinifi" value={sinifId ?? "genel"} />

            <Input
              name={`ucretsizDakika_${i}`}
              etiket="Ücretsiz süre (dakika)"
              type="number"
              min={0}
              max={1440}
              defaultValue={mevcut?.ucretsizDakika || ""}
              placeholder="örn. 15"
            />
            <label className="flex min-h-12 items-center gap-3 text-sm text-lacivert-700">
              <input
                type="checkbox"
                name={`ucretsizDusulur_${i}`}
                defaultChecked={mevcut?.ucretsizDusulur ?? false}
                className="h-5 w-5"
              />
              Ücretsiz süre toplam süreden düşülsün
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Input
                name={`ilkBlokDakika_${i}`}
                etiket="İlk blok (dk)"
                type="number"
                min={0}
                max={1440}
                defaultValue={mevcut?.ilkBlokDakika || ""}
              />
              <Input
                name={`ilkBlokUcret_${i}`}
                etiket="İlk blok ücreti (₺)"
                inputMode="decimal"
                defaultValue={liraMetni(mevcut?.ilkBlokUcretKurus ?? 0)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                name={`saatlikUcret_${i}`}
                etiket="Saatlik ücret (₺)"
                inputMode="decimal"
                defaultValue={liraMetni(mevcut?.saatlikUcretKurus ?? 0)}
              />
              <Input
                name={`saatYuvarlamaDakika_${i}`}
                etiket="Kademe (dk)"
                type="number"
                min={1}
                max={1440}
                defaultValue={mevcut?.saatYuvarlamaDakika ?? 60}
                yardim="60 = başlayan saat tam sayılır"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                name={`gunlukUcret_${i}`}
                etiket="Günlük (24 sa) ücret (₺)"
                inputMode="decimal"
                defaultValue={liraMetni(mevcut?.gunlukUcretKurus ?? 0)}
              />
              <Input
                name={`gunlukUstLimit_${i}`}
                etiket="Günlük üst limit (₺)"
                inputMode="decimal"
                defaultValue={liraMetni(mevcut?.gunlukUstLimitKurus ?? 0)}
              />
            </div>

            <Input
              name={`asgariUcret_${i}`}
              etiket="Asgari ücret (₺)"
              inputMode="decimal"
              defaultValue={liraMetni(mevcut?.asgariUcretKurus ?? 0)}
            />

            <div className="grid grid-cols-3 gap-2">
              <Input
                name={`geceSabitUcret_${i}`}
                etiket="Gece ücreti (₺)"
                inputMode="decimal"
                defaultValue={liraMetni(mevcut?.geceSabitUcretKurus ?? null)}
              />
              <Input
                name={`geceBaslangic_${i}`}
                etiket="Gece başı"
                placeholder="20:00"
                defaultValue={saatMetni(mevcut?.geceBaslangicDakika ?? null)}
              />
              <Input
                name={`geceBitis_${i}`}
                etiket="Gece sonu"
                placeholder="08:00"
                defaultValue={saatMetni(mevcut?.geceBitisDakika ?? null)}
              />
            </div>

            <Input
              name={`haftaSonuKatsayisi_${i}`}
              etiket="Hafta sonu katsayısı"
              inputMode="decimal"
              placeholder="örn. 1,25"
              defaultValue={mevcut?.haftaSonuKatsayisi?.toString().replace(".", ",") ?? ""}
              yardim="Boş bırakırsanız hafta sonu farkı uygulanmaz."
            />

            {kuralSiniflari.length > 1 ? (
              <Button
                variant="sade"
                size="normal"
                tamGenislik
                onClick={() => setKuralSiniflari(kuralSiniflari.filter((_, j) => j !== i))}
              >
                Bu kuralı kaldır
              </Button>
            ) : null}
          </fieldset>
        );
      })}

      {/* Araç sınıfı bazlı kural ekleme */}
      {siniflar.filter((s) => !kuralSiniflari.includes(s.id)).length > 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Araç sınıfına özel kural ekle
          </div>
          <div className="flex flex-wrap gap-2">
            {siniflar
              .filter((s) => !kuralSiniflari.includes(s.id))
              .map((s) => (
                <Button
                  key={s.id}
                  variant="sade"
                  size="normal"
                  onClick={() => setKuralSiniflari([...kuralSiniflari, s.id])}
                >
                  + {s.ad}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
        <Input
          name="degisiklikNotu"
          etiket="Değişiklik notu (zorunlu)"
          placeholder="örn. Ekim 2026 fiyat güncellemesi"
          required
          minLength={3}
          maxLength={300}
        />
        <label className="flex min-h-12 items-center gap-3 text-sm font-semibold text-lacivert-700">
          <input type="checkbox" name="hemenGecerli" defaultChecked className="h-5 w-5" />
          Hemen geçerli olsun
        </label>
        <Input
          name="gecerlilikBaslangici"
          etiket="İleri tarihli geçerlilik (isteğe bağlı)"
          type="datetime-local"
          yardim="Geçmişe tarih verilemez: geçmiş park ücretleri değişmemelidir."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" variant="birincil" size="ikincil" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : "SÜRÜMÜ KAYDET"}
        </Button>
        <Button variant="sade" size="ikincil" onClick={() => setAcik(false)} disabled={bekliyor}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
