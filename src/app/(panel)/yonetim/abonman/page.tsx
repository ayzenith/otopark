import Link from "next/link";
import { Alert, Card, CardBody, SayacKarti } from "@/components/ui";
import { abonmanSayaclari } from "@/server/subscription/queries";

export const metadata = { title: "Abonman yönetimi" };
export const dynamic = "force-dynamic";

/**
 * ABONMAN YONETIMI - patron panelindeki giris noktasi.
 *
 * Patronun istedigi ekranlarin tamami buradan tek dokunusla acilir.
 * "Suresi yaklasanlar", "suresi dolanlar" ve "odenmemis abonmanlar"
 * abonman listesinin filtreleridir ve kendi URL'lerine sahiptir.
 */
export default async function AbonmanYonetimiSayfasi() {
  const s = await abonmanSayaclari();

  const bolumler = [
    { href: "/musteriler", etiket: "Müşteriler", aciklama: "Profil, araçlar, abonman geçmişi", sayac: s.musteri },
    { href: "/abonmanlar", etiket: "Abonmanlar", aciklama: "Tüm abonmanlar ve dönemleri", sayac: null },
    { href: "/abonmanli-araclar", etiket: "Abonmanlı araçlar", aciklama: "Şu anda kapsamdaki plakalar", sayac: s.abonmanliArac },
    { href: "/abonmanlar?filtre=yaklasan", etiket: "Süresi yaklaşanlar", aciklama: "7 gün içinde dolacaklar", sayac: s.yaklasan },
    { href: "/abonmanlar?filtre=dolmus", etiket: "Süresi dolanlar", aciklama: "Normal tarifeye düşmüş abonmanlar", sayac: s.dolmus },
    { href: "/abonmanlar?filtre=odenmemis", etiket: "Ödenmemiş abonmanlar", aciklama: "Geçerli sayılır; yalnızca takip listesi", sayac: s.odenmemis },
    { href: "/yonetim/abonman/odemeler", etiket: "Abonman ödeme geçmişi", aciklama: "Tüm tahsilatlar ve tahsil eden kişi", sayac: null },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Abonman yönetimi</h1>

      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Aktif" deger={s.aktif} renk="lacivert" />
        <SayacKarti etiket="Yaklaşan" deger={s.yaklasan} renk={s.yaklasan > 0 ? "uyari" : "mavi"} />
        <SayacKarti
          etiket="Ödenmemiş"
          deger={s.odenmemis}
          renk={s.odenmemis > 0 ? "uyari" : "mavi"}
        />
      </div>

      {s.yaklasan > 0 ? (
        <Alert tur="uyari" baslik={`${s.yaklasan} abonmanın süresi 7 gün içinde doluyor`}>
          <Link href="/abonmanlar?filtre=yaklasan" className="underline">
            Listeyi aç
          </Link>
        </Alert>
      ) : null}

      {s.odenmemis > 0 ? (
        <Alert tur="uyari" baslik={`${s.odenmemis} abonmanın ödemesi alınmamış`}>
          Bu abonmanlar <strong>geçerli sayılır</strong> ve araç girişi engellenmez (karar S9).{" "}
          <Link href="/abonmanlar?filtre=odenmemis" className="underline">
            Listeyi aç
          </Link>
        </Alert>
      ) : null}

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
                  {b.sayac !== null ? (
                    <span className="rakam shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold text-slate-600">
                      {b.sayac}
                    </span>
                  ) : null}
                </Link>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Alert tur="bilgi" baslik="Abonman fiyatları müşteriye özeldir">
        Sistemde genel bir &quot;aylık abonman = X ₺&quot; fiyatı yoktur. Her abonmanın ücreti
        o müşteriyle anlaştığınız tutardır ve geçmiş dönemler değişmez.
      </Alert>
    </div>
  );
}
