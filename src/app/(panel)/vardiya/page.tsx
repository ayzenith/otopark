import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet, SayacKarti } from "@/components/ui";
import { IslemPaneli } from "@/components/panel/islem-paneli";
import { VardiyaBaslatButonu, VardiyaKapatButonu } from "@/components/panel/vardiya-butonu";
import { Tutar } from "@/components/panel/para";
import { prisma } from "@/server/db";
import { acikVardiya } from "@/server/shift";
import { kapasiteDurumu } from "@/server/parking/entry";
import { anaEkranSayaclari, sonIslemler } from "@/server/parking/queries";
import { formatDuration, formatTime } from "@/lib/datetime";

export const metadata = { title: "Vardiya" };
export const dynamic = "force-dynamic";

/**
 * PERSONEL MOBIL ANA EKRANI
 *
 * Taslak ve gerekceler: docs/04-ekranlar-ve-akislar.md (4.2)
 * Islem akisi: plaka gir -> giris / cikis sorgula -> ucret -> nakit/kart -> onay
 */
export default async function VardiyaSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  const tahsilatGorebilir = user.permissions.has(PERMISSIONS.CASH_REPORT_SELF);
  const cikisYetkisi = user.permissions.has(PERMISSIONS.PARKING_EXIT);

  const [vardiya, sayaclar, kapasite, islemler, siniflar] = await Promise.all([
    acikVardiya(user.id),
    anaEkranSayaclari(user.id, tahsilatGorebilir),
    kapasiteDurumu(),
    sonIslemler(8),
    prisma.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      {/* Vardiya durumu */}
      {vardiya ? (
        <p className="text-sm text-slate-500">
          Vardiya: <strong>{formatTime(vardiya.startedAt)}</strong>&apos;den beri açık
        </p>
      ) : (
        <VardiyaBaslatButonu />
      )}

      {/* ---- İŞLEM PANELİ: ekranın en belirgin öğesi ---- */}
      <IslemPaneli
        vardiyaAcik={vardiya !== null}
        cikisYetkisi={cikisYetkisi}
        aracSiniflari={siniflar.map((s) => ({ id: s.id, ad: s.name }))}
      />

      {/* ---- SAYAÇLAR ---- */}
      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Otoparkta" deger={sayaclar.otoparktaki} renk="lacivert" />
        <SayacKarti etiket="Giriş bugün" deger={sayaclar.bugunGiris} renk="mavi" />
        <SayacKarti etiket="Çıkış bugün" deger={sayaclar.bugunCikis} renk="mavi" />
      </div>

      {/* ---- KAPASİTE: yalnızca tanımlıysa gösterilir ---- */}
      {kapasite.tanimli ? (
        <Card>
          <CardBody className="pt-4">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-slate-600">Kapasite</span>
              <span className="rakam font-bold text-lacivert-700">
                {kapasite.aktif}/{kapasite.limit} · %{kapasite.yuzde}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${
                  (kapasite.yuzde ?? 0) >= kapasite.uyariEsigi ? "bg-uyari" : "bg-mavi-500"
                }`}
                style={{ width: `${Math.min(100, kapasite.yuzde ?? 0)}%` }}
              />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* ---- TAHSİLAT ÖZETİ: yalnızca yetkisi olana çizilir ---- */}
      {tahsilatGorebilir ? (
        <Card>
          <CardHeader>
            <CardTitle>Benim tahsilatım (bugün)</CardTitle>
          </CardHeader>
          <CardBody>
            {sayaclar.tahsilat.toplam === 0 ? (
              <p className="text-sm text-slate-500">Bugün henüz tahsilat yapılmadı.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nakit</span>
                  <Tutar kurus={sayaclar.tahsilat.nakit} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kart</span>
                  <Tutar kurus={sayaclar.tahsilat.kart} />
                </div>
                {sayaclar.tahsilat.diger > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diğer</span>
                    <Tutar kurus={sayaclar.tahsilat.diger} />
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-bold text-lacivert-700">Toplam</span>
                  <Tutar kurus={sayaclar.tahsilat.toplam} boyut="normal" />
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* ---- SON İŞLEMLER ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Son işlemler</CardTitle>
        </CardHeader>
        <CardBody>
          {islemler.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz işlem kaydı yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {islemler.map((i) => (
                <li key={`${i.id}-${i.tur}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold tracking-wide text-lacivert-800">
                        {i.plaka}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase ${
                          i.tur === "CIKIS" ? "text-basari" : "text-mavi-600"
                        }`}
                      >
                        {i.tur === "CIKIS" ? "ÇIKIŞ" : "GİRİŞ"}
                      </span>
                      {i.abonmanli ? <Rozet tur="basari">ABONMANLI</Rozet> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatTime(i.an)}
                      {i.sureDakika !== null ? ` · ${formatDuration(i.sureDakika)}` : ""}
                      {i.yontem ? ` · ${i.yontem === "CASH" ? "Nakit" : "Kart"}` : ""}
                    </div>
                  </div>
                  {i.tutarKurus !== null && i.tutarKurus > 0 ? (
                    <Tutar kurus={i.tutarKurus} boyut="kucuk" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---- HIZLI EYLEMLER ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/yikama"
          className="flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-lacivert-700"
        >
          🧼 YIKAMA
        </Link>
        <Link
          href="/araclar"
          className="flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-lacivert-700"
        >
          🚗 AKTİF ARAÇLAR
        </Link>
      </div>

      {vardiya ? <VardiyaKapatButonu /> : null}

      {!kapasite.tanimli ? (
        <Alert tur="bilgi" baslik="Otopark kapasitesi girilmemiş">
          Kapasite tanımlanmadığı için araç girişi engellenmiyor. Patron panelinden kapasite
          girildiğinde doluluk burada görünecek.
        </Alert>
      ) : null}
    </div>
  );
}
