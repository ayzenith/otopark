import { Alert, Card, CardBody, CardHeader, CardTitle, SayacKarti } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { prisma } from "@/server/db";
import { businessDayRange } from "@/lib/datetime";
import { kapasiteDurumu } from "@/server/parking/entry";
import { toKurus } from "@/lib/money";

export const metadata = { title: "Yönetim" };
export const dynamic = "force-dynamic";

/**
 * YONETICI ANA PANELI - Asama 2 kapsaminda yalnizca otopark verileri.
 * Finans, abonman ve yikama bolumleri Asama 3-6'da eklenecek.
 */
export default async function YonetimPaneli() {
  const { start, end } = businessDayRange();

  const [kapasite, bugunGiris, bugunCikis, tahsilat, iptaller, tarifeVar] = await Promise.all([
    kapasiteDurumu(),
    prisma.parkingSession.count({ where: { entryAt: { gte: start, lt: end } } }),
    prisma.parkingSession.count({ where: { exitAt: { gte: start, lt: end }, status: "COMPLETED" } }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { status: "CONFIRMED", direction: "IN", paidAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.parkingSession.count({ where: { status: "VOIDED", voidedAt: { gte: start, lt: end } } }),
    prisma.tariffVersion.count({
      where: {
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        tariffPlan: { isActive: true },
      },
    }),
  ]);

  const nakit = toKurus(tahsilat.find((t) => t.method === "CASH")?._sum.amount ?? 0);
  const kart = toKurus(tahsilat.find((t) => t.method === "CARD")?._sum.amount ?? 0);
  const toplam = tahsilat.reduce((t, x) => t + toKurus(x._sum.amount ?? 0), 0);

  // Uzun suredir iceride kalan araclar: muhtemel hatali kayit veya kacak.
  const uzunSureliler = await prisma.parkingSession.count({
    where: { status: "ACTIVE", entryAt: { lt: new Date(Date.now() - 48 * 3600_000) } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">İşletme durumu</h1>

      {tarifeVar === 0 ? (
        <Alert tur="uyari" baslik="Otopark tarifesi henüz girilmemiş">
          Tarife girilmeden araç çıkışlarında ücret hesaplanamaz. Araç girişi engellenmez ama
          tahsilat 0 ₺ olarak kaydedilir ve işleme not düşülür.{" "}
          <strong>Tarifeler sekmesinden fiyat girebilirsiniz.</strong>
        </Alert>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Otoparkta" deger={kapasite.aktif} renk="lacivert" />
        <SayacKarti etiket="Giriş bugün" deger={bugunGiris} renk="mavi" />
        <SayacKarti etiket="Çıkış bugün" deger={bugunCikis} renk="mavi" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bugünkü otopark tahsilatı</CardTitle>
        </CardHeader>
        <CardBody>
          {toplam === 0 ? (
            <p className="text-sm text-slate-500">Bugün tahsilat kaydı yok.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Nakit</span>
                <Tutar kurus={nakit} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kart (elle kaydedilen)</span>
                <Tutar kurus={kart} />
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-bold text-lacivert-700">Toplam</span>
                <Tutar kurus={toplam} boyut="normal" />
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Yönetim amaçlı özettir; resmî muhasebe kaydı yerine geçmez.
          </p>
        </CardBody>
      </Card>

      {kapasite.tanimli ? (
        <Card>
          <CardBody className="pt-4">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-slate-600">Doluluk</span>
              <span className="rakam font-bold text-lacivert-700">
                {kapasite.aktif}/{kapasite.limit} · %{kapasite.yuzde}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-mavi-500"
                style={{ width: `${Math.min(100, kapasite.yuzde ?? 0)}%` }}
              />
            </div>
          </CardBody>
        </Card>
      ) : (
        <Alert tur="bilgi" baslik="Kapasite girilmemiş">
          İşletme sekmesinden kapasite girebilirsiniz. Girilmediği sürece araç girişi
          engellenmez.
        </Alert>
      )}

      {uzunSureliler > 0 || iptaller > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Uyarılar</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              {uzunSureliler > 0 ? (
                <li className="text-uyari">
                  ⚠ {uzunSureliler} araç 48 saatten uzun süredir otoparkta görünüyor.
                </li>
              ) : null}
              {iptaller > 0 ? (
                <li className="text-uyari">⚠ Bugün {iptaller} işlem iptal edildi.</li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Alert tur="bilgi" baslik="Bu panel Aşama 2 kapsamındadır">
        Abonman, oto yıkama, gelir-gider ve kasa bölümleri Aşama 3-5&apos;te eklenecek.
      </Alert>
    </div>
  );
}
