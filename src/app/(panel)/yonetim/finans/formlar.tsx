"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Input } from "@/components/ui";
import {
  digerGelirIptalAction,
  digerGelirKaydetAction,
  giderIptalAction,
  giderKategorisiOlusturAction,
  giderKaydetAction,
} from "@/server/actions/finans";

export interface KategoriSecenegi {
  id: string;
  ad: string;
}

export interface PersonelSecenegi {
  id: string;
  ad: string;
}

function anahtar(onEk: string): string {
  return `${onEk}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Bugunun tarihi, <input type="date"> icin (Istanbul). */
function bugun(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
}

// ---------------------------------------------------------------------------
// GIDER FORMU
// ---------------------------------------------------------------------------

/**
 * GIDER GIRISI
 *
 * Nakit gider + acik kasa => kasadan dusulur. Bu DAVRANIS personele acikca
 * yazilir, cunku kasa sayimini dogrudan etkiler.
 */
export function GiderFormu({
  kategoriler,
  personeller,
}: {
  kategoriler: KategoriSecenegi[];
  personeller: PersonelSecenegi[];
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [yontem, setYontem] = useState("CASH");
  const [kategoriId, setKategoriId] = useState(kategoriler[0]?.id ?? "");
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  // Personel gideri mi? (maas / avans / prim gibi) -> ilgili personel sorulur.
  const kategoriAdi = kategoriler.find((k) => k.id === kategoriId)?.ad.toLocaleLowerCase("tr-TR") ?? "";
  const personelGideri = /maaş|avans|prim|sigorta|sgk/.test(kategoriAdi);

  if (!acik) {
    return (
      <div className="space-y-2">
        {/* Basari onayi form kapanınca kaybolmaz. */}
        {basari ? <Alert tur="basari" baslik={basari} data-test="gider-basari" /> : null}
        <Button
          variant="birincil"
          size="islem"
          tamGenislik
          onClick={() => setAcik(true)}
          data-test="gider-ekle-ac"
        >
          + GİDER KAYDI
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni gider</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            setBasari(null);
            formData.set("idempotencyKey", anahtar("gider"));
            basla(async () => {
              const sonuc = await giderKaydetAction(formData);
              if (!sonuc.ok) {
                setHata(sonuc.error);
                return;
              }
              setBasari(
                `Gider kaydedildi: ${sonuc.data.kod}` +
                  (sonuc.data.kasaOturumuId ? " · kasadan düşüldü" : ""),
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
              htmlFor="gider-kategori"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Gider kategorisi
            </label>
            <select
              id="gider-kategori"
              name="expenseCategoryId"
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="gider-kategori"
            >
              {kategoriler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </div>

          <Input name="tutar" etiket="Tutar (₺)" inputMode="decimal" required data-test="gider-tutar" />
          <Input
            name="giderTarihi"
            etiket="Gider tarihi"
            type="date"
            defaultValue={bugun()}
            required
            data-test="gider-tarih"
          />

          <div>
            <label
              htmlFor="gider-yontem"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Ödeme yöntemi
            </label>
            <select
              id="gider-yontem"
              name="odemeYontemi"
              value={yontem}
              onChange={(e) => setYontem(e.target.value)}
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="gider-yontem"
            >
              <option value="CASH">Nakit</option>
              <option value="CARD">Kart</option>
              <option value="TRANSFER">Havale / EFT</option>
              <option value="OTHER">Diğer</option>
            </select>
          </div>

          {/* Nakit gider kasayi etkiler: bu secim personele acikca sorulur. */}
          {yontem === "CASH" ? (
            <label className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3">
              <input
                type="checkbox"
                name="kasadanOdendi"
                defaultChecked
                className="h-6 w-6"
                data-test="gider-kasadan"
              />
              <span className="text-sm text-lacivert-800">
                Kasadan ödendi{" "}
                <span className="text-slate-500">
                  (açık kasa varsa beklenen nakitten düşülür)
                </span>
              </span>
            </label>
          ) : null}

          <Input
            name="aciklama"
            etiket="Açıklama (zorunlu)"
            required
            placeholder="Ekim ayı elektrik faturası"
            data-test="gider-aciklama"
          />
          <Input name="tedarikci" etiket="Tedarikçi (isteğe bağlı)" />
          <Input name="belgeNo" etiket="Fatura / belge no (isteğe bağlı)" />

          {personelGideri && personeller.length > 0 ? (
            <div>
              <label
                htmlFor="gider-personel"
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
              >
                İlgili personel
              </label>
              <select
                id="gider-personel"
                name="ilgiliKullaniciId"
                className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
                data-test="gider-personel"
              >
                <option value="">Seçilmedi</option>
                {personeller.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ad}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="gider-kaydet"
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

export function GiderIptalButonu({ id }: { id: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (uyari) return <Alert tur="uyari" baslik="Gider iptal edildi">{uyari}</Alert>;

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="mt-1 text-xs font-bold uppercase text-hata"
        data-test={`gider-iptal-${id}`}
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
        formData.set("expenseId", id);
        basla(async () => {
          const sonuc = await giderIptalAction(formData);
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setAcik(false);
          // Stok hareketleri KASITLI OLARAK geri alinmaz: malzeme fiilen
          // depoya girdiyse iptal onu geri cikarmaz. Kullaniciya soylenir.
          if (sonuc.data.elleDuzeltilmesiGerekenStokHareketi > 0) {
            setUyari(
              `Bu gidere bağlı ${sonuc.data.elleDuzeltilmesiGerekenStokHareketi} stok hareketi var. ` +
                "Malzeme fiilen depoya girdiyse stok DEĞİŞMEDİ; gerekiyorsa sayım düzeltmesi girin.",
            );
          }
          router.refresh();
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
// DIGER GELIR
// ---------------------------------------------------------------------------

export function DigerGelirFormu() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <div className="space-y-2">
        {/* Basari onayi form kapanınca kaybolmaz. */}
        {basari ? <Alert tur="basari" baslik={basari} data-test="gelir-basari" /> : null}
        <Button
          variant="sade"
          size="ikincil"
          tamGenislik
          onClick={() => setAcik(true)}
          data-test="gelir-ekle-ac"
        >
          + Diğer gelir kaydı
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diğer gelir</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            setBasari(null);
            formData.set("idempotencyKey", anahtar("gelir"));
            basla(async () => {
              const sonuc = await digerGelirKaydetAction(formData);
              if (!sonuc.ok) {
                setHata(sonuc.error);
                return;
              }
              setBasari(`Gelir kaydedildi: ${sonuc.data.kod} · tahsilat ${sonuc.data.tahsilatKodu}`);
              setAcik(false);
              router.refresh();
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          {basari ? <Alert tur="basari" baslik={basari} /> : null}
          <Alert tur="bilgi" baslik="Bu kayıt tahsilat üretir">
            Otopark, yıkama ve abonman dışındaki gelirler için. Açık vardiya gerekir;
            nakit ise açık kasaya düşer.
          </Alert>

          <Input
            name="etiket"
            etiket="Gelir ne? (zorunlu)"
            required
            placeholder="Otomat geliri"
            data-test="gelir-etiket"
          />
          <Input name="tutar" etiket="Tutar (₺)" inputMode="decimal" required data-test="gelir-tutar" />
          <Input
            name="gelirTarihi"
            etiket="Tarih"
            type="date"
            defaultValue={bugun()}
            required
            data-test="gelir-tarih"
          />
          <div>
            <label
              htmlFor="gelir-yontem"
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
            >
              Ödeme yöntemi
            </label>
            <select
              id="gelir-yontem"
              name="odemeYontemi"
              className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
              data-test="gelir-yontem"
            >
              <option value="CASH">Nakit</option>
              <option value="CARD">Kart</option>
              <option value="TRANSFER">Havale / EFT</option>
              <option value="OTHER">Diğer</option>
            </select>
          </div>
          <Input name="aciklama" etiket="Açıklama (isteğe bağlı)" />

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="gelir-kaydet"
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

export function GelirIptalButonu({ id }: { id: string }) {
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
        formData.set("otherIncomeId", id);
        formData.set("idempotencyKey", anahtar("gelir-iptal"));
        basla(async () => {
          const sonuc = await digerGelirIptalAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {/*
        CIFTE MUHASEBE TUZAGI: para fiilen iade edildiyse ters kayit uretilir
        ve orijinal tahsilat DURUR; edilmediyse orijinal iptal edilir ve ters
        kayit URETILMEZ. Ikisini birlikte yapmak tutari iki kez duser.
      */}
      <label className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3">
        <input type="checkbox" name="iadeEdildi" className="h-6 w-6" />
        <span className="text-sm text-lacivert-800">
          Para müşteriye fiilen geri verildi
        </span>
      </label>
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
// KATEGORI EKLE
// ---------------------------------------------------------------------------

export function KategoriEkleFormu() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="text-sm font-bold uppercase text-lacivert-600"
        data-test="kategori-ekle-ac"
      >
        + Gider kategorisi ekle
      </button>
    );
  }

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await giderKategorisiOlusturAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input name="ad" etiket="Kategori adı" required data-test="kategori-ad" />
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="birincil" size="normal" disabled={bekliyor} data-test="kategori-kaydet">
          {bekliyor ? "…" : "Ekle"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
