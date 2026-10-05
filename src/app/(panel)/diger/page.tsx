import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";
import { Card, CardBody } from "@/components/ui";
import { CikisButonu } from "@/components/panel/cikis-butonu";

export const metadata = { title: "Diğer" };

/**
 * "Diger" sekmesi - alt gezinmeye sigmayan bolumler.
 * Her baglanti kullanicinin IZNINE gore cizilir; izni yoksa baglanti
 * hic gorunmez. (Guvenlik yine de sunucu tarafinda saglanir.)
 */
export default async function DigerSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  const P = PERMISSIONS;
  const has = (p: string) => user.permissions.has(p);

  // asama: henuz gelistirilmemis bolumler icin etiket. Hazir bolumlerde bos
  // birakilir, boylece personel "bu calismiyor mu?" diye tereddut etmez.
  const bolumler: { href: string; etiket: string; aciklama: string; asama?: string }[] = [];

  if (has(P.SUBSCRIPTION_VIEW))
    bolumler.push({
      href: "/abonmanlar",
      etiket: "Abonmanlar",
      aciklama: "Abonman listesi, dönemler ve tahsilat",
    });
  if (has(P.SUBSCRIPTION_VIEW))
    bolumler.push({
      href: "/abonmanli-araclar",
      etiket: "Abonmanlı araçlar",
      aciklama: "Şu anda kapsamdaki plakalar",
    });
  if (has(P.CUSTOMER_VIEW))
    bolumler.push({
      href: "/musteriler",
      etiket: "Müşteriler",
      aciklama: "Müşteri profilleri, araçları ve abonman geçmişi",
    });
  if (has(P.CASH_REPORT_SELF))
    bolumler.push({
      href: "/kasa",
      etiket: "Kasa / Vardiyam",
      aciklama: "Tahsilat özeti, kasa açma ve kapanış sayımı",
    });
  if (has(P.INVENTORY_VIEW))
    bolumler.push({
      href: "/stok",
      etiket: "Malzeme stoğu",
      aciklama: "Malzeme kartları ve stok hareketleri",
    });
  if (has(P.TARIFF_VIEW))
    bolumler.push({
      href: "/tarife",
      etiket: "Fiyat listesi",
      aciklama: "Geçerli otopark ve yıkama fiyatları",
    });
  if (user.role === "OWNER")
    bolumler.push({
      href: "/yonetim",
      etiket: "Yönetim paneli",
      aciklama: "Abonmanlar, finans, raporlar, ayarlar",
    });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">{user.fullName}</h1>
        <p className="text-sm text-slate-500">
          {user.jobTitle || ROLE_LABELS[user.role]} · {user.username}
        </p>
      </div>

      <ul className="space-y-2">
        {bolumler.map((b) => (
          <li key={b.href}>
            <Card>
              <CardBody className="pt-4">
                <Link href={b.href} className="flex min-h-12 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-bold text-lacivert-700">{b.etiket}</span>
                    <span className="block text-sm text-slate-500">{b.aciklama}</span>
                  </span>
                  {b.asama ? (
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                      {b.asama}
                    </span>
                  ) : null}
                </Link>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <CardBody className="pt-4">
          <Link href="/hesabim" className="flex min-h-12 items-center font-bold text-lacivert-700">
            Hesabım ve parola
          </Link>
        </CardBody>
      </Card>

      <CikisButonu />
    </div>
  );
}
