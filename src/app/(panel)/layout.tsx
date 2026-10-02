import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { AltGezinme } from "@/components/panel/alt-gezinme";
import { UstBar } from "@/components/panel/ust-bar";

/**
 * Panel duzeni - SUNUCU TARAFI OTURUM KONTROLU.
 *
 * Bu layout altindaki her sayfa oturum gerektirir. Oturum yoksa sayfa icerigi
 * hic uretilmez, kullanici giris ekranina yonlendirilir.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/giris");

  // Baslangic parolasi degistirilmeden panele girilemez.
  if (user.mustChangePassword) redirect("/parola-degistir");

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <UstBar kullanici={{ fullName: user.fullName, role: user.role, jobTitle: user.jobTitle }} />

      {/* pb-20: alt gezinme cubugunun altinda icerik kalmasin. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">{children}</main>

      <AltGezinme />
    </div>
  );
}
