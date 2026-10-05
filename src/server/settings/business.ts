/**
 * İŞLETME KÜNYESİ (ad, adres, telefon, çalışma saatleri, bağlantılar)
 *
 * Bu bilgiler hem kurumsal sitede hem panelde görünür. İŞLETME HENÜZ
 * VERMEDİ (docs/07 S18): bu yüzden hiçbiri koda gömülmez, seed'e yazılmaz ve
 * varsayılan değer uydurulmaz. Girilmeyen alan BOŞ kalır ve site o bölümü
 * hiç çizmez.
 *
 * Telefon biçimi ZORLANMAZ: işletme numarasını nasıl yazmak istiyorsa öyle
 * görünür (0532 ... / +90 532 ... / sabit hat). Yalnızca `tel:` bağlantısı
 * üretilirken boşluklar temizlenir. Zorlayıcı bir biçim kuralı, geçerli ama
 * beklenmedik yazımları (dahili numara gibi) reddederdi.
 */

import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";

/** Boş metni null'a çevirir: "girilmedi" ile "boş yazıldı" aynı şeydir. */
const bosNull = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v));

const httpsAdres = bosNull.refine((v) => v === null || /^https?:\/\//i.test(v), {
  message: "Bağlantı http:// veya https:// ile başlamalı.",
});

export const IsletmeKunyesiSemasi = z.object({
  isletmeAdi: z.string().trim().min(2, "İşletme adı en az 2 karakter olmalı.").max(120),
  adres: bosNull,
  telefon: bosNull.refine((v) => v === null || v.length >= 7, {
    message: "Telefon en az 7 karakter olmalı.",
  }),
  whatsapp: bosNull,
  calismaSaatleri: bosNull,
  mapsUrl: httpsAdres,
  instagramUrl: httpsAdres,
});

export type IsletmeKunyesiGirdisi = z.infer<typeof IsletmeKunyesiSemasi>;

export async function isletmeKunyesi() {
  return prisma.businessSetting.findUnique({ where: { id: "singleton" } });
}

export async function isletmeKunyesiKaydet(actor: SessionUser, girdi: IsletmeKunyesiGirdisi) {
  const veri = IsletmeKunyesiSemasi.parse(girdi);

  const onceki = await prisma.businessSetting.findUnique({ where: { id: "singleton" } });

  const alanlar = {
    businessName: veri.isletmeAdi,
    addressText: veri.adres ?? "",
    phone: veri.telefon ?? "",
    whatsappPhone: veri.whatsapp,
    workingHoursText: veri.calismaSaatleri ?? "",
    mapsUrl: veri.mapsUrl,
    instagramUrl: veri.instagramUrl,
    updatedById: actor.id,
  };

  const kayit = await prisma.businessSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...alanlar },
    update: alanlar,
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "BusinessSetting",
    entityId: kayit.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: onceki
      ? {
          isletmeAdi: onceki.businessName,
          adres: onceki.addressText,
          telefon: onceki.phone,
          calismaSaatleri: onceki.workingHoursText,
        }
      : null,
    after: {
      isletmeAdi: kayit.businessName,
      adres: kayit.addressText,
      telefon: kayit.phone,
      calismaSaatleri: kayit.workingHoursText,
    },
    note: "İşletme künyesi güncellendi",
  });

  return kayit;
}
