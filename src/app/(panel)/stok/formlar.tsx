"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Input } from "@/components/ui";
import {
  malzemeDurumAction,
  malzemeOlusturAction,
  stokHareketiAction,
} from "@/server/actions/stok";

const BIRIM_ETIKETLERI: Record<string, string> = {
  ADET: "adet",
  LITRE: "litre",
  KG: "kg",
};

function anahtar(onEk: string): string {
  return `${onEk}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function miktarMetni(sayi: number): string {
  return sayi.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

export interface MalzemeSecenegi {
  id: string;
  ad: string;
  birim: string;
  stok: number;
}

export interface GiderSecenegi {
  id: string;
  kod: string;
  etiket: string;
}

// ---------------------------------------------------------------------------
// STOK HAREKETI
// ---------------------------------------------------------------------------

/**
 * STOK HAREKETI FORMU
 *
 * Tek ekranda alis / tuketim / zayi / sayim duzeltmesi. Secilen malzemenin
 * ELDEKI STOGU hemen yanda gosterilir: personel "5 litre dus" yazmadan once
 * elde 3 litre oldugunu gorur. Yine de son soz sunucunundur - stok negatife
 * dusuremez.
 */
export function StokHareketFormu({
  malzemeler,
  giderler,
}: {
  malzemeler: MalzemeSecenegi[];
  giderler: GiderSecenegi[];
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [tip, setTip] = useState("CONSUMPTION");
  const [malzemeId, setMalzemeId] = useState(malzemeler[0]?.id ?? "");
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const secili = malzemeler.find((m) => m.id === malzemeId);

  if (malzemeler.length === 0) {
    return (
      <Alert tur="bilgi" baslik="Henüz malzeme kartı yok">
        Stok hareketi girmek için önce malzeme kartı ekleyin.
      </Alert>
    );
  }

  if (!acik) {
    return (
      <div className="space-y-2">
        {/*
          BASARI ONAYI FORM KAPANINCA KAYBOLMAZ.
          Mesaj yalnizca formun icinde cizilirse, kaydetmeden sonra form
          kapandigi an "yeni stok 19,75" onayi da ekrandan siliniyordu;
          personel islemin gerceklestigini goremiyordu (E2E'de yasandi).
        */}
        {basari ? (
          <Alert tur="basari" baslik={basari} data-test="stok-basari" />
        ) : null}
        <Button
          variant="birincil"
          size="islem"
          tamGenislik
          onClick={() => setAcik(true)}
          data-test="stok-hareket-ac"
        >
          + STOK HAREKETİ
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stok hareketi</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            setBasari(null);
            formData.set("idempotencyKey", anahtar("stok"));
            basla(async () => {
              const sonuc = await stokHareketiAction(formData);
              if (!sonuc.ok) {
                setHata(sonuc.error);
                return;
              }
              setBasari(
                `${sonuc.data.malzemeAdi}: yeni stok ${miktarMetni(sonuc.data.yeniStok)}` +
                  (sonuc.data.kritikStokUyarisi ? " — ASGARİ STOĞUN ALTINDA!" : ""),
              );
              setAcik(false);
              router.refresh();
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          {basari ? <Alert tur="basari" baslik={basari} /> : null}

          <div>
            <label
              htmlFor="stok-malzeme"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Malzeme
            </label>
            <select
              id="stok-malzeme"
              name="inventoryItemId"
              value={malzemeId}
              onChange={(e) => setMalzemeId(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="stok-malzeme"
            >
              {malzemeler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ad}
                </option>
              ))}
            </select>
            {secili ? (
              <p className="mt-1 text-sm text-slate-500" data-test="stok-eldeki">
                Elde: <strong className="rakam">{miktarMetni(secili.stok)}</strong>{" "}
                {BIRIM_ETIKETLERI[secili.birim] ?? secili.birim}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="stok-tip"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Hareket türü
            </label>
            <select
              id="stok-tip"
              name="tip"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="stok-tip"
            >
              <option value="CONSUMPTION">Tüketim (stoktan düşer)</option>
              <option value="PURCHASE">Alış (stoğa ekler)</option>
              <option value="WASTE">Zayi (döküldü, bozuldu)</option>
              <option value="ADJUSTMENT">Sayım düzeltmesi (stoğa ekler)</option>
            </select>
          </div>

          <Input
            name="miktar"
            etiket={`Miktar (${secili ? (BIRIM_ETIKETLERI[secili.birim] ?? secili.birim) : ""})`}
            inputMode="decimal"
            required
            placeholder="0,250"
            data-test="stok-miktar"
          />

          {/* Birim maliyet ve gider baglantisi YALNIZCA alista anlamlidir. */}
          {tip === "PURCHASE" ? (
            <>
              <Input
                name="birimMaliyet"
                etiket="Birim maliyet (₺) — isteğe bağlı"
                inputMode="decimal"
                yardim="Bu alıştaki birim fiyat. Her alışta değişebilir."
                data-test="stok-birim-maliyet"
              />
              {giderler.length > 0 ? (
                <div>
                  <label
                    htmlFor="stok-gider"
                    className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    Gider kaydına bağla (isteğe bağlı)
                  </label>
                  <select
                    id="stok-gider"
                    name="expenseId"
                    className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
                    data-test="stok-gider"
                  >
                    <option value="">Bağlama</option>
                    {giderler.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.kod} — {g.etiket}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-slate-500">
                    Alışın parası gider olarak kaydedildiyse burada bağlayın; para iki
                    kez yazılmaz, yalnızca bağlantı kurulur.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          <Input name="not" etiket="Not (isteğe bağlı)" data-test="stok-not" />

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="stok-kaydet"
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

// ---------------------------------------------------------------------------
// MALZEME KARTI
// ---------------------------------------------------------------------------

export function MalzemeEkleFormu() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button
        variant="sade"
        size="ikincil"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="malzeme-ekle-ac"
      >
        + Malzeme kartı ekle
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni malzeme</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            basla(async () => {
              const sonuc = await malzemeOlusturAction(formData);
              if (!sonuc.ok) setHata(sonuc.error);
              else {
                setAcik(false);
                router.refresh();
              }
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          <Input name="ad" etiket="Malzeme adı" required data-test="malzeme-ad" />
          <div>
            <label
              htmlFor="malzeme-birim"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Birim
            </label>
            <select
              id="malzeme-birim"
              name="birim"
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="malzeme-birim"
            >
              <option value="LITRE">litre</option>
              <option value="ADET">adet</option>
              <option value="KG">kg</option>
            </select>
            <p className="mt-1 text-sm text-slate-500">
              Birim sonradan değiştirilemez: geçmiş hareketler bu birimle yazılır.
            </p>
          </div>
          <Input
            name="asgariStok"
            etiket="Asgari stok (isteğe bağlı)"
            inputMode="decimal"
            yardim="Stok bu miktara düşünce uyarı verilir. Boş = uyarı yok."
            data-test="malzeme-asgari"
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="malzeme-kaydet"
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

/** Malzemeyi kullanim dışına alir / geri acar. SILMEZ. */
export function MalzemeDurumButonu({ id, aktif }: { id: string; aktif: boolean }) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <div>
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <button
        type="button"
        disabled={bekliyor}
        className="text-xs font-bold uppercase text-slate-500"
        onClick={() =>
          basla(async () => {
            setHata(null);
            const sonuc = await malzemeDurumAction({ id, aktif: !aktif });
            if (!sonuc.ok) setHata(sonuc.error);
            else router.refresh();
          })
        }
      >
        {bekliyor ? "…" : aktif ? "Kullanım dışına al" : "Geri aç"}
      </button>
    </div>
  );
}
