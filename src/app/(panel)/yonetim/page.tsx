import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet, SayacKarti } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { DonemFiltresi, TrendGrafigi } from "@/components/panel/rapor-araclari";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatKurusPlain } from "@/lib/money";
import {
  DONEM_ETIKETLERI,
  aralikCozumle,
  donemGecerliMi,
} from "@/server/reports/range";
import { panelVerisi } from "@/server/reports/dashboard";
import { uyarilar, type UyariOnemi } from "@/server/reports/alerts";

export const metadata = { title: "Yönetim" };
export const dynamic = "force-dynamic";

/**
 * PATRON ANA PANELİ
 *
 * ============================================================================
 * Taslak: docs/04-ekranlar-ve-akislar.md (4.8)
 *
 * MİMARİ KURAL 11: otopark, yıkama ve abonman tek "ciro" sayısında eritilmez;
 * her biri kendi satırında ve trend grafiğinde kendi çizgisinde.
 *
 * DOLULUK YÜZDESİ YOK: kapasite işletme kararı gereği tanımsız (sınır yok).
 * Anlamsız bir oran göstermek yanlış bilgi olur; o yüzden kart hiç çizilmez.
 *
 * NET BİR KASA BAKİYESİ DEĞİLDİR: karta yapılan tahsilat kasada para olarak
 * durmaz. Kasa durumu ayrı ekranda.
 * ============================================================================
 */
