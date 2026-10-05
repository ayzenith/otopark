"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Input } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { formatKurus } from "@/lib/money";
import { formatTime } from "@/lib/datetime";
import {
  kasaAcAction,
  kasaHareketiAction,
  kasaHareketiIptalAction,
  kasaKapatAction,
} from "@/server/actions/kasa";

/**
 * KASA PANELI - personel mobil ekrani
 *
 * ============================================================================
 * TASARIM KARARI: beklenen nakit SAYIM YAPILMADAN ONCE GOSTERILMEZ.
 *
 * Sayim ekraninda "beklenen: 4.250 ₺" yazarsa personel saymadan o sayiyi
 * yazar ve kasa farki hic ortaya cikmaz - sayim anlamsizlasir. Bu yuzden
 * personel once SAYDIGI tutari girer, fark ondan SONRA gosterilir.
 *
 * Kasa dokumu (tahsilat toplamlari) yine gorunur: personelin kendi
 * tahsilatini bilmesi gerekir. Gorunmeyen tek sey BEKLENEN NAKIT toplamidir.
 * ============================================================================
 */

export interface KasaDokumVerisi {
  acilisNakdi: number;
  nakitTahsilat: number;
  nakitIade: number;
  kasaGirisi: number;
  kasaCikisi: number;
  nakitGider: number;
  beklenenNakit: number;
  kartTahsilat: number;
  kartIade: number;
  beklenenKart: number;
  digerTahsilat: number;
}

export interface KasaHareketVerisi {
  id: string;
  tip: string;
  yon: "IN" | "OUT";
  tutar: number;
  aciklama: string;
  at: Date;
  iptal: boolean;
}

const HAREKET_ETIKETLERI: Record<string, string> = {
  DEPOSIT: "Kasaya para konuldu",
  WITHDRAWAL: "Kasadan para alındı",
  BANK_TRANSFER: "Bankaya yatırıldı",
  ADVANCE: "Personel avansı",
  CORRECTION: "Sayım düzeltmesi",
};

