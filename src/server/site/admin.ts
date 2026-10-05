/**
 * KURUMSAL SİTE - İÇERİK YÖNETİMİ (patron paneli)
 *
 * Sitedeki her metin, her fiyat satırı ve her görsel BURADAN yazılır; koda
 * gömülü içerik yoktur. Gerekçe mimari kural 1'in içerik karşılığıdır: işletme
 * bilgisi değişince kod değişmez, patron panelden günceller.
 *
 * FİYAT UYARISI: buraya yazılan fiyat SERBEST METİNDİR ("100 ₺ / ilk saat").
 * Otopark tarifesinden veya yıkama fiyat tablosundan OTOMATİK KOPYALANMAZ.
 * İki sebep var:
 *   1. Site fiyatı "vitrin" metnidir; tarife motoru ise kuruş hesabı yapar.
 *      Birini diğerine bağlamak, tarifede yapılan bir düzeltmenin sitede
 *      istenmeden yayına çıkmasına yol açar.
 *   2. İşletme hangi fiyatın sitede yazacağına henüz karar vermedi (S19).
 * Bu ayrım mimari kural 11'in (otopark/yıkama fiyatlandırması ayrıdır)
 * doğal uzantısıdır.
 *
 * Site içeriği FİNANSAL KAYIT DEĞİLDİR; bu yüzden satır silmek serbesttir
 * (kural 4 yalnızca para kayıtları içindir). Yine de her değişiklik denetim
 * kaydı üretir.
 */

import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import type { SessionUser } from "@/server/auth/session";
import { SITE_SAYFA_ANAHTARLARI, SITE_SAYFA_BASLIKLARI } from "./queries";

const ANAHTARLAR = Object.values(SITE_SAYFA_ANAHTARLARI) as string[];

export const SiteSayfaSemasi = z.object({
  anahtar: z
    .string()
    .refine((v) => ANAHTARLAR.includes(v), { message: "Tanımsız sayfa anahtarı." }),
  baslik: z.string().trim().min(2, "Başlık en az 2 karakter olmalı.").max(80),
  govde: z.string().max(20_000, "Sayfa metni çok uzun (en fazla 20.000 karakter)."),
  yayinda: z.boolean(),
});

export type SiteSayfaGirdisi = z.infer<typeof SiteSayfaSemasi>;

export const SiteFiyatSemasi = z.object({
  id: z.string().optional(),
  etiket: z.string().trim().min(2, "Etiket en az 2 karakter olmalı.").max(80),
  fiyatMetni: z.string().trim().min(1, "Fiyat metni boş olamaz.").max(80),
  sira: z.number().int().min(0).max(999),
  yayinda: z.boolean(),
  not: z.string().trim().max(200).optional(),
});

export type SiteFiyatGirdisi = z.infer<typeof SiteFiyatSemasi>;

export const SiteGorselSemasi = z.object({
  id: z.string().optional(),
  url: z
    .string()
    .trim()
    .min(1, "Görsel adresi boş olamaz.")
    .max(500)
    .refine((v) => v.startsWith("/") || v.startsWith("https://"), {
      message: "Görsel adresi '/' ile başlamalı (sunucudaki dosya) veya https:// olmalı.",
    }),
  alt: z.string().trim().min(2, "Görsel açıklaması en az 2 karakter olmalı.").max(140),
  sira: z.number().int().min(0).max(999),
  yayinda: z.boolean(),
});

export type SiteGorselGirdisi = z.infer<typeof SiteGorselSemasi>;

/**
 * Sayfa metnini kaydeder (varsa günceller, yoksa oluşturur).
 *
 * Yayına almak için metin ZORUNLUDUR: boş bir sayfayı yayına almak ziyaretçiye
 * yarım bir site gösterir. Taslak olarak boş bırakmak serbesttir.
 */
