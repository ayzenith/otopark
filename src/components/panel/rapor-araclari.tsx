"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { DONEMLER, DONEM_ETIKETLERI, type Donem } from "@/server/reports/range";

/**
 * TARİH ARALIĞI FİLTRESİ
 *
 * Çipler URL'e yazılır (`?donem=ay`), böylece patron bir dönemi işaretleyip
 * sayfayı paylaşabilir/yer imine ekleyebilir ve geri tuşu beklendiği gibi
 * çalışır. Sunucu bileşeni aynı parametreyi okuyup veriyi üretir.
 *
 * Çipler sarmalanır (flex-wrap): mobilde yatay kaydırma olmaz.
 */
export function DonemFiltresi({
  aktif,
  baslangic,
  bitis,
}: {
  aktif: Donem;
  baslangic: string | null;
  bitis: string | null;
}) {
  const router = useRouter();
  const yol = usePathname();
  const parametreler = useSearchParams();
  const [ozelAcik, setOzelAcik] = useState(aktif === "ozel");

  function donemSec(donem: Donem) {
    const yeni = new URLSearchParams(parametreler.toString());
    yeni.set("donem", donem);
    if (donem !== "ozel") {
      yeni.delete("baslangic");
      yeni.delete("bitis");
      setOzelAcik(false);
    } else {
      setOzelAcik(true);
    }
    router.push(`${yol}?${yeni.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tarih aralığı">
        {DONEMLER.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => donemSec(d)}
            aria-pressed={aktif === d}
            className={`flex h-12 items-center rounded-xl border px-3 text-sm font-semibold ${
              aktif === d
                ? "border-lacivert-600 bg-lacivert-600 text-white"
                : "border-slate-300 bg-white text-lacivert-700"
            }`}
            data-test={`donem-${d}`}
          >
            {DONEM_ETIKETLERI[d]}
          </button>
        ))}
      </div>

      {ozelAcik ? (
        <form
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          action={(formData) => {
            const yeni = new URLSearchParams(parametreler.toString());
            yeni.set("donem", "ozel");
            yeni.set("baslangic", String(formData.get("baslangic") ?? ""));
            yeni.set("bitis", String(formData.get("bitis") ?? ""));
            router.push(`${yol}?${yeni.toString()}`);
          }}
        >
          <Input
            name="baslangic"
            etiket="Başlangıç"
            type="date"
            defaultValue={baslangic ?? ""}
            data-test="ozel-baslangic"
          />
          <Input
            name="bitis"
            etiket="Bitiş (dahil)"
            type="date"
            defaultValue={bitis ?? ""}
            data-test="ozel-bitis"
          />
          <div className="flex items-end">
            <Button type="submit" variant="birincil" size="normal" tamGenislik data-test="ozel-uygula">
              UYGULA
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * 30 GÜNLÜK GELİR TRENDİ — satır içi SVG.
 *
 * Grafik kütüphanesi EKLENMEDİ: tek bir çizgi grafiği için bağımlılık
 * eklemek, mobil paket boyutunu gereksiz büyütür. Üç seri (otopark, yıkama,
 * abonman) ayrı çizgi olarak çizilir (mimari kural 11: tek "ciro" yok).
 *
 * Renge DEĞİL hem renge hem de etikete dayanır; renk körlüğünde de okunur.
 */
export function TrendGrafigi({
  noktalar,
}: {
  noktalar: { gun: string; park: number; yikama: number; abonman: number }[];
}) {
  if (noktalar.length === 0) {
    return <p className="text-sm text-slate-500">Gösterilecek veri yok.</p>;
  }

  const G = 320; // viewBox genişliği
  const Y = 120; // viewBox yüksekliği
  const dolgu = 4;

  const enYuksek = Math.max(
    1,
    ...noktalar.map((n) => Math.max(n.park, n.yikama, n.abonman)),
  );

  const x = (i: number) =>
    noktalar.length === 1 ? G / 2 : dolgu + (i * (G - 2 * dolgu)) / (noktalar.length - 1);
  const y = (deger: number) => Y - dolgu - (deger / enYuksek) * (Y - 2 * dolgu);

  const cizgi = (sec: (n: (typeof noktalar)[number]) => number) =>
    noktalar.map((n, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(sec(n)).toFixed(1)}`).join(" ");

  const seriler = [
    { ad: "Otopark", renk: "#1d4ed8", cizgi: cizgi((n) => n.park) },
    { ad: "Oto yıkama", renk: "#0f766e", cizgi: cizgi((n) => n.yikama) },
    { ad: "Abonman", renk: "#b45309", cizgi: cizgi((n) => n.abonman) },
  ];

  return (
    <div>
      <svg
        viewBox={`0 0 ${G} ${Y}`}
        className="h-32 w-full"
        role="img"
        aria-label={`Son ${noktalar.length} günün otopark, yıkama ve abonman geliri`}
        data-test="trend-grafigi"
      >
        {/* Yatay kılavuz: en yüksek değerin yarısı */}
        <line x1={0} y1={y(enYuksek / 2)} x2={G} y2={y(enYuksek / 2)} stroke="#e2e8f0" strokeWidth={1} />
        {seriler.map((s) => (
          <path
            key={s.ad}
            d={s.cizgi}
            fill="none"
            stroke={s.renk}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs">
        {seriler.map((s) => (
          <li key={s.ad} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.renk }}
            />
            <span className="font-semibold text-slate-600">{s.ad}</span>
          </li>
        ))}
        <li className="text-slate-400">
          en yüksek gün: {(enYuksek / 100).toLocaleString("tr-TR")} ₺
        </li>
      </ul>
    </div>
  );
}

/** Denetim ekranının filtre çipleri (URL tabanlı). */
export function DenetimFiltresi({
  gruplar,
  aktifGrup,
  kisiler,
  aktifKisi,
}: {
  gruplar: { kod: string; etiket: string }[];
  aktifGrup: string | null;
  kisiler: { id: string; ad: string }[];
  aktifKisi: string | null;
}) {
  const router = useRouter();
  const yol = usePathname();
  const parametreler = useSearchParams();

  function ayarla(anahtar: string, deger: string | null) {
    const yeni = new URLSearchParams(parametreler.toString());
    if (deger === null || deger === "") yeni.delete(anahtar);
    else yeni.set(anahtar, deger);
    // Sayfalama imleci filtre değişince anlamsızlaşır.
    yeni.delete("imlec");
    router.push(`${yol}?${yeni.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <FiltreCipi etiket="Tümü" aktif={!aktifGrup} onClick={() => ayarla("grup", null)} />
        {gruplar.map((g) => (
          <FiltreCipi
            key={g.kod}
            etiket={g.etiket}
            aktif={aktifGrup === g.kod}
            onClick={() => ayarla("grup", g.kod)}
            test={`denetim-grup-${g.kod}`}
          />
        ))}
      </div>
      {kisiler.length > 0 ? (
        <div>
          <label
            htmlFor="denetim-kisi"
            className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
          >
            Kişi
          </label>
          <select
            id="denetim-kisi"
            value={aktifKisi ?? ""}
            onChange={(e) => ayarla("kisi", e.target.value || null)}
            className="h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800"
            data-test="denetim-kisi"
          >
            <option value="">Herkes</option>
            {kisiler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function FiltreCipi({
  etiket,
  aktif,
  onClick,
  test,
}: {
  etiket: string;
  aktif: boolean;
  onClick: () => void;
  test?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      data-test={test}
      className={`flex h-12 items-center rounded-xl border px-3 text-sm font-semibold ${
        aktif
          ? "border-lacivert-600 bg-lacivert-600 text-white"
          : "border-slate-300 bg-white text-lacivert-700"
      }`}
    >
      {etiket}
    </button>
  );
}

/** Denetim kaydının önce/sonra alanlarını açıp kapatan satır. */
export function DenetimAyrinti({ oncesi, sonrasi }: { oncesi: unknown; sonrasi: unknown }) {
  const [acik, setAcik] = useState(false);
  const varMi = oncesi !== null || sonrasi !== null;
  if (!varMi) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setAcik(!acik)}
        className="text-xs font-bold uppercase text-lacivert-600"
      >
        {acik ? "Ayrıntıyı kapat" : "Ayrıntı"}
      </button>
      {acik ? (
        <div className="mt-1 space-y-2 text-xs">
          {oncesi !== null && oncesi !== undefined ? (
            <div>
              <div className="font-bold text-slate-500">Önce</div>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-[11px]">
                {JSON.stringify(oncesi, null, 2)}
              </pre>
            </div>
          ) : null}
          {sonrasi !== null && sonrasi !== undefined ? (
            <div>
              <div className="font-bold text-slate-500">Sonra</div>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-[11px]">
                {JSON.stringify(sonrasi, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Sayfalama: "daha fazla" bağlantısı (imleç tabanlı). */
export function DahaFazla({ imlecId }: { imlecId: string }) {
  const yol = usePathname();
  const parametreler = useSearchParams();
  const yeni = new URLSearchParams(parametreler.toString());
  yeni.set("imlec", imlecId);

  return (
    <Link
      href={`${yol}?${yeni.toString()}`}
      className="flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold text-lacivert-700"
      data-test="daha-fazla"
    >
      Daha fazla göster
    </Link>
  );
}
