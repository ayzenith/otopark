import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { AcikKasaPaneli, KasaAcKarti } from "@/components/panel/kasa-paneli";
import { acikVardiya } from "@/server/shift";
import {
  acikKasaDurumu,
  kasaDisiTahsilat,
  sonKapananKasa,
  vardiyaTahsilatOzeti,
} from "@/server/cash/queries";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { formatKurus } from "@/lib/money";

export const metadata = { title: "Kasa" };
export const dynamic = "force-dynamic";

/**
 * KASA / VARDIYAM EKRANI (personel)
 *
 * Iki bolum:
 *   1. Vardiyamin tahsilati  - herkes kendi ozetini gorur (cash.report.self)
 *   2. Kasa oturumu          - acma/sayim/kapanis (cash.drawer.* izinleri)
 *
 * Kasa izni olmayan personel yalnizca kendi tahsilat ozetini gorur; kasa
 * bolumu HIC CIZILMEZ (guvenlik yine sunucuda).
 */
export default async function KasaSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  const ozetGorebilir = user.permissions.has(PERMISSIONS.CASH_REPORT_SELF);
  const kasaAcabilir = user.permissions.has(PERMISSIONS.CASH_DRAWER_OPEN);
  const kasaKapatabilir = user.permissions.has(PERMISSIONS.CASH_DRAWER_CLOSE);
  const hareketGirebilir = user.permissions.has(PERMISSIONS.CASH_MOVEMENT_CREATE);
  const iptalEdebilir = user.permissions.has(PERMISSIONS.CASH_VOID);
  const tumunuGorebilir = user.permissions.has(PERMISSIONS.CASH_REPORT_ALL);

  const vardiya = await acikVardiya(user.id);

  const [ozet, kasa, kasaDisi, sonKapanis] = await Promise.all([
    vardiya && ozetGorebilir ? vardiyaTahsilatOzeti(vardiya.id) : null,
    kasaAcabilir || kasaKapatabilir || hareketGirebilir ? acikKasaDurumu() : null,
    tumunuGorebilir ? kasaDisiTahsilat() : null,
    // Kapanis onayinin KALICI kaynagi: kasa kapandiktan sonra personel
    // beklenen/sayilan/fark ucluyu burada gorur. Istemci durumunda
    // tutulamaz, cunku kapanis sayfayi tazeler (bkz. kasa-paneli.tsx).
    ozetGorebilir ? sonKapananKasa() : null,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Kasa</h1>
        <p className="text-sm text-slate-500">
          {vardiya
            ? `Vardiya ${formatTime(vardiya.startedAt)}'den beri açık`
            : "Açık vardiyanız yok"}
        </p>
      </div>

      {/* ---- VARDİYAMIN TAHSİLATI ---- */}
      {ozetGorebilir ? (
        <Card>
          <CardHeader>
            <CardTitle>Vardiyamın tahsilatı</CardTitle>
          </CardHeader>
          <CardBody>
            {!vardiya ? (
              <p className="text-sm text-slate-500">
                Vardiya açmadan tahsilat özeti oluşmaz. Ana ekrandan vardiyanızı başlatın.
              </p>
            ) : ozet && ozet.toplam === 0 ? (
              <p className="text-sm text-slate-500">Bu vardiyada henüz tahsilat yapılmadı.</p>
            ) : ozet ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nakit</span>
                  <Tutar kurus={ozet.nakit} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kart</span>
                  <Tutar kurus={ozet.kart} />
                </div>
                {ozet.diger !== 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diğer</span>
                    <Tutar kurus={ozet.diger} />
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-bold text-lacivert-700">Toplam</span>
                  <Tutar kurus={ozet.toplam} boyut="orta" />
                </div>

                <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Otopark</span>
                    <Tutar kurus={ozet.kaynaklar.park} boyut="kucuk" />
                  </div>
                  <div className="flex justify-between">
                    <span>Oto yıkama</span>
                    <Tutar kurus={ozet.kaynaklar.yikama} boyut="kucuk" />
                  </div>
                  <div className="flex justify-between">
                    <span>Abonman</span>
                    <Tutar kurus={ozet.kaynaklar.abonman} boyut="kucuk" />
                  </div>
                  {ozet.kaynaklar.diger > 0 ? (
                    <div className="flex justify-between">
                      <span>Diğer gelir</span>
                      <Tutar kurus={ozet.kaynaklar.diger} boyut="kucuk" />
                    </div>
                  ) : null}
                  {ozet.kaynaklar.iade > 0 ? (
                    <div className="flex justify-between text-hata">
                      <span>İade / ters kayıt</span>
                      <Tutar kurus={ozet.kaynaklar.iade} boyut="kucuk" />
                    </div>
                  ) : null}
                </div>
                <p className="pt-1 text-xs text-slate-400">
                  {ozet.islemSayisi.cikis} araç çıkışı · {ozet.islemSayisi.yikama} yıkama
                </p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {/* ---- KASA OTURUMU ---- */}
      {kasa ? (
        <AcikKasaPaneli
          kasaId={kasa.kasa.id}
          acilisAt={kasa.kasa.acilisAt}
          acanKisi={kasa.kasa.acanKisi}
          dokum={kasa.dokum}
          hareketler={kasa.hareketler}
          hareketYetkisi={hareketGirebilir}
          kapatmaYetkisi={kasaKapatabilir}
          iptalYetkisi={iptalEdebilir}
        />
      ) : kasaAcabilir ? (
        <KasaAcKarti />
      ) : (
        <Alert tur="bilgi" baslik="Kasa oturumu açık değil">
          Kasa açma yetkiniz yok. Vardiya sorumlusu kasayı açtığında tahsilatlarınız o
          kasaya düşer.
        </Alert>
      )}

      {/* ---- SON KASA KAPANIŞI: kalıcı onay ---- */}
      {!kasa && sonKapanis && sonKapanis.beklenenNakit !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Son kasa kapanışı</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-2 text-xs text-slate-500">
              {sonKapanis.kapanisAt ? formatDateTime(sonKapanis.kapanisAt) : "—"}
              {sonKapanis.kapatanKisi ? ` · ${sonKapanis.kapatanKisi}` : ""}
            </p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Beklenen nakit</dt>
                <dd>
                  <Tutar kurus={sonKapanis.beklenenNakit} boyut="kucuk" />
                </dd>
              </div>
              {sonKapanis.sayilanNakit !== null ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Sayılan nakit</dt>
                  <dd>
                    <Tutar kurus={sonKapanis.sayilanNakit} boyut="kucuk" />
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-3">
              {sonKapanis.nakitFarki === 0 ? (
                <Alert tur="basari" baslik="Kasa tam — fark yok" data-test="son-kapanis" />
              ) : (
                <Alert
                  tur="uyari"
                  baslik={`Kasa farkı: ${formatKurus(Math.abs(sonKapanis.nakitFarki ?? 0))} ${
                    (sonKapanis.nakitFarki ?? 0) > 0 ? "FAZLA" : "EKSİK"
                  }`}
                  data-test="son-kapanis"
                >
                  {sonKapanis.farkSebebi
                    ? `Gerekçe: ${sonKapanis.farkSebebi}`
                    : "Fark gerekçesiyle birlikte kaydedildi."}
                </Alert>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- KASA DIŞI TAHSİLAT UYARISI (yalnızca yöneticiler) ---- */}
      {kasaDisi && kasaDisi.adet > 0 ? (
        <Alert tur="uyari" baslik="Kasa dışı nakit tahsilat var" data-test="kasa-disi">
          Bugün kasa oturumu açık değilken {kasaDisi.adet} nakit tahsilat yapıldı
          (toplam <Tutar kurus={kasaDisi.tutar} boyut="kucuk" />). Bu tutar hiçbir kasa
          sayımına girmez.
        </Alert>
      ) : null}

      {tumunuGorebilir ? (
        <Card>
          <CardBody className="pt-4">
            <Link
              href="/yonetim/kasa"
              className="flex min-h-12 items-center justify-between gap-3"
            >
              <span className="font-bold text-lacivert-700">Kasa geçmişi ve farklar</span>
              <Rozet tur="mavi">YÖNETİM</Rozet>
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
