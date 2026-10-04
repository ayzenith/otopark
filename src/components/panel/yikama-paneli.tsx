"use client";

/**
 * PERSONEL YIKAMA PANELI
 *
 * Mobil kullanim hedefi:
 *   1. Plaka gir
 *   2. Araç tipini seç (yıkama fiyatı buna bağlı — otopark için değil)
 *   3. Hizmetleri işaretle (fiyatlar ekranda yazılı)
 *   4. Kaydet → iş sıraya girer
 *   5. Kuyruktan tek dokunuşla "Yıkamaya al" / "Tamamla"
 *
 * Araç tipi seçimi burada GOSTERILIR cunku yikama fiyati sinifa baglidir.
 * Otopark girisinde ise sinif gizli kalir (orada fiyat farki yoktur).
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, PlakaInput, Rozet } from "@/components/ui";
import { Tutar } from "./para";
import {
  yikamaDurumAction,
  yikamaOlusturAction,
} from "@/server/actions/yikama";
import { formatKurusPlain } from "@/lib/money";
import { formatTime } from "@/lib/datetime";

export interface YikamaHizmetSecenegi {
  washServiceId: string;
  ad: string;
  tahminiDakika: number | null;
  /** null = bu araç sınıfı için fiyat tanımlı değil. */
  fiyatKurus: number | null;
}

export interface YikamaSinifi {
  id: string;
  ad: string;
}

export interface KuyrukSatiri {
  id: string;
  kod: string;
  plaka: string;
  aracSinifi: string;
  durum: string;
  siradaBeri: string;
  hizmetler: string[];
  toplamKurus: number;
  odemeDurumu: string;
  fiyatTanimsizMi: boolean;
  atananKisi: string | null;
}

type Durum =
  | { ad: "kuyruk" }
  | { ad: "yeni" }
  | { ad: "yukleniyor" }
  | { ad: "hata"; mesaj: string; kod?: string }
  | { ad: "onay"; kod: string; plaka: string; toplamKurus: number; fiyatTanimsiz: boolean };

