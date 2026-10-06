/**
 * İŞLETME BİLGİLERİ — BAŞLANGIÇ DEĞERLERİ
 * ---------------------------------------------------------------------------
 * `npm run isletme:kur`
 *
 * Bu betik, işletme sahibinin **açıkça verdiği** bilgileri veritabanına
 * VERİ olarak yazar. Mimari kural 1'in künye karşılığıdır: bilgiler koda
 * gömülmez, panelden değiştirilir; bu betik yalnızca ilk kurulumda boş
 * alanları doldurur.
 *
 * İDEMPOTENT: dolu bir alanın üzerine YAZMAZ. Patron panelden bir şeyi
 * değiştirdiyse, betiği tekrar çalıştırmak o değişikliği geri almaz.
 *
 * ===========================================================================
 * KAYNAK: işletme sahibi, 05.10.2026.
 *
 *   · Telefon / WhatsApp: 0555 056 79 79 — AYNI NUMARA (teyit 06.10.2026)
 *   · Google Maps       : verilen kısa bağlantı
 *   · Çalışma saatleri  : "7/24 açık" — sahibinin ifadesiyle "bu bilgi
 *                         kesin olsun, çok önemli"
 *
 * VERİLMEYEN ve BU YÜZDEN YAZILMAYAN alanlar:
 *   · açık adres metni  — yalnızca harita bağlantısı verildi
 *   · Instagram adresi
 *   · işletmenin tam ticari unvanı
 * ===========================================================================
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** İşletme sahibinin 05.10.2026'da verdiği değerler. */
const VERILENLER = {
  /** 06.10.2026: sahibi "numara aynı" dedi — hem arama hem WhatsApp. */
  phone: "0555 056 79 79",
  whatsappPhone: "0555 056 79 79",
  mapsUrl: "https://maps.app.goo.gl/rLR4CvWx5VsCNLr5A",
  workingHoursText: "7/24 AÇIK",
} as const;

/** Sitede ana sayfada görünecek tanıtım metni (sahibinin verdiği bilgiyle sınırlı). */
const ANASAYFA_METNI = `Otoparkımız ve oto yıkamamız 7 gün 24 saat açıktır.

- Otopark
- Oto yıkama`;

function bos(deger: string | null | undefined): boolean {
  return (deger ?? "").trim() === "";
}

async function main() {
  const satirlar: string[] = [];

  const mevcut = await prisma.businessSetting.findUnique({ where: { id: "singleton" } });

  const yazilacak: Record<string, string> = {};
  if (bos(mevcut?.phone)) yazilacak.phone = VERILENLER.phone;
  if (bos(mevcut?.whatsappPhone)) yazilacak.whatsappPhone = VERILENLER.whatsappPhone;
  if (bos(mevcut?.mapsUrl)) yazilacak.mapsUrl = VERILENLER.mapsUrl;
  if (bos(mevcut?.workingHoursText)) yazilacak.workingHoursText = VERILENLER.workingHoursText;

  if (Object.keys(yazilacak).length > 0) {
    await prisma.businessSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...yazilacak },
      update: yazilacak,
    });
    for (const alan of Object.keys(yazilacak)) satirlar.push(`  YAZILDI  ${alan}`);
  } else {
    satirlar.push("  ATLANDI  künye alanları zaten dolu");
  }

  // Ana sayfa tanitim metni: YALNIZCA hic kayit yoksa yazilir. Patron metni
  // degistirdiyse ya da yayindan kaldirdiysa dokunulmaz.
  const anasayfa = await prisma.sitePage.findUnique({ where: { key: "anasayfa" } });
  if (!anasayfa) {
    await prisma.sitePage.create({
      data: {
        key: "anasayfa",
        title: "Ana sayfa",
        bodyMarkdown: ANASAYFA_METNI,
        isPublished: true,
      },
    });
    satirlar.push("  YAZILDI  ana sayfa tanıtım metni (7/24 vurgusu)");
  } else {
    satirlar.push("  ATLANDI  ana sayfa metni — zaten var");
  }

  const cizgi = "═".repeat(66);
  console.log(`\n${cizgi}\n  İŞLETME BİLGİLERİ\n${cizgi}`);
  for (const s of satirlar) console.log(s);
  console.log(cizgi);
  console.log("  HENÜZ VERİLMEDİ (kasıtlı olarak boş, uydurulmadı):");
  console.log("    · Açık adres metni (yalnızca harita bağlantısı var)");
  console.log("    · Instagram adresi, logo ve fotoğraflar");
  console.log(cizgi);
  console.log("  Bu bilgiler bundan sonra PANELDEN değiştirilir:");
  console.log("    Yönetim → İşletme ayarları   (adres, telefon, saatler, harita)");
  console.log("    Yönetim → Web sitesi         (sayfa metinleri, fiyat satırları)");
  console.log(`${cizgi}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
