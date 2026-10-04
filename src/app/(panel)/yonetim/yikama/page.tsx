import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet, SayacKarti } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import {
  hizmetBazliCiro,
  personelYikamaSayisi,
  tahsilEdilmeyenYikamalar,
  yikamaListesi,
  yikamaOzeti,
} from "@/server/wash/queries";
import { DURUM_ETIKETLERI } from "@/server/wash/job";
import { businessDayRange, formatDate, formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Oto yıkama raporları" };
export const dynamic = "force-dynamic";

/**
 * OTO YIKAMA RAPORLARI (patron)
 *
 * NOT: Buradaki tum tutarlar YALNIZCA YIKAMAdir. Otopark cirosu ayri tutulur
 * ve bu sayfadaki hicbir toplama dahil edilmez.
 */
export default async function YikamaRaporlariSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const { ay } = await searchParams;
  const aylikMi = ay === "1";

  const { start, end } = businessDayRange();
  const baslangic = aylikMi ? new Date(start.getTime() - 29 * 86_400_000) : start;
  const bitis = end;

  const [ozet, liste, ciro, personel, tahsilEdilmeyen] = await Promise.all([
    yikamaOzeti(baslangic, bitis),
    yikamaListesi({ baslangic, bitis, limit: 200 }),
    hizmetBazliCiro(baslangic, bitis),
    personelYikamaSayisi(baslangic, bitis),
    tahsilEdilmeyenYikamalar(50),
  ]);

  const ciroToplam = ciro.reduce((t, c) => t + c.tutarKurus, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold text-lacivert-700">Oto yıkama</h1>
        <Link href="/yonetim/ayarlar/yikama" className="text-sm font-semibold text-mavi-600">
          Fiyatlar →
        </Link>
      </div>

      <nav className="flex gap-2" aria-label="Dönem">
        {[
          { etiket: "Bugün", href: "/yonetim/yikama", aktif: !aylikMi },
          { etiket: "Son 30 gün", href: "/yonetim/yikama?ay=1", aktif: aylikMi },
        ].map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={s.aktif ? "page" : undefined}
            className={`inline-flex h-12 items-center rounded-xl border-2 px-4 text-sm font-bold ${
              s.aktif
                ? "border-lacivert-600 bg-lacivert-600 text-white"
                : "border-slate-300 bg-white text-lacivert-700"
            }`}
            data-test={`donem-${s.aktif ? "aktif" : "pasif"}`}
          >
            {s.etiket}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-slate-500">
        {formatDate(baslangic)} – {formatDate(new Date(bitis.getTime() - 1))}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Sırada" deger={ozet.sirada} renk="lacivert" />
        <SayacKarti etiket="Yıkamada" deger={ozet.yikamada} renk="mavi" />
        <SayacKarti etiket="Tamamlanan" deger={ozet.tamamlanan} renk="basari" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yıkama tahsilatı</CardTitle>
        </CardHeader>
        <CardBody>
          {ozet.ciroKurus === 0 ? (
            <p className="text-sm text-slate-500">Bu dönemde yıkama tahsilatı yok.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Nakit</span>
                <Tutar kurus={ozet.nakitKurus} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kart (elle kaydedilen)</span>
                <Tutar kurus={ozet.kartKurus} />
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-bold text-lacivert-700">Toplam</span>
                <Tutar kurus={ozet.ciroKurus} boyut="normal" />
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Yalnızca oto yıkama tahsilatıdır; <strong>otopark tahsilatı ayrı tutulur</strong>.
          </p>
        </CardBody>
      </Card>

      {ozet.tahsilEdilmeyen > 0 || ozet.fiyatsizIsSayisi > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Uyarılar</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              {ozet.tahsilEdilmeyen > 0 ? (
                <li className="text-uyari">
                  ⚠ {ozet.tahsilEdilmeyen} tamamlanmış yıkamanın tahsilatı yapılmadı.
                </li>
              ) : null}
              {ozet.fiyatsizIsSayisi > 0 ? (
                <li className="text-uyari">
                  ⚠ {ozet.fiyatsizIsSayisi} işte fiyatı tanımsız hizmet 0 ₺ kaydedildi.{" "}
                  <Link href="/yonetim/ayarlar/yikama" className="underline">
                    Fiyat girin
                  </Link>
                </li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- HIZMET BAZLI CIRO ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Hizmet bazlı ciro</CardTitle>
        </CardHeader>
        <CardBody>
          {ciro.length === 0 ? (
            <p className="text-sm text-slate-500">Bu dönemde yıkama işi yok.</p>
          ) : (
            <ul className="space-y-2" data-test="hizmet-ciro">
              {ciro.map((c) => (
                <li key={c.washServiceId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-lacivert-700">
                      {c.ad}
                    </span>
                    <span className="shrink-0">
                      <span className="rakam mr-2 text-slate-500">{c.adet} adet</span>
                      <Tutar kurus={c.tutarKurus} boyut="kucuk" />
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-mavi-500"
                      style={{
                        width: `${ciroToplam > 0 ? Math.round((c.tutarKurus / ciroToplam) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Tutarlar işin yapıldığı andaki fiyattan gelir; fiyat sonradan değişse bile
            geçmiş ciro değişmez.
          </p>
        </CardBody>
      </Card>

      {/* ---- PERSONEL ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Personel işlem sayısı</CardTitle>
        </CardHeader>
        <CardBody>
          {personel.length === 0 ? (
            <p className="text-sm text-slate-500">Bu dönemde işlem yok.</p>
          ) : (
            <ul className="space-y-1.5 text-sm" data-test="personel-yikama">
              {personel.map((p) => (
                <li key={p.userId} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold text-lacivert-700">{p.ad}</span>
                  <span className="shrink-0">
                    <span className="rakam mr-2 text-slate-500">{p.adet} araç</span>
                    <Tutar kurus={p.tutarKurus} boyut="kucuk" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---- TAHSIL EDILMEYENLER ---- */}
      {tahsilEdilmeyen.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tahsil edilmeyen yıkamalar ({tahsilEdilmeyen.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2" data-test="tahsil-edilmeyen">
              {tahsilEdilmeyen.map((i) => (
                <li key={i.id} className="rounded-xl border border-amber-300 bg-uyari-acik p-3">
                  <Link href={`/yikama/${i.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-lacivert-800">{i.plaka}</div>
                        <div className="text-sm text-amber-900">
                          {i.hizmetler.join(" + ")}
                        </div>
                        <div className="text-xs text-amber-800">
                          {i.bitis ? formatDateTime(i.bitis) : ""}
                          {i.musteriAdi ? ` · ${i.musteriAdi}` : ""}
                        </div>
                        {i.not ? <div className="text-xs text-amber-800">{i.not}</div> : null}
                      </div>
                      <Tutar kurus={i.toplamKurus} boyut="kucuk" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- LISTE ---- */}
      <Card>
        <CardHeader>
          <CardTitle>İş listesi ({liste.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {liste.length === 0 ? (
            <p className="text-sm text-slate-500">Bu dönemde yıkama işi yok.</p>
          ) : (
            <ul className="space-y-2" data-test="yikama-listesi">
              {liste.map((i) => (
                <li key={i.id} className="rounded-xl border border-slate-200 p-3">
                  <Link href={`/yikama/${i.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-lacivert-800">{i.plaka}</div>
                        <div className="truncate text-sm text-slate-600">
                          {i.hizmetler.join(" + ")}
                        </div>
                        <div className="text-xs text-slate-400">
                          {i.kod} · {i.aracSinifi} · {formatDateTime(i.tarih)}
                          {i.yapan ? ` · ${i.yapan}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Rozet
                          tur={
                            i.durum === "COMPLETED"
                              ? "basari"
                              : i.durum === "CANCELLED"
                                ? "hata"
                                : i.durum === "IN_PROGRESS"
                                  ? "mavi"
                                  : "notr"
                          }
                        >
                          {DURUM_ETIKETLERI[i.durum as keyof typeof DURUM_ETIKETLERI]}
                        </Rozet>
                        <div className="mt-1">
                          <Tutar kurus={i.toplamKurus} boyut="kucuk" />
                        </div>
                        {i.odemeDurumu === "UNPAID" && i.durum === "COMPLETED" ? (
                          <div className="text-[11px] font-bold text-uyari">tahsil edilmedi</div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
