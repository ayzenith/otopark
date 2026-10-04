import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { MusteriFormu } from "../../formlar";

export const metadata = { title: "Müşteri düzenle" };
export const dynamic = "force-dynamic";

export default async function MusteriDuzenleSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.CUSTOMER_EDIT)) redirect("/musteriler");

  const { id } = await params;
  const musteri = await prisma.customer.findUnique({ where: { id } });
  if (!musteri) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/musteriler/${id}`} className="inline-flex h-12 items-center text-mavi-600">
        ← {musteri.fullName}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Müşteri bilgileri</CardTitle>
        </CardHeader>
        <CardBody>
          <MusteriFormu
            varsayilan={{
              id: musteri.id,
              adSoyad: musteri.fullName,
              telefon: musteri.phone,
              ikinciTelefon: musteri.altPhone,
              eposta: musteri.email,
              kurumsalMi: musteri.isCompany,
              firmaAdi: musteri.companyName,
              vergiNo: musteri.taxId,
              notlar: musteri.notes,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
