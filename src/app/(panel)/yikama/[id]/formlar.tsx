"use client";

/**
 * YIKAMA IS EMRI FORMLARI
 *
 * TUTAR GONDERILMEZ: tahsilat formu yalnizca odeme yontemi (ve izinliyse
 * indirim) gonderir. Tahsil edilecek tutar sunucuda satirlardan hesaplanir.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { formatKurusPlain } from "@/lib/money";
import {
  yikamaIptalAction,
  yikamaSatirCikarAction,
  yikamaSatirEkleAction,
  yikamaTahsilatAction,
  yikamaTahsilatsizTamamlaAction,
} from "@/server/actions/yikama";

function yeniAnahtar(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TahsilatFormu({
  washJobId,
  odenecekKurus,
  indirimYetkisi,
}: {
  washJobId: string;
  odenecekKurus: number;
  indirimYetkisi: boolean;
}) {
  const router = useRouter();
  const [yontem, setYontem] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [indirimAcik, setIndirimAcik] = useState(false);
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
          const sonuc = await yikamaTahsilatAction({
            washJobId,
            odemeYontemi: yontem,
            kartNotu: String(formData.get("kartNotu") ?? "") || null,
            indirim: indirimAcik ? String(formData.get("indirim") ?? "") : "",
            indirimSebebi: indirimAcik ? String(formData.get("indirimSebebi") ?? "") : null,
            tamamla: true,
            idempotencyKey: yeniAnahtar(),
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setBasari(
            sonuc.data.odenenKurus > 0
              ? `${formatKurusPlain(sonuc.data.odenenKurus)} ₺ tahsil edildi (${sonuc.data.tahsilatKodu}).`
              : "Tahsil edilecek tutar yoktu; iş tamamlandı.",
          );
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} data-test="yikama-tahsilat-basari" /> : null}

      <div className="rounded-xl bg-lacivert-600 px-4 py-3 text-center text-white">
        <div className="text-[11px] font-bold uppercase tracking-wide text-mavi-200">
          Tahsil edilecek
        </div>
        <div className="rakam mt-1 text-3xl font-extrabold" data-test="yikama-odenecek">
          {formatKurusPlain(odenecekKurus)} ₺
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["CASH", "💵 Nakit"],
            ["CARD", "💳 Kart"],
            ["TRANSFER", "Havale"],
          ] as const
        ).map(([deger, etiket]) => (
          <button
            key={deger}
            type="button"
            onClick={() => setYontem(deger)}
            className={`h-14 rounded-xl border-2 text-base font-bold ${
              yontem === deger
                ? "border-lacivert-600 bg-lacivert-600 text-white"
                : "border-slate-300 bg-white text-lacivert-700"
            }`}
            data-test={`yikama-yontem-${deger.toLowerCase()}`}
          >
            {etiket}
          </button>
        ))}
      </div>

      {yontem === "CARD" ? (
        <Input
          name="kartNotu"
          etiket="Kart / dekont notu"
          maxLength={100}
          yardim="POS bağlantısı yoktur; bu alan elle tutulan nottur."
        />
      ) : null}

      {indirimYetkisi ? (
        indirimAcik ? (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <Input name="indirim" etiket="İndirim (₺)" inputMode="decimal" className="rakam" />
            <Input name="indirimSebebi" etiket="İndirim gerekçesi" maxLength={300} required />
            <Button variant="sade" size="normal" onClick={() => setIndirimAcik(false)}>
              İndirimi kaldır
            </Button>
          </div>
        ) : (
          <Button variant="sade" size="normal" onClick={() => setIndirimAcik(true)}>
            İndirim uygula
          </Button>
        )
      ) : null}

      <Button
        type="submit"
        variant="basari"
        size="islem"
        tamGenislik
        disabled={bekliyor}
        data-test="yikama-tahsil-et"
      >
        {bekliyor ? "…" : "✓ TAHSİL ET VE TAMAMLA"}
      </Button>
    </form>
  );
}

/** Tahsilat yapmadan tamamlama: gerekce ZORUNLU. */
export function TahsilatsizTamamlaFormu({ washJobId }: { washJobId: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button
        variant="uyari"
        size="ikincil"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="tahsilatsiz-ac"
      >
        TAHSİLAT YAPMADAN TAMAMLA
      </Button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-xl border-2 border-amber-300 bg-uyari-acik p-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await yikamaTahsilatsizTamamlaAction({
            washJobId,
            sebep: String(formData.get("sebep") ?? ""),
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
      <p className="text-sm font-semibold text-amber-900">
        İş tamamlanacak ama para alınmamış olarak kaydedilecek. Patron panelinde takip
        listesinde görünür.
      </p>
      <Input name="sebep" etiket="Gerekçe" required maxLength={300} data-test="tahsilatsiz-sebep" />
      <div className="flex gap-2">
        <Button type="submit" variant="uyari" size="normal" disabled={bekliyor} data-test="tahsilatsiz-onayla">
          {bekliyor ? "…" : "TAMAMLA"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function SatirEkleFormu({
  washJobId,
  secenekler,
}: {
  washJobId: string;
  secenekler: { washServiceId: string; ad: string; fiyatKurus: number | null }[];
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [fiyatsiz, setFiyatsiz] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function ekle(washServiceId: string, fiyatsizDevam: boolean) {
    setHata(null);
    basla(async () => {
      const sonuc = await yikamaSatirEkleAction({ washJobId, washServiceId, fiyatsizDevam });
      if (!sonuc.ok) {
        setHata(sonuc.error);
        if (sonuc.code === "FIYAT_TANIMSIZ") setFiyatsiz(washServiceId);
        return;
      }
      setFiyatsiz(null);
      router.refresh();
    });
  }

  if (secenekler.length === 0) return null;

  return (
    <div className="space-y-2">
      {hata ? (
        <Alert tur="uyari" baslik={hata} data-test="satir-ekle-hata">
          {fiyatsiz ? (
            <Button
              size="normal"
              variant="uyari"
              className="mt-2"
              disabled={bekliyor}
              onClick={() => ekle(fiyatsiz, true)}
            >
              0 ₺ olarak ekle
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {secenekler.map((s) => (
          <Button
            key={s.washServiceId}
            size="normal"
            variant="sade"
            disabled={bekliyor}
            onClick={() => ekle(s.washServiceId, false)}
            data-test={`satir-ekle-${s.washServiceId}`}
          >
            + {s.ad}
            {s.fiyatKurus !== null ? ` (${formatKurusPlain(s.fiyatKurus)} ₺)` : " (fiyat yok)"}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function SatirCikarButonu({
  washJobId,
  washJobItemId,
  ad,
}: {
  washJobId: string;
  washJobItemId: string;
  ad: string;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <>
      {hata ? <Alert tur="hata" baslik={hata} className="mt-2" /> : null}
      <button
        type="button"
        aria-label={`${ad} hizmetini çıkar`}
        className="inline-flex h-12 items-center px-2 text-sm font-semibold text-hata"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            const sonuc = await yikamaSatirCikarAction({ washJobId, washJobItemId });
            if (!sonuc.ok) {
              setHata(sonuc.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {bekliyor ? "…" : "Çıkar"}
      </button>
    </>
  );
}

/**
 * IS EMRI IPTALI.
 *
 * Tahsilat yapilmissa paranin fiilen iade edilip edilmedigi AYRICA sorulur:
 * ikisi farkli muhasebe uretir.
 */
export function IptalFormu({
  washJobId,
  tahsilatVarMi,
}: {
  washJobId: string;
  tahsilatVarMi: boolean;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function iptal(sebep: string, iadeEdildi?: boolean) {
    setHata(null);
    basla(async () => {
      const sonuc = await yikamaIptalAction({
        washJobId,
        sebep,
        iadeEdildi,
        idempotencyKey: yeniAnahtar(),
      });
      if (!sonuc.ok) {
        setHata(sonuc.error);
        return;
      }
      setAcik(false);
      router.refresh();
    });
  }

  if (!acik) {
    return (
      <Button
        variant="tehlike"
        size="ikincil"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="yikama-iptal-ac"
      >
        İŞİ İPTAL ET
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border-2 border-red-300 bg-hata-acik p-3">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input id={`iptal-sebep-${washJobId}`} etiket="İptal gerekçesi" maxLength={300} />

      {tahsilatVarMi ? (
        <>
          <p className="text-sm font-semibold text-red-900">
            Bu işin tahsilatı yapılmış. Para müşteriye fiilen geri verildi mi?
          </p>
          <div className="grid gap-2">
            <Button
              variant="uyari"
              size="normal"
              disabled={bekliyor}
              onClick={() => {
                const alan = document.getElementById(
                  `iptal-sebep-${washJobId}`,
                ) as HTMLInputElement | null;
                iptal(alan?.value ?? "", true);
              }}
            >
              Para İADE EDİLDİ (ters kayıt)
            </Button>
            <Button
              variant="tehlike"
              size="normal"
              disabled={bekliyor}
              onClick={() => {
                const alan = document.getElementById(
                  `iptal-sebep-${washJobId}`,
                ) as HTMLInputElement | null;
                iptal(alan?.value ?? "", false);
              }}
            >
              Para EL DEĞİŞTİRMEDİ (hatalı kayıt)
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="tehlike"
          size="normal"
          disabled={bekliyor}
          onClick={() => {
            const alan = document.getElementById(
              `iptal-sebep-${washJobId}`,
            ) as HTMLInputElement | null;
            iptal(alan?.value ?? "");
          }}
          data-test="yikama-iptal-onayla"
        >
          {bekliyor ? "…" : "İPTAL ET"}
        </Button>
      )}

      <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
        Vazgeç
      </Button>
    </div>
  );
}