function yeniAnahtar(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function YikamaPaneli({
  vardiyaAcik,
  siniflar,
  varsayilanSinifId,
  hizmetler,
  kuyruk,
  olusturabilir,
  durumDegistirebilir,
  tahsilEdebilir,
}: {
  vardiyaAcik: boolean;
  siniflar: YikamaSinifi[];
  varsayilanSinifId: string | null;
  /** Araç sınıfı → hizmet listesi (fiyatlar sınıfa göre değişir). */
  hizmetler: Record<string, YikamaHizmetSecenegi[]>;
  kuyruk: KuyrukSatiri[];
  olusturabilir: boolean;
  durumDegistirebilir: boolean;
  tahsilEdebilir: boolean;
}) {
  const router = useRouter();
  const [durum, setDurum] = useState<Durum>({ ad: "kuyruk" });
  const [plaka, setPlaka] = useState("");
  const [sinifId, setSinifId] = useState<string | null>(varsayilanSinifId);
  const [secili, setSecili] = useState<string[]>([]);
  const [zorla, setZorla] = useState<{ bicim?: boolean; fiyatsiz?: boolean }>({});
  const [bekliyor, basla] = useTransition();

  const mesgul = durum.ad === "yukleniyor" || bekliyor;
  const aktifHizmetler = sinifId ? (hizmetler[sinifId] ?? []) : [];
  const toplam = aktifHizmetler
    .filter((h) => secili.includes(h.washServiceId))
    .reduce((t, h) => t + (h.fiyatKurus ?? 0), 0);
  const secilenlerdeFiyatsiz = aktifHizmetler.some(
    (h) => secili.includes(h.washServiceId) && h.fiyatKurus === null,
  );

  const sifirla = useCallback(() => {
    setDurum({ ad: "kuyruk" });
    setPlaka("");
    setSecili([]);
    setZorla({});
    setSinifId(varsayilanSinifId);
    router.refresh();
  }, [router, varsayilanSinifId]);

  // Basari onayi kendini kapatir; personel beklemez.
  useEffect(() => {
    if (durum.ad !== "onay") return;
    const zaman = setTimeout(sifirla, 4000);
    return () => clearTimeout(zaman);
  }, [durum.ad, sifirla]);

  async function kaydet(ek?: { bicim?: boolean; fiyatsiz?: boolean }) {
    if (!plaka.trim() || secili.length === 0 || !sinifId || mesgul) return;
    setDurum({ ad: "yukleniyor" });

    const sonuc = await yikamaOlusturAction({
      plaka,
      aracSinifiId: sinifId,
      hizmetler: secili.map((id) => ({ washServiceId: id })),
      bicimiZorla: ek?.bicim ?? zorla.bicim,
      fiyatsizDevam: ek?.fiyatsiz ?? zorla.fiyatsiz,
      idempotencyKey: yeniAnahtar(),
    });

    if (!sonuc.ok) {
      setDurum({ ad: "hata", mesaj: sonuc.error, kod: sonuc.code });
      if (sonuc.code === "PLAKA_BICIMI") setZorla((z) => ({ ...z, bicim: true }));
      if (sonuc.code === "FIYAT_TANIMSIZ") setZorla((z) => ({ ...z, fiyatsiz: true }));
      return;
    }

    setDurum({
      ad: "onay",
      kod: sonuc.data.kod,
      plaka: sonuc.data.plakaGosterim,
      toplamKurus: sonuc.data.toplamKurus,
      fiyatTanimsiz: sonuc.data.fiyatTanimsiz,
    });
  }

  function durumDegistir(washJobId: string, yeniDurum: "IN_PROGRESS" | "COMPLETED") {
    basla(async () => {
      const sonuc = await yikamaDurumAction({ washJobId, yeniDurum });
      if (!sonuc.ok) {
        setDurum({ ad: "hata", mesaj: sonuc.error, kod: sonuc.code });
        return;
      }
      router.refresh();
    });
  }

  // ---- ONAY EKRANI ----
  if (durum.ad === "onay") {
    return (
      <div
        className="rounded-2xl border-2 border-green-300 bg-basari-acik p-5 text-center"
        role="status"
        data-test="yikama-onay"
      >
        <div className="text-5xl" aria-hidden>
          ✓
        </div>
        <div className="mt-2 text-2xl font-extrabold text-green-900">YIKAMA SIRAYA ALINDI</div>
        <div className="mt-3 font-mono text-3xl font-bold tracking-wider text-lacivert-800">
          {durum.plaka}
        </div>
        <div className="mt-2">
          <Tutar kurus={durum.toplamKurus} boyut="buyuk" />
        </div>
        <div className="mt-1 text-xs text-green-800">İş no: {durum.kod}</div>

        {durum.fiyatTanimsiz ? (
          <Alert tur="uyari" baslik="Fiyatı tanımsız hizmet 0 ₺ kaydedildi" className="mt-4 text-left">
            Patron panelinden bu hizmetin fiyatı girilmeli.
          </Alert>
        ) : null}

        <Button variant="birincil" size="islem" tamGenislik className="mt-5" onClick={sifirla}>
          YENİ İŞLEM
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!vardiyaAcik ? (
        <Alert tur="uyari" baslik="Vardiyanız açık değil">
          İşlem yapabilmek için önce vardiyanızı başlatın.
        </Alert>
      ) : null}

      {durum.ad === "hata" ? (
        <Alert tur="hata" baslik={durum.mesaj} data-test="yikama-hata">
          <div className="mt-2 flex flex-wrap gap-2">
            {durum.kod === "PLAKA_BICIMI" ? (
              <Button
                size="normal"
                variant="uyari"
                onClick={() => kaydet({ bicim: true })}
                disabled={mesgul}
              >
                Yine de kaydet
              </Button>
            ) : null}
            {durum.kod === "FIYAT_TANIMSIZ" ? (
              <Button
                size="normal"
                variant="uyari"
                onClick={() => kaydet({ bicim: true, fiyatsiz: true })}
                disabled={mesgul}
                data-test="fiyatsiz-devam"
              >
                0 ₺ olarak kaydet
              </Button>
            ) : null}
            <Button size="normal" variant="sade" onClick={() => setDurum({ ad: "kuyruk" })}>
              Kapat
            </Button>
          </div>
        </Alert>
      ) : null}

      {/* ---- YENI YIKAMA FORMU ---- */}
      {durum.ad === "yeni" || durum.ad === "yukleniyor" || durum.ad === "hata" ? (
        <div className="space-y-3 rounded-2xl border-2 border-lacivert-200 bg-white p-4">
          <PlakaInput
            value={plaka}
            onChange={(e) => setPlaka(e.target.value)}
            disabled={!vardiyaAcik || mesgul}
            data-test="yikama-plaka"
          />

          {/* Araç tipi: yıkama fiyatı buna bağlı olduğu için AÇIKÇA sorulur. */}
          <div>
            <div className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-slate-600">
              Araç tipi (yıkama fiyatı buna göre)
            </div>
            <div className="flex flex-wrap gap-2">
              {siniflar.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSinifId(s.id);
                    setSecili([]);
                  }}
                  className={`h-12 rounded-xl border-2 px-3 text-base font-bold ${
                    sinifId === s.id
                      ? "border-lacivert-600 bg-lacivert-600 text-white"
                      : "border-slate-300 bg-white text-lacivert-700"
                  }`}
                  data-test={`yikama-sinif-${s.id}`}
                >
                  {s.ad}
                </button>
              ))}
            </div>
          </div>

          {/* Hizmetler: fiyatlar ekranda yazılı, personel müşteriye söyleyebilir. */}
          <div>
            <div className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-slate-600">
              Hizmetler
            </div>
            {aktifHizmetler.length === 0 ? (
              <Alert tur="uyari" baslik="Yıkama hizmeti tanımlı değil">
                Patron panelinden hizmet ve fiyat girilmeli.
              </Alert>
            ) : (
              <ul className="space-y-2" data-test="yikama-hizmetleri">
                {aktifHizmetler.map((h) => {
                  const isaretli = secili.includes(h.washServiceId);
                  return (
                    <li key={h.washServiceId}>
                      <button
                        type="button"
                        onClick={() =>
                          setSecili((s) =>
                            isaretli
                              ? s.filter((x) => x !== h.washServiceId)
                              : [...s, h.washServiceId],
                          )
                        }
                        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 px-3 text-left ${
                          isaretli
                            ? "border-lacivert-600 bg-mavi-50"
                            : "border-slate-300 bg-white"
                        }`}
                        data-test={`hizmet-${h.washServiceId}`}
                      >
                        <span className="min-w-0">
                          <span className="block font-bold text-lacivert-700">
                            {isaretli ? "✓ " : ""}
                            {h.ad}
                          </span>
                          {h.tahminiDakika ? (
                            <span className="block text-xs text-slate-500">
                              ~{h.tahminiDakika} dk
                            </span>
                          ) : null}
                        </span>
                        <span className="rakam shrink-0 font-bold text-lacivert-800">
                          {h.fiyatKurus === null ? (
                            <span className="text-sm text-uyari">fiyat girilmemiş</span>
                          ) : (
                            `${formatKurusPlain(h.fiyatKurus)} ₺`
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {secili.length > 0 ? (
            <div className="rounded-xl bg-lacivert-600 px-4 py-3 text-center text-white">
              <div className="text-[11px] font-bold uppercase tracking-wide text-mavi-200">
                Yıkama toplamı
              </div>
              <div className="mt-1" data-test="yikama-toplam">
                <Tutar kurus={toplam} boyut="buyuk" />
              </div>
              {secilenlerdeFiyatsiz ? (
                <div className="mt-1 text-xs font-bold text-amber-200">
                  Fiyatı girilmemiş hizmet var
                </div>
              ) : null}
            </div>
          ) : null}

          <Button
            variant="basari"
            size="islem"
            tamGenislik
            onClick={() => kaydet()}
            disabled={!vardiyaAcik || mesgul || !plaka.trim() || secili.length === 0}
            data-test="yikama-kaydet"
          >
            {mesgul ? "…" : "✓ SIRAYA AL"}
          </Button>
          <Button
            variant="sade"
            size="ikincil"
            tamGenislik
            onClick={() => setDurum({ ad: "kuyruk" })}
            disabled={mesgul}
          >
            Vazgeç
          </Button>
        </div>
      ) : olusturabilir ? (
        <Button
          variant="birincil"
          size="islem"
          tamGenislik
          onClick={() => setDurum({ ad: "yeni" })}
          disabled={!vardiyaAcik}
          data-test="yeni-yikama"
        >
          + YENİ YIKAMA
        </Button>
      ) : null}

      {/* ---- KUYRUK ---- */}
      <div>
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-600">
          Yıkama kuyruğu ({kuyruk.length})
        </h2>
        {kuyruk.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            Kuyrukta araç yok.
          </p>
        ) : (
          <ul className="space-y-2" data-test="yikama-kuyrugu">
            {kuyruk.map((i) => (
              <li
                key={i.id}
                className="rounded-2xl border-2 border-slate-200 bg-white p-3"
                data-test={`kuyruk-${i.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xl font-bold tracking-wider text-lacivert-800">
                      {i.plaka}
                    </div>
                    <div className="text-sm text-slate-500">
                      {i.aracSinifi} · {formatTime(new Date(i.siradaBeri))}
                    </div>
                    <div className="truncate text-sm text-lacivert-700">
                      {i.hizmetler.join(" + ")}
                    </div>
                    {i.atananKisi ? (
                      <div className="text-xs text-slate-400">{i.atananKisi}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <Rozet tur={i.durum === "IN_PROGRESS" ? "mavi" : "notr"}>
                      {i.durum === "IN_PROGRESS" ? "YIKAMADA" : "SIRADA"}
                    </Rozet>
                    <div className="mt-1">
                      <Tutar kurus={i.toplamKurus} boyut="kucuk" />
                    </div>
                    {i.fiyatTanimsizMi ? (
                      <div className="text-[11px] font-bold text-uyari">fiyat yok</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {durumDegistirebilir && i.durum === "QUEUED" ? (
                    <Button
                      variant="ikincil"
                      size="ikincil"
                      onClick={() => durumDegistir(i.id, "IN_PROGRESS")}
                      disabled={mesgul}
                      data-test={`yikamaya-al-${i.id}`}
                    >
                      YIKAMAYA AL
                    </Button>
                  ) : null}
                  {durumDegistirebilir && i.durum === "IN_PROGRESS" ? (
                    <Button
                      variant="basari"
                      size="ikincil"
                      onClick={() => durumDegistir(i.id, "COMPLETED")}
                      disabled={mesgul}
                      data-test={`tamamla-${i.id}`}
                    >
                      TAMAMLA
                    </Button>
                  ) : null}
                  <Link href={`/yikama/${i.id}`} className="block">
                    <Button variant="sade" size="ikincil" tamGenislik>
                      {tahsilEdebilir ? "DETAY / TAHSİLAT" : "DETAY"}
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