export async function siteSayfasiKaydet(actor: SessionUser, girdi: SiteSayfaGirdisi) {
  const veri = SiteSayfaSemasi.parse(girdi);

  if (veri.yayinda && veri.govde.trim() === "") {
    throw new IslemHatasi(
      "BOS_SAYFA_YAYINLANAMAZ",
      `"${veri.baslik}" sayfası boş olduğu için yayına alınamaz. Önce metni yazın ya da yayından kaldırın.`,
    );
  }

  const onceki = await prisma.sitePage.findUnique({ where: { key: veri.anahtar } });

  const kayit = await prisma.sitePage.upsert({
    where: { key: veri.anahtar },
    create: {
      key: veri.anahtar,
      title: veri.baslik,
      bodyMarkdown: veri.govde,
      isPublished: veri.yayinda,
      updatedById: actor.id,
    },
    update: {
      title: veri.baslik,
      bodyMarkdown: veri.govde,
      isPublished: veri.yayinda,
      updatedById: actor.id,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SITE_CONTENT_UPDATE,
    entityType: "SitePage",
    entityId: kayit.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: onceki
      ? { baslik: onceki.title, yayinda: onceki.isPublished, uzunluk: onceki.bodyMarkdown.length }
      : null,
    after: { baslik: kayit.title, yayinda: kayit.isPublished, uzunluk: kayit.bodyMarkdown.length },
    note: `Site sayfası: ${SITE_SAYFA_BASLIKLARI[veri.anahtar as keyof typeof SITE_SAYFA_BASLIKLARI]}`,
  });

  return kayit;
}

/** Sitede gösterilecek fiyat satırını yazar. `id` verilirse günceller. */
export async function siteFiyatiKaydet(actor: SessionUser, girdi: SiteFiyatGirdisi) {
  const veri = SiteFiyatSemasi.parse(girdi);

  const onceki = veri.id
    ? await prisma.sitePublicPrice.findUnique({ where: { id: veri.id } })
    : null;
  if (veri.id && !onceki) {
    throw new IslemHatasi("FIYAT_SATIRI_YOK", "Güncellenmek istenen fiyat satırı bulunamadı.");
  }

  const alanlar = {
    label: veri.etiket,
    priceText: veri.fiyatMetni,
    sortOrder: veri.sira,
    isPublished: veri.yayinda,
    sourceNote: veri.not?.trim() || null,
    updatedById: actor.id,
  };

  const kayit = onceki
    ? await prisma.sitePublicPrice.update({ where: { id: onceki.id }, data: alanlar })
    : await prisma.sitePublicPrice.create({ data: alanlar });

  await writeAudit({
    action: AUDIT_ACTIONS.SITE_CONTENT_UPDATE,
    entityType: "SitePublicPrice",
    entityId: kayit.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: onceki
      ? { etiket: onceki.label, fiyat: onceki.priceText, yayinda: onceki.isPublished }
      : null,
    after: { etiket: kayit.label, fiyat: kayit.priceText, yayinda: kayit.isPublished },
    note: "Sitede gösterilen fiyat satırı",
  });

  return kayit;
}

/** Fiyat satırını siler. Site içeriği finansal kayıt değildir, silinebilir. */
export async function siteFiyatiSil(actor: SessionUser, id: string) {
  const onceki = await prisma.sitePublicPrice.findUnique({ where: { id } });
  if (!onceki) {
    throw new IslemHatasi("FIYAT_SATIRI_YOK", "Silinmek istenen fiyat satırı bulunamadı.");
  }

  await prisma.sitePublicPrice.delete({ where: { id } });

  await writeAudit({
    action: AUDIT_ACTIONS.SITE_CONTENT_UPDATE,
    entityType: "SitePublicPrice",
    entityId: id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { etiket: onceki.label, fiyat: onceki.priceText, yayinda: onceki.isPublished },
    after: null,
    note: "Sitede gösterilen fiyat satırı silindi",
  });
}

/** Galeri görseli ekler/günceller. */
export async function siteGorseliKaydet(actor: SessionUser, girdi: SiteGorselGirdisi) {
  const veri = SiteGorselSemasi.parse(girdi);

  const onceki = veri.id
    ? await prisma.siteGalleryImage.findUnique({ where: { id: veri.id } })
    : null;
  if (veri.id && !onceki) {
    throw new IslemHatasi("GORSEL_YOK", "Güncellenmek istenen görsel bulunamadı.");
  }

  const alanlar = {
    url: veri.url,
    alt: veri.alt,
    sortOrder: veri.sira,
    isPublished: veri.yayinda,
  };

  const kayit = onceki
    ? await prisma.siteGalleryImage.update({ where: { id: onceki.id }, data: alanlar })
    : await prisma.siteGalleryImage.create({ data: alanlar });

  await writeAudit({
    action: AUDIT_ACTIONS.SITE_CONTENT_UPDATE,
    entityType: "SiteGalleryImage",
    entityId: kayit.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: onceki ? { url: onceki.url, yayinda: onceki.isPublished } : null,
    after: { url: kayit.url, yayinda: kayit.isPublished },
    note: "Site galeri görseli",
  });

  return kayit;
}

/** Galeri görselini siler. */
export async function siteGorseliSil(actor: SessionUser, id: string) {
  const onceki = await prisma.siteGalleryImage.findUnique({ where: { id } });
  if (!onceki) throw new IslemHatasi("GORSEL_YOK", "Silinmek istenen görsel bulunamadı.");

  await prisma.siteGalleryImage.delete({ where: { id } });

  await writeAudit({
    action: AUDIT_ACTIONS.SITE_CONTENT_UPDATE,
    entityType: "SiteGalleryImage",
    entityId: id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { url: onceki.url, yayinda: onceki.isPublished },
    after: null,
    note: "Site galeri görseli silindi",
  });
}
