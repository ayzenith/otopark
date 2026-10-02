import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { ParolaFormu } from "./parola-formu";
import { Alert } from "@/components/ui";

export const metadata = { title: "Parola Değiştir" };

/**
 * Baslangic parolasiyla giren kullanici bu ekrani gecmeden panele ulasamaz;
 * panel layout'u mustChangePassword=true oldugunda buraya yonlendirir.
 */
export default async function ParolaDegistirSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-lacivert-600 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-extrabold text-white">Parola değiştir</h1>
        <p className="mb-6 text-center text-sm text-mavi-200">{user.fullName}</p>

        <div className="rounded-2xl bg-white p-5 shadow-xl">
          {user.mustChangePassword ? (
            <Alert tur="uyari" baslik="Başlangıç parolanızı değiştirmelisiniz" className="mb-4">
              Güvenliğiniz için devam etmeden önce kendi parolanızı belirleyin.
            </Alert>
          ) : null}
          <ParolaFormu />
        </div>
      </div>
    </main>
  );
}
