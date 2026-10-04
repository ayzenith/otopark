import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { MusteriFormu } from "../formlar";

export const metadata = { title: "Yeni müşteri" };

export default async function YeniMusteriSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.CUSTOMER_CREATE)) redirect("/musteriler");

  return (
    <div className="space-y-4">
      <Link href="/musteriler" className="inline-flex h-12 items-center text-mavi-600">
        ← Müşteriler
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Yeni müşteri</CardTitle>
        </CardHeader>
        <CardBody>
          <MusteriFormu />
        </CardBody>
      </Card>
    </div>
  );
}
