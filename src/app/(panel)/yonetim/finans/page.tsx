import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { aylikFinansRaporu, gunlukFinansRaporu, type FinansRaporu } from "@/server/finance/queries";
import { kritikStoklar } from "@/server/inventory/queries";
import { kasaDisiTahsilat, kasaGecmisi } from "@/server/cash/queries";
import { formatDate } from "@/lib/datetime";

export const metadata = { title: "Gelir / Gider" };
export const dynamic = "force-dynamic";

/**
 * GELIR-GIDER PANELI (patron)
 *
 * OTOPARK VE YIKAMA AYRI SATIRLARDA (mimari kural 11): iki modulun cirosu
 * tek sayida eritilmez; patron hangi isin ne getirdigini gorur.
 *
 * NET, KASA BAKIYESI DEGILDIR: karta yapilan tahsilat kasada para olarak
 * durmaz. Kasa durumu ayri ekranda (Yönetim → Kasa).
 */
export default async function FinansPaneli() {
  const [gunluk, aylik, kritikler, kasaDisi, kasalar] = await Promise.all([
    gunlukFinansRaporu(),
    aylikFinansRaporu(),
    kritikStoklar(),
    kasaDisiTahsilat(),
    kasaGecmisi(5),
  ]);

  const farkliKasalar = kasalar.filter((k) => k.nakitFarki !== null && k.nakitFarki !== 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Gelir / Gider</h1>

      {kasaDisi.adet > 0 ? (
        <Alert tur="uyari" baslik="Kasa dışı nakit tahsilat var" data-test="finans-kasa-disi">
          Bugün kasa oturumu açık değilken {kasaDisi.adet} nakit tahsilat yapıldı
          (<Tutar kurus={kasaDisi.tutar} boyut="kucuk" />). Bu tutar hiçbir kasa sayımına
          girmiyor.
        </Alert>
      ) : null}

      {farkliKasalar.length > 0 ? (
        <Alert tur="uyari" baslik={`${farkliKasalar.length} kasa kapanışında fark var`}>
          <Link href="/yonetim/kasa" className="font-bold underline">
            Kasa geçmişini inceleyin
          </Link>
        </Alert>
      ) : null}

      {kritikler.length > 0 ? (
        <Alert tur="uyari" baslik={`${kritikler.length} malzeme asgari stoğun altında`}>
          {kritikler.map((m) => m.ad).join(", ")} ·{" "}
          <Link href="/stok" className="font-bold underline">
            Stok ekranı
          </Link>
        </Alert>
      ) : null}

      <RaporKarti baslik="Bugün" rapor={gunluk} />
      <RaporKarti baslik="Bu ay" rapor={aylik} />

      {/* ---- CSV DIŞA AKTARMA ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Dışa aktar (CSV)</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-sm text-slate-500">
            Dosyalar Excel&apos;in Türkçe biçimiyle açılır (noktalı virgül ayırıcı,
            tr-TR tutar ve tarih). Her dosyanın başında{" "}
            <em>&quot;Yönetim amaçlı rapordur; resmî muhasebe/yasal bilanço yerine
            geçmez.&quot;</em> notu yer alır.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { href: "/yonetim/finans/csv?tur=ozet&donem=gun", etiket: "Bugünün özeti" },
              { href: "/yonetim/finans/csv?tur=ozet&donem=ay", etiket: "Bu ayın özeti" },
              { href: "/yonetim/finans/csv?tur=ozet&donem=yil", etiket: "Bu yılın özeti" },
              { href: "/yonetim/finans/csv?tur=gider", etiket: "Giderler (90 gün)" },
              { href: "/yonetim/finans/csv?tur=gelir", etiket: "Diğer gelirler (90 gün)" },
            ].map((d) => (
              <a
                key={d.href}
                href={d.href}
                className="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-lacivert-700"
                data-test={`csv-${d.href.split("tur=")[1]}`}
              >
                ⬇ {d.etiket}
              </a>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/yonetim/finans/giderler"
          className="flex min-h-14 items-center justify-between rounded-xl border border-slate-300 bg-white px-4 font-semibold text-lacivert-700"
        >
          Giderler <Rozet tur="mavi">LİSTE</Rozet>
        </Link>
        <Link
          href="/yonetim/kasa"
          className="flex min-h-14 items-center justify-between rounded-xl border border-slate-300 bg-white px-4 font-semibold text-lacivert-700"
        >
          Kasa geçmişi <Rozet tur="mavi">LİSTE</Rozet>
        </Link>
        <Link
          href="/stok"
          className="flex min-h-14 items-center justify-between rounded-xl border border-slate-300 bg-white px-4 font-semibold text-lacivert-700"
        >
          Malzeme stoğu <Rozet tur="mavi">LİSTE</Rozet>
        </Link>
      </div>
    </div>
  );
}

function RaporKarti({ baslik, rapor }: { baslik: string; rapor: FinansRaporu }) {
  const bos = rapor.gelir.toplam === 0 && rapor.gider.toplam === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {baslik} · {formatDate(rapor.baslangic)}
          {formatDate(rapor.baslangic) !== formatDate(new Date(rapor.bitis.getTime() - 1))
            ? ` – ${formatDate(new Date(rapor.bitis.getTime() - 1))}`
            : ""}
        </CardTitle>
      </CardHeader>
      <CardBody>
        {bos ? (
          <p className="text-sm text-slate-500">Bu dönemde gelir veya gider kaydı yok.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {/* ---- GELİR ---- */}
            <div>
              <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-slate-500">
                Gelir
              </div>
              <Satir etiket="Otopark" kurus={rapor.gelir.park} />
              <Satir etiket="Oto yıkama" kurus={rapor.gelir.yikama} />
              <Satir etiket="Abonman" kurus={rapor.gelir.abonman} />
              {rapor.gelir.diger > 0 ? <Satir etiket="Diğer gelir" kurus={rapor.gelir.diger} /> : null}
              {rapor.gelir.iade > 0 ? (
                <Satir etiket="İade / ters kayıt" kurus={-rapor.gelir.iade} />
              ) : null}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-lacivert-700">
                <span>Gelir toplamı</span>
                <Tutar kurus={rapor.gelir.toplam} />
              </div>
              <p className="pt-1 text-xs text-slate-500">
                Nakit <Tutar kurus={rapor.gelir.nakit} boyut="kucuk" /> · Kart{" "}
                <Tutar kurus={rapor.gelir.kart} boyut="kucuk" />
                {rapor.gelir.digerYontem !== 0 ? (
                  <>
                    {" "}
                    · Diğer <Tutar kurus={rapor.gelir.digerYontem} boyut="kucuk" />
                  </>
                ) : null}
              </p>
            </div>

            {/* ---- GİDER ---- */}
            <div>
              <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-slate-500">
                Gider
              </div>
              {rapor.gider.kalemler.length === 0 ? (
                <p className="text-slate-500">Gider kaydı yok.</p>
              ) : (
                rapor.gider.kalemler.map((k) => (
                  <Satir
                    key={k.kategoriId}
                    etiket={`${k.kategori} (${k.adet})`}
                    kurus={k.tutar}
                  />
                ))
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-lacivert-700">
                <span>Gider toplamı</span>
                <Tutar kurus={rapor.gider.toplam} />
              </div>
            </div>

            {/* ---- NET ---- */}
            <div
              className={`flex items-baseline justify-between rounded-xl px-3 py-2 ${
                rapor.net >= 0 ? "bg-basari-acik" : "bg-hata-acik"
              }`}
              data-test={`net-${baslik}`}
            >
              <span className="font-bold text-lacivert-800">Net</span>
              <Tutar kurus={rapor.net} boyut="orta" />
            </div>
            <p className="text-xs text-slate-500">
              Net bir kasa bakiyesi değildir: karta yapılan tahsilat kasada nakit olarak
              durmaz.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Satir({ etiket, kurus }: { etiket: string; kurus: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{etiket}</span>
      <Tutar kurus={kurus} boyut="kucuk" />
    </div>
  );
}
