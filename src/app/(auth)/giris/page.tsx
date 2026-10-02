import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { GirisFormu } from "./giris-formu";

export const metadata = { title: "Giriş" };

export default async function GirisSayfasi() {
  // Oturum zaten aciksa dogrudan vardiya ekranina.
  const user = await getSession();
  if (user) redirect("/vardiya");

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-lacivert-600 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
            🅿️
          </div>
          <h1 className="text-2xl font-extrabold leading-tight text-white">
            Londra Camping Otopark
          </h1>
          <p className="mt-1 text-sm text-mavi-200">İşletme yönetim sistemi</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-xl">
          <GirisFormu />
        </div>

        <p className="mt-6 text-center text-xs text-mavi-200/70">
          Yetkisiz erişim denemeleri kayıt altına alınır.
        </p>
      </div>
    </main>
  );
}
