/**
 * ABONMAN BILGI KARTI
 *
 * Personelin plaka yazdiginda gordugu kart. Sunucu ve istemci bileşenlerinin
 * ikisinden de kullanilabilsin diye "use client" TASIMAZ ve durum tutmaz.
 *
 * Mobil kurallar:
 *  - Musteri adi ve kalan gun EN BELIRGIN iki bilgidir.
 *  - Durum rengi tek bakista anlasilir: yesil = gecerli, amber = dikkat,
 *    kirmizi = kapsam yok.
 *  - TUTAR GOSTERILMEZ. Abonman ucreti isletme bilgisidir; personel ekraninda
 *    yalnizca "odendi / odenmedi" bilgisi vardir.
 */

import { Alert, Rozet } from "@/components/ui";
import { formatDate } from "@/lib/datetime";

export type AbonmanKartDurumu =
  | "YOK"
  | "AKTIF"
  | "AKTIF_BITIYOR"
  | "AKTIF_ODENMEMIS"
  | "KAPSAM_DISI"
  | "SURESI_DOLMUS"
  | "IPTAL_VEYA_ASKIDA";

export interface AbonmanKartVerisi {
  durum: AbonmanKartDurumu;
  ucretsizMi: boolean;
  musteriAdi: string | null;
  musteriTelefonu: string | null;
  abonmanKodu: string | null;
  planEtiketi: string | null;
  baslangicTarihi: string | Date | null;
  bitisTarihi: string | Date | null;
  kalanGun: number | null;
  odemeDurumu: "UNPAID" | "PARTIAL" | "PAID" | null;
  kuralAdi: string | null;
  plakalar: string[];
  uyari: string | null;
}

const DURUM_BASLIK: Record<AbonmanKartDurumu, string> = {
  YOK: "ABONMAN YOK",
  AKTIF: "ABONMAN GEÇERLİ",
  AKTIF_BITIYOR: "ABONMAN GEÇERLİ — SÜRESİ YAKLAŞIYOR",
  AKTIF_ODENMEMIS: "ABONMAN GEÇERLİ — ÖDEME ALINMAMIŞ",
  KAPSAM_DISI: "ABONMAN KAPSAM DIŞI",
  SURESI_DOLMUS: "ABONMAN SÜRESİ DOLMUŞ",
  IPTAL_VEYA_ASKIDA: "ABONMAN İPTAL / ASKIDA",
};

const ODEME_ETIKET: Record<"UNPAID" | "PARTIAL" | "PAID", string> = {
  UNPAID: "Ödenmedi",
  PARTIAL: "Kısmi ödeme",
  PAID: "Ödendi",
};

function tarih(deger: string | Date | null): string | null {
  if (!deger) return null;
  const d = deger instanceof Date ? deger : new Date(deger);
  return Number.isNaN(d.getTime()) ? null : formatDate(d);
}