export default async function YonetimPaneli({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; baslangic?: string; bitis?: string }>;
}) {
  const sp = await searchParams;
  const donem = donemGecerliMi(sp.donem);
  const aralik = aralikCozumle(donem, {
    baslangicMetni: sp.baslangic ?? null,
    bitisMetni: sp.bitis ?? null,
  });

  const [veri, uyariListesi] = await Promise.all([panelVerisi(aralik), uyarilar()]);

  const bitisGosterim = new Date(aralik.bitis.getTime() - 1);
  const tekGun = formatDate(aralik.baslangic) === formatDate(bitisGosterim);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">İşletme durumu</h1>
        <p className="text-sm text-slate-500" data-test="panel-donem">
          {DONEM_ETIKETLERI[donem]} ·{" "}
          {tekGun
            ? formatDate(aralik.baslangic)
            : `${formatDate(aralik.baslangic)} – ${formatDate(bitisGosterim)}`}
        </p>
      </div>

      <DonemFiltresi
        aktif={donem}
        baslangic={sp.baslangic ?? null}
        bitis={sp.bitis ?? null}
      />

      {/* ---- UYARI MERKEZİ: en üstte, çünkü eylem gerektirir ---- */}
      {uyariListesi.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Uyarılar</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2" data-test="uyari-merkezi">
              {uyariListesi.map((u) => (
                <li key={u.kod}>
                  <Link href={u.href} className="block">
                    <Alert
                      tur={uyariTuru(u.onem)}
                      baslik={u.baslik}
                      data-test={`uyari-${u.kod}`}
                    >
                      {u.ayrinti}
                      {u.tutarKurus !== undefined && u.tutarKurus !== 0 ? (
                        <>
                          {" "}
                          <strong>{formatKurusPlain(u.tutarKurus)} ₺</strong>
                        </>
                      ) : null}
                    </Alert>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : (
        <Alert tur="basari" baslik="Bekleyen uyarı yok" data-test="uyari-yok">
          Tarife, kasa, abonman, yıkama ve stok kontrollerinin hepsi temiz.
        </Alert>
      )}

      {/* ---- SAYAÇLAR ---- */}
      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Otoparkta" deger={veri.sayaclar.otoparktaki} renk="lacivert" />
        <SayacKarti etiket="Giriş" deger={veri.sayaclar.girisAdedi} renk="mavi" />
        <SayacKarti etiket="Çıkış" deger={veri.sayaclar.cikisAdedi} renk="mavi" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SayacKarti etiket="Aktif abonman" deger={veri.sayaclar.aktifAbonman} renk="lacivert" />
        <SayacKarti etiket="Yıkama" deger={veri.sayaclar.yikamaAdedi} renk="mavi" />
      </div>
      {/*
        DOLULUK KARTI BİLEREK YOK: kapasite tanımsız (karar 04.10.2026).
        Patron kapasite girerse dolulukYuzdesi dolu gelir ve kart çizilir.
      */}
      {veri.sayaclar.dolulukYuzdesi !== null ? (
        <SayacKarti
          etiket="Doluluk"
          deger={`%${veri.sayaclar.dolulukYuzdesi}`}
          renk="lacivert"
        />
      ) : null}

      {/* ---- GELİR / GİDER ---- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gelir</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-1.5 text-sm">
              <Satir etiket="Otopark" kurus={veri.rapor.gelir.park} />
              <Satir etiket="Oto yıkama" kurus={veri.rapor.gelir.yikama} />
              <Satir etiket="Abonman" kurus={veri.rapor.gelir.abonman} />
              {veri.rapor.gelir.diger > 0 ? (
                <Satir etiket="Diğer gelir" kurus={veri.rapor.gelir.diger} />
              ) : null}
              {veri.rapor.gelir.iade > 0 ? (
                <Satir etiket="İade / ters kayıt" kurus={-veri.rapor.gelir.iade} />
              ) : null}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-lacivert-700">
                <dt>TOPLAM</dt>
                <dd>
                  <Tutar kurus={veri.rapor.gelir.toplam} />
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Nakit <Tutar kurus={veri.rapor.gelir.nakit} boyut="kucuk" /> · Kart{" "}
              <Tutar kurus={veri.rapor.gelir.kart} boyut="kucuk" />
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gider</CardTitle>
          </CardHeader>
          <CardBody>
            {veri.rapor.gider.kalemler.length === 0 ? (
              <p className="text-sm text-slate-500">Bu dönemde gider kaydı yok.</p>
            ) : (
              <dl className="space-y-1.5 text-sm">
                {veri.rapor.gider.kalemler.slice(0, 6).map((k) => (
                  <Satir key={k.kategoriId} etiket={`${k.kategori} (${k.adet})`} kurus={k.tutar} />
                ))}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-lacivert-700">
                  <dt>TOPLAM</dt>
                  <dd>
                    <Tutar kurus={veri.rapor.gider.toplam} />
                  </dd>
                </div>
              </dl>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Personel avansı gider değildir; maaş ödemesinde mahsup edilir.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ---- NET ---- */}
      <Card>
        <CardBody className="pt-4">
          <div
            className={`flex items-baseline justify-between rounded-xl px-4 py-3 ${
              veri.rapor.net >= 0 ? "bg-basari-acik" : "bg-hata-acik"
            }`}
            data-test="panel-net"
          >
            <span className="font-extrabold text-lacivert-800">NET SONUÇ</span>
            <Tutar kurus={veri.rapor.net} boyut="orta" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Net bir kasa bakiyesi değildir: karta yapılan tahsilat kasada nakit olarak
            durmaz.{" "}
            <Link href="/yonetim/kasa" className="font-semibold underline">
              Kasa durumu
            </Link>
          </p>
        </CardBody>
      </Card>

      {/* ---- DÖNEM KARŞILAŞTIRMASI ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Önceki döneme göre</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-2 text-xs text-slate-500">
            Karşılaştırma aynı uzunluktaki bir önceki dönemle yapılır:{" "}
            {formatDate(aralik.oncekiBaslangic)} –{" "}
            {formatDate(new Date(aralik.oncekiBitis.getTime() - 1))}
          </p>
          <ul className="divide-y divide-slate-100" data-test="karsilastirma">
            {veri.karsilastirma.map((k) => (
              <li key={k.etiket} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-slate-600">{k.etiket}</span>
                <span className="flex items-center gap-2">
                  <Tutar kurus={k.simdi} boyut="kucuk" />
                  {k.yuzde === null ? (
                    <Rozet tur="notr">
                      {k.onceki === 0 && k.simdi === 0 ? "değişim yok" : "önceki dönem 0"}
                    </Rozet>
                  ) : (
                    <Rozet tur={yuzdeRozeti(k.etiket, k.yuzde)}>
                      {k.yuzde > 0 ? "+" : ""}
                      {k.yuzde.toLocaleString("tr-TR")}%
                    </Rozet>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* ---- TREND ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Son 30 günün geliri</CardTitle>
        </CardHeader>
        <CardBody>
          <TrendGrafigi
            noktalar={veri.trend.map((n) => ({
              gun: formatDate(n.gun),
              park: n.park,
              yikama: n.yikama,
              abonman: n.abonman,
            }))}
          />
        </CardBody>
      </Card>

      {/* ---- AKTİF VARDİYALAR ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Aktif vardiyalar</CardTitle>
        </CardHeader>
        <CardBody>
          {veri.aktifVardiyalar.length === 0 ? (
            <p className="text-sm text-slate-500">Şu anda açık vardiya yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {veri.aktifVardiyalar.map((v) => (
                <li key={v.shiftId} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-semibold text-lacivert-700">{v.personel}</div>
                    <div className="text-xs text-slate-500">
                      {formatTime(v.baslangicAt)}&apos;den beri
                    </div>
                  </div>
                  <Tutar kurus={v.tahsilatKurus} boyut="kucuk" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">
            Kasa:{" "}
            {veri.kasaAcikMi ? (
              <Rozet tur="basari">AÇIK</Rozet>
            ) : (
              <Rozet tur="uyari">KAPALI</Rozet>
            )}
          </p>
        </CardBody>
      </Card>

      {/* ---- HIZLI BAĞLANTILAR ---- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { href: "/yonetim/finans", etiket: "Gelir / gider ayrıntısı" },
          { href: "/yonetim/raporlar/personel", etiket: "Personel bazlı tahsilat" },
          { href: "/yonetim/personel", etiket: "Personel yönetimi" },
          { href: "/yonetim/denetim", etiket: "Denetim kayıtları" },
        ].map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className="flex min-h-14 items-center justify-between rounded-xl border border-slate-300 bg-white px-4 font-semibold text-lacivert-700"
          >
            {b.etiket} <span aria-hidden>›</span>
          </Link>
        ))}
      </div>
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

function uyariTuru(onem: UyariOnemi): "hata" | "uyari" | "bilgi" {
  return onem === "kritik" ? "hata" : onem === "uyari" ? "uyari" : "bilgi";
}

/**
 * Yüzde rozetinin rengi.
 *
 * GİDERDE ARTIŞ İYİ HABER DEĞİLDİR: gelirde yeşil olan yön, giderde kırmızı
 * olmalı. Aksi halde "giderler %40 arttı" yeşil görünür ve yanlış okunur.
 */
function yuzdeRozeti(etiket: string, yuzde: number): "basari" | "hata" | "notr" {
  if (yuzde === 0) return "notr";
  const giderMi = etiket.toLocaleLowerCase("tr-TR").includes("gider");
  const iyi = giderMi ? yuzde < 0 : yuzde > 0;
  return iyi ? "basari" : "hata";
}