function anahtar(onEk: string): string {
  return `${onEk}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// KASA AÇ
// ---------------------------------------------------------------------------

export function KasaAcKarti() {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa kapalı</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            basla(async () => {
              const sonuc = await kasaAcAction(formData);
              if (!sonuc.ok) setHata(sonuc.error);
              else router.refresh();
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          <Alert tur="bilgi" baslik="Kasa açılmadan da tahsilat yapılabilir">
            Ancak o tahsilatlar hiçbir kasa sayımına girmez ve patron panelinde
            &quot;kasa dışı tahsilat&quot; olarak görünür.
          </Alert>
          <Input
            name="acilisNakdi"
            etiket="Kasadaki başlangıç parası (₺)"
            inputMode="decimal"
            placeholder="0"
            yardim="Kasada duran bozuk para. Yoksa boş bırakın."
            data-test="kasa-acilis-nakdi"
          />
          <Input name="not" etiket="Not (isteğe bağlı)" placeholder="Devreden kasa" />
          <Button
            type="submit"
            variant="birincil"
            size="islem"
            tamGenislik
            disabled={bekliyor}
            data-test="kasa-ac"
          >
            {bekliyor ? "Açılıyor…" : "KASAYI AÇ"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AÇIK KASA
// ---------------------------------------------------------------------------

export function AcikKasaPaneli({
  kasaId,
  acilisAt,
  acanKisi,
  dokum,
  hareketler,
  hareketYetkisi,
  kapatmaYetkisi,
  iptalYetkisi,
}: {
  kasaId: string;
  acilisAt: Date;
  acanKisi: string;
  dokum: KasaDokumVerisi;
  hareketler: KasaHareketVerisi[];
  hareketYetkisi: boolean;
  kapatmaYetkisi: boolean;
  iptalYetkisi: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Kasa açık</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-sm text-slate-500">
            {formatTime(acilisAt)}&apos;den beri · açan: {acanKisi}
          </p>
          <dl className="space-y-1.5 text-sm">
            <Satir etiket="Açılış parası" kurus={dokum.acilisNakdi} />
            <Satir etiket="Nakit tahsilat" kurus={dokum.nakitTahsilat} />
            {dokum.nakitIade > 0 ? (
              <Satir etiket="Nakit iade" kurus={-dokum.nakitIade} />
            ) : null}
            {dokum.kasaGirisi > 0 ? (
              <Satir etiket="Kasaya eklenen" kurus={dokum.kasaGirisi} />
            ) : null}
            {dokum.kasaCikisi > 0 ? (
              <Satir etiket="Kasadan çıkan" kurus={-dokum.kasaCikisi} />
            ) : null}
            {dokum.nakitGider > 0 ? (
              <Satir etiket="Nakit gider" kurus={-dokum.nakitGider} />
            ) : null}
            <div className="border-t border-slate-200 pt-1.5">
              <Satir etiket="Kart tahsilat" kurus={dokum.beklenenKart} />
              {dokum.digerTahsilat !== 0 ? (
                <Satir etiket="Diğer yöntem" kurus={dokum.digerTahsilat} />
              ) : null}
            </div>
          </dl>
          {/*
            BEKLENEN NAKIT TOPLAMI BILEREK YAZILMAZ: personel saymadan o sayiyi
            kopyalarsa kasa farki hic gorunmez. Sayimdan sonra gosterilir.
          */}
          <p className="mt-3 text-xs text-slate-500">
            Beklenen nakit, sayımı yaptıktan sonra gösterilir.
          </p>
        </CardBody>
      </Card>

      {hareketYetkisi ? <HareketFormu kasaId={kasaId} /> : null}

      {hareketler.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Kasa hareketleri</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {hareketler.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-lacivert-700">
                      {HAREKET_ETIKETLERI[h.tip] ?? h.tip}
                      {h.iptal ? (
                        <span className="ml-2 text-xs font-bold text-hata">İPTAL</span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {formatTime(h.at)} · {h.aciklama}
                    </div>
                    {iptalYetkisi && !h.iptal ? <HareketIptalButonu id={h.id} /> : null}
                  </div>
                  <span
                    className={`rakam shrink-0 text-sm font-bold ${
                      h.iptal ? "text-slate-400 line-through" : h.yon === "IN" ? "text-basari" : "text-hata"
                    }`}
                  >
                    {h.yon === "IN" ? "+" : "−"}
                    {formatKurus(h.tutar)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {kapatmaYetkisi ? <KasaKapatFormu kasaId={kasaId} /> : null}
    </div>
  );
}

function Satir({ etiket, kurus }: { etiket: string; kurus: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{etiket}</dt>
      <dd>
        <Tutar kurus={kurus} boyut="kucuk" />
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HAREKET FORMU
// ---------------------------------------------------------------------------

function HareketFormu({ kasaId }: { kasaId: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [tip, setTip] = useState("WITHDRAWAL");
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <div className="space-y-2">
        {/* Basari onayi form kapanınca kaybolmaz (bkz. stok formu notu). */}
        {basari ? (
          <Alert tur="basari" baslik={basari} data-test="kasa-hareket-basari" />
        ) : null}
        <Button
          variant="sade"
          size="ikincil"
          tamGenislik
          onClick={() => setAcik(true)}
          data-test="kasa-hareket-ac"
        >
          + Kasa hareketi ekle
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa hareketi</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            setBasari(null);
            formData.set("cashDrawerSessionId", kasaId);
            formData.set("idempotencyKey", anahtar("hareket"));
            basla(async () => {
              const sonuc = await kasaHareketiAction(formData);
              if (!sonuc.ok) setHata(sonuc.error);
              else {
                setBasari("Kasa hareketi kaydedildi.");
                setAcik(false);
                router.refresh();
              }
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          {basari ? <Alert tur="basari" baslik={basari} /> : null}

          <div>
            <label
              htmlFor="hareket-tip"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Hareket türü
            </label>
            <select
              id="hareket-tip"
              name="tip"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="hareket-tip"
            >
              <option value="WITHDRAWAL">Kasadan para alındı</option>
              <option value="DEPOSIT">Kasaya para konuldu</option>
              <option value="BANK_TRANSFER">Bankaya yatırıldı</option>
              <option value="ADVANCE">Personel avansı</option>
              <option value="CORRECTION">Sayım düzeltmesi</option>
            </select>
          </div>

          {/* CORRECTION'un dogal yonu yoktur: acikca sorulur. */}
          {tip === "CORRECTION" ? (
            <div>
              <label
                htmlFor="hareket-yon"
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
              >
                Para kasaya mı girdi, kasadan mı çıktı?
              </label>
              <select
                id="hareket-yon"
                name="yon"
                className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
                data-test="hareket-yon"
              >
                <option value="IN">Kasaya girdi (fazla çıktı)</option>
                <option value="OUT">Kasadan çıktı (eksik çıktı)</option>
              </select>
            </div>
          ) : null}

          <Input
            name="tutar"
            etiket="Tutar (₺)"
            inputMode="decimal"
            required
            data-test="hareket-tutar"
          />
          <Input
            name="aciklama"
            etiket="Açıklama (zorunlu)"
            required
            placeholder="Bankaya yatırıldı — dekont 4471"
            data-test="hareket-aciklama"
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="hareket-kaydet"
            >
              {bekliyor ? "Kaydediliyor…" : "KAYDET"}
            </Button>
            <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function HareketIptalButonu({ id }: { id: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="mt-1 text-xs font-bold uppercase text-hata"
      >
        İptal et
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      action={(formData) => {
        setHata(null);
        formData.set("cashMovementId", id);
        basla(async () => {
          const sonuc = await kasaHareketiIptalAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input name="sebep" etiket="İptal gerekçesi (zorunlu)" required />
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="tehlike" size="normal" disabled={bekliyor}>
          {bekliyor ? "…" : "İptal et"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// KASA KAPAT (SAYIM)
// ---------------------------------------------------------------------------

function KasaKapatFormu({ kasaId }: { kasaId: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [farkSorulacak, setFarkSorulacak] = useState(false);
  const [bekliyor, basla] = useTransition();

  /**
   * ALANLAR KONTROLLU TUTULUR (React durumunda).
   *
   * React 19'da `<form action={fn}>` islem bittikten sonra formu SIFIRLAR.
   * Alanlar kontrolsuz birakilirsa, "fark gerekcesi zorunlu" hatasindan
   * sonra personelin AZ ONCE SAYDIGI nakit de silinir ve her seyi yeniden
   * yazmasi gerekir - telefonda kullanilamaz (E2E'de yasandi). Degerler
   * durumda tutulunca hata sonrasi ekranda kalir.
   */
  const [alanlar, setAlanlar] = useState({
    sayilanNakit: "",
    beyanEdilenKart: "",
    farkSebebi: "",
    not: "",
  });

  const degistir = (ad: keyof typeof alanlar) => (e: { target: { value: string } }) =>
    setAlanlar((o) => ({ ...o, [ad]: e.target.value }));

  // KAPANIS SONRASI OZET BURADA TUTULMAZ.
  //
  // Kapanis Server Action'i revalidatePath cagirir; sayfa kendiliginden
  // tazelenir ve kasa kapandigi icin bu panel agactan duser. Kalici ozet
  // /kasa sayfasinda SUNUCUDAN okunur ("Son kasa kapanışı" karti).

  if (!acik) {
    return (
      <Button
        variant="uyari"
        size="islem"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="kasa-kapat-ac"
      >
        KASAYI SAY VE KAPAT
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa sayımı</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={() => {
            setHata(null);
            basla(async () => {
              const cevap = await kasaKapatAction({
                cashDrawerSessionId: kasaId,
                sayilanNakit: alanlar.sayilanNakit,
                beyanEdilenKart: alanlar.beyanEdilenKart,
                farkSebebi: alanlar.farkSebebi,
                not: alanlar.not,
              });
              if (!cevap.ok) {
                setHata(cevap.error);
                // Sunucu "gerekce zorunlu" dediyse gerekce alanini one cikar.
                if (cevap.code === "FARK_SEBEBI") setFarkSorulacak(true);
                return;
              }
              // Ozet sunucudan gelir; burada yalnizca sayfa tazelenir.
              router.refresh();
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          <Alert tur="bilgi" baslik="Önce parayı sayın">
            Beklenen tutar bilerek gösterilmiyor; saymadan yazılan rakam kasa farkını
            görünmez yapar.
          </Alert>

          <Input
            name="sayilanNakit"
            etiket="Saydığınız nakit (₺)"
            inputMode="decimal"
            required
            value={alanlar.sayilanNakit}
            onChange={degistir("sayilanNakit")}
            data-test="sayilan-nakit"
          />
          <Input
            name="beyanEdilenKart"
            etiket="POS dekont toplamı (₺) — isteğe bağlı"
            inputMode="decimal"
            yardim="Girerseniz sistemdeki kart tahsilatıyla karşılaştırılır."
            value={alanlar.beyanEdilenKart}
            onChange={degistir("beyanEdilenKart")}
            data-test="beyan-kart"
          />
          <Input
            name="farkSebebi"
            etiket={
              farkSorulacak ? "Fark gerekçesi (ZORUNLU)" : "Fark gerekçesi (fark varsa zorunlu)"
            }
            placeholder="Müşteriye yanlış para üstü verildi"
            value={alanlar.farkSebebi}
            onChange={degistir("farkSebebi")}
            data-test="fark-sebebi"
          />
          <Input
            name="not"
            etiket="Not (isteğe bağlı)"
            value={alanlar.not}
            onChange={degistir("not")}
          />

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="uyari"
              size="ikincil"
              disabled={bekliyor}
              data-test="kasa-kapat"
            >
              {bekliyor ? "Kapatılıyor…" : "KASAYI KAPAT"}
            </Button>
            <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