export function AbonmanKarti({
  veri,
  plakaGosterim,
  aracBilgisi,
}: {
  veri: AbonmanKartVerisi;
  plakaGosterim?: string;
  /** "Otomobil · Gri Clio" gibi serbest metin. */
  aracBilgisi?: string | null;
}) {
  const gecerli = veri.ucretsizMi;
  const kirmizi = veri.durum === "SURESI_DOLMUS" || veri.durum === "IPTAL_VEYA_ASKIDA";
  const cerceve = gecerli
    ? "border-green-300 bg-basari-acik"
    : kirmizi
      ? "border-red-300 bg-hata-acik"
      : "border-amber-300 bg-uyari-acik";

  if (veri.durum === "YOK") {
    return (
      <div
        className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-center"
        data-test="abonman-karti"
        data-abonman="yok"
      >
        {plakaGosterim ? (
          <div className="font-mono text-3xl font-bold tracking-wider text-lacivert-800">
            {plakaGosterim}
          </div>
        ) : null}
        {aracBilgisi ? <div className="mt-1 text-sm text-slate-500">{aracBilgisi}</div> : null}
        <div className="mt-3 text-base font-bold text-slate-600">ABONMAN YOK</div>
        <p className="mt-1 text-sm text-slate-500">
          Bu plakanın abonman kaydı bulunmuyor. Normal tarife uygulanır.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 p-4 ${cerceve}`}
      data-test="abonman-karti"
      data-abonman={gecerli ? "gecerli" : "gecersiz"}
    >
      {plakaGosterim ? (
        <div className="text-center">
          <div className="font-mono text-3xl font-bold tracking-wider text-lacivert-800">
            {plakaGosterim}
          </div>
          {aracBilgisi ? <div className="mt-0.5 text-sm text-slate-600">{aracBilgisi}</div> : null}
        </div>
      ) : null}

      <div className="mt-3 text-center">
        <Rozet tur={gecerli ? "basari" : kirmizi ? "hata" : "uyari"}>
          {DURUM_BASLIK[veri.durum]}
        </Rozet>
      </div>

      {veri.musteriAdi ? (
        <div className="mt-3 text-center">
          <div className="text-xl font-extrabold text-lacivert-800" data-test="abonman-musteri">
            {veri.musteriAdi}
          </div>
          {veri.musteriTelefonu ? (
            <a
              href={`tel:${veri.musteriTelefonu.replace(/\s/g, "")}`}
              className="rakam mt-0.5 inline-flex h-12 items-center text-sm font-semibold text-mavi-600"
            >
              {veri.musteriTelefonu}
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Kalan gün: geçerli abonmanda en çok sorulan bilgi. */}
      {gecerli && veri.kalanGun !== null ? (
        <div className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Kalan süre
          </div>
          <div className="rakam text-3xl font-extrabold text-lacivert-800" data-test="kalan-gun">
            {veri.kalanGun <= 0 ? "Bugün son gün" : `${veri.kalanGun} gün`}
          </div>
        </div>
      ) : null}

      <dl className="mt-3 space-y-1.5 text-sm">
        {veri.planEtiketi ? <Satir etiket="Plan" deger={veri.planEtiketi} /> : null}
        {tarih(veri.baslangicTarihi) ? (
          <Satir etiket="Başlangıç" deger={tarih(veri.baslangicTarihi)!} />
        ) : null}
        {tarih(veri.bitisTarihi) ? (
          <Satir etiket="Bitiş" deger={tarih(veri.bitisTarihi)!} vurgulu />
        ) : null}
        {veri.odemeDurumu ? (
          <Satir
            etiket="Ödeme"
            deger={ODEME_ETIKET[veri.odemeDurumu]}
            vurgulu={veri.odemeDurumu !== "PAID"}
          />
        ) : null}
        {veri.kuralAdi ? <Satir etiket="Kapsam" deger={veri.kuralAdi} /> : null}
        {veri.abonmanKodu ? <Satir etiket="Abonman no" deger={veri.abonmanKodu} /> : null}
        {veri.plakalar.length > 1 ? (
          <Satir etiket="Abonmandaki araçlar" deger={veri.plakalar.join(" · ")} />
        ) : null}
      </dl>

      {veri.uyari ? (
        <Alert
          tur={kirmizi ? "hata" : gecerli ? "uyari" : "uyari"}
          baslik={veri.uyari}
          className="mt-3"
        />
      ) : null}

      {gecerli ? (
        <p className="mt-3 text-center text-sm font-semibold text-green-900">
          Otopark ücreti alınmaz.
        </p>
      ) : (
        <p className="mt-3 text-center text-sm font-semibold text-amber-900">
          Normal tarife uygulanacak.
        </p>
      )}
    </div>
  );
}

function Satir({
  etiket,
  deger,
  vurgulu,
}: {
  etiket: string;
  deger: string;
  vurgulu?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{etiket}</dt>
      <dd
        className={
          vurgulu
            ? "text-right font-bold text-lacivert-800"
            : "text-right font-semibold text-lacivert-700"
        }
      >
        {deger}
      </dd>
    </div>
  );
}
