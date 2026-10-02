import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { CikisButonu } from "@/components/panel/cikis-butonu";
import { PERMISSION_LABELS, ROLE_LABELS } from "@/lib/permissions";

export const metadata = { title: "Hesabım" };

export default async function HesabimSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  const izinler = [...user.permissions].sort();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Hesabım</h1>

      <Card>
        <CardBody className="space-y-2 pt-4 text-sm">
          <Satir etiket="Ad soyad" deger={user.fullName} />
          <Satir etiket="Kullanıcı adı" deger={user.username} />
          <Satir etiket="Rol" deger={ROLE_LABELS[user.role]} />
          {user.jobTitle ? <Satir etiket="Görev" deger={user.jobTitle} /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-4">
          <Link
            href="/parola-degistir"
            className="flex min-h-12 items-center font-bold text-lacivert-700"
          >
            Parolamı değiştir
          </Link>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yetkilerim ({izinler.length})</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-1 text-sm text-slate-600">
            {izinler.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="text-basari">
                  ✓
                </span>
                <span>{PERMISSION_LABELS[p] ?? p}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <CikisButonu />
    </div>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{etiket}</span>
      <span className="text-right font-semibold text-lacivert-700">{deger}</span>
    </div>
  );
}
