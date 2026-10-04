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
      <nav aria-label="Yönetim" className="flex flex-wrap gap-2">
        <Link
          href="/yonetim"
          className="flex h-12 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-lacivert-700"
        >
          Panel
        </Link>
        <Link
          href="/yonetim/ayarlar/tarifeler"
          className="flex h-12 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-lacivert-700"
        >
          Tarifeler
        </Link>
        <Link
          href="/yonetim/ayarlar/isletme"
          className="flex h-12 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-lacivert-700"
        >
          İşletme
        </Link>
      </nav>
      {children}
    </div>
  );
}
