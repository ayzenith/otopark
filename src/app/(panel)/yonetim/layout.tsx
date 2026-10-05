import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/server/auth/session";

/**
 * YONETIM BOLUMU - yalnizca patron.
 *
 * Sunucu tarafi rol kontrolu: OWNER olmayan kullanici bu layout altindaki
 * hicbir sayfanin icerigini uretemez.
 */
export default async function YonetimLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (user.role !== "OWNER") redirect("/vardiya");

  return (
    <div className="space-y-4">
      {/* Sekmeler sarmalanir: mobilde yatay kaydirma olmaz. */}
      <nav aria-label="Yönetim" className="flex flex-wrap gap-2">
        {[
          { href: "/yonetim", etiket: "Panel" },
          { href: "/yonetim/abonman", etiket: "Abonman" },
          { href: "/yonetim/yikama", etiket: "Yıkama" },
          { href: "/yonetim/finans", etiket: "Gelir / Gider" },
          { href: "/yonetim/kasa", etiket: "Kasa" },
          { href: "/yonetim/personel", etiket: "Personel" },
          { href: "/yonetim/denetim", etiket: "Denetim" },
          { href: "/yonetim/ayarlar/tarifeler", etiket: "Tarifeler" },
          { href: "/yonetim/ayarlar/yikama", etiket: "Yıkama fiyatları" },
          { href: "/yonetim/ayarlar/isletme", etiket: "İşletme" },
          { href: "/yonetim/site", etiket: "Web sitesi" },
        ].map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex h-12 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-lacivert-700"
          >
            {s.etiket}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
