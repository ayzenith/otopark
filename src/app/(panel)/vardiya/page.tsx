import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, PlakaInput, SayacKarti } from "@/components/ui";
import { prisma } from "@/server/db";
import { businessDayRange, formatTime } from "@/lib/datetime";

export const metadata = { title: "Vardiya" };

/**
 * PERSONEL MOBIL ANA EKRANI - projenin en onemli ekranlarindan biri.
 * Taslak ve gerekceler: docs/04-ekranlar-ve-akislar.md (4.2)
 *
 * AŞAMA 1 DURUMU: ekran kabugu ve sayaçlar hazır. Plaka girişi ve araç
 * giriş/çıkış butonları Aşama 2'de işlevsel hale gelecek; şu an devre dışı
 * ve bu durum kullanıcıya açıkça bildiriliyor (çalışmayan buton gösterip
 * personeli yanıltmamak için).
 */
export default async function VardiyaSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  const { start, end } = businessDayRange();

  const [otoparktakiArac, bugunGiris, bugunCikis, acikVardiya] = await Promise.all([
    prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
    prisma.parkingSession.count({ where: { entryAt: { gte: start, lt: end } } }),
    prisma.parkingSession.count({ where: { exitAt: { gte: start, lt: end } } }),
    prisma.shift.findFirst({
      where: { userId: user.id, status: "OPEN" },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const kapasiteAyari = await prisma.parkingCapacitySetting.findUnique({
    where: { id: "singleton" },
  });
  const kapasite = kapasiteAyari?.totalCapacity ?? 0;
  const doluluk = kapasite > 0 ? Math.round((otoparktakiArac / kapasite) * 100) : null;

  const tahsilatGorebilir = user.permissions.has(PERMISSIONS.CASH_REPORT_SELF);

  return (
    <div className="space-y-4">
      {acikVardiya ? (
        <p className="text-sm text-slate-500">
          Vardiya: <strong>{formatTime(acikVardiya.startedAt)}</strong>&apos;den beri açık
        </p>
      ) : (
        <Alert tur="bilgi" baslik="Vardiyanız açık değil">
          Vardiya başlatma Aşama 2&apos;de eklenecek.
        </Alert>
      )}

      {/* ---- PLAKA GIRISI: ekranin en belirgin ogesi ---- */}
      <Card className="border-lacivert-200">
        <CardBody className="pt-4">
          <PlakaInput disabled />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="birincil" size="islem" disabled>
              ↓ ARAÇ GİRİŞİ
            </Button>
            <Button variant="ikincil" size="islem" disabled>
              ↑ ÇIKIŞ / SORGULA
            </Button>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-uyari">
            Araç giriş-çıkış işlemleri Aşama 2&apos;de devreye alınacak.
          </p>
        </CardBody>
      </Card>

      {/* ---- SAYAÇLAR ---- */}
      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Otoparkta" deger={otoparktakiArac} renk="lacivert" />
        <SayacKarti etiket="Giriş bugün" deger={bugunGiris} renk="mavi" />
        <SayacKarti etiket="Çıkış bugün" deger={bugunCikis} renk="mavi" />
      </div>

      {kapasite > 0 ? (
        <Card>
          <CardBody className="pt-4">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-slate-600">Kapasite</span>
              <span className="rakam font-bold text-lacivert-700">
                {otoparktakiArac}/{kapasite} · %{doluluk}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-mavi-500"
                style={{ width: `${Math.min(100, doluluk ?? 0)}%` }}
              />
            </div>
          </CardBody>
        </Card>
      ) : (
        <Alert tur="uyari" baslik="Otopark kapasitesi girilmemiş">
          Patron panelinden kapasite girildiğinde doluluk burada görünecek.
        </Alert>
      )}

      {/* ---- TAHSILAT OZETI: yalnizca yetkisi olana cizilir ---- */}
      {tahsilatGorebilir ? (
        <Card>
          <CardHeader>
            <CardTitle>Benim tahsilatım (bugün)</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-500">
              Tahsilat kaydı Aşama 2 ile başlayacak; şu an kayıt yok.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- HIZLI EYLEMLER ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="sade" size="ikincil" disabled>
          🧼 YIKAMA BAŞLAT
        </Button>
        <Button variant="sade" size="ikincil" disabled>
          🎫 ABONMAN SORGULA
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son işlemler</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-500">Henüz işlem kaydı yok.</p>
        </CardBody>
      </Card>

      <div className="pt-2 text-center">
        <Link href="/diger" className="text-sm font-semibold text-mavi-600 underline">
          Diğer bölümler
        </Link>
      </div>
    </div>
  );
}
