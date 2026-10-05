/**
 * DENETİM KAYDI SORGULARI (okuma)
 *
 * ============================================================================
 * `AuditLog` append-only'dir (DB tetikleyicisi UPDATE ve DELETE'i reddeder).
 * Bu modül yalnızca OKUR ve filtreler.
 *
 * HASSAS ALAN KORUMASI: denetim kaydı yazılırken parola özeti, oturum jetonu
 * gibi alanlar `[gizlendi]` olarak maskelenir (src/server/audit/index.ts).
 * Burada ek bir maskeleme yapılmaz; kayıt zaten temiz yazılır.
 *
 * MAAŞ TUTARLARI denetim kaydında DURUR (maaş değişikliği izlenebilir
 * olmalı). Bu yüzden denetim ekranı `audit.view` iznine bağlıdır ve o izin
 * yalnızca patronun taban kümesindedir.
 * ============================================================================
 */

import { prisma } from "@/server/db";
import { AUDIT_ACTIONS } from "@/server/audit";

/** Ekranda gösterilen Türkçe eylem adları. */
export const EYLEM_ETIKETLERI: Record<string, string> = {
  LOGIN_SUCCESS: "Giriş yapıldı",
  LOGIN_FAIL: "Başarısız giriş denemesi",
  LOGOUT: "Çıkış yapıldı",
  PASSWORD_CHANGE: "Parola değiştirildi",
  PASSWORD_RESET: "Parola sıfırlandı",
  ACCOUNT_LOCKED: "Hesap kilitlendi",
  PERMISSION_DENIED: "Yetkisiz işlem denemesi",

  USER_CREATE: "Personel hesabı açıldı",
  USER_UPDATE: "Personel bilgisi güncellendi",
  USER_DEACTIVATE: "Hesap kapatıldı",
  USER_REACTIVATE: "Hesap yeniden açıldı",
  USER_PERMISSION_CHANGE: "Yetki değiştirildi",

  SHIFT_OPEN: "Vardiya açıldı",
  SHIFT_CLOSE: "Vardiya kapatıldı",

  PARKING_ENTRY: "Araç girişi",
  PARKING_EXIT: "Araç çıkışı",
  PARKING_VOID: "Park kaydı iptal edildi",
  PARKING_DISCOUNT: "İndirim uygulandı",
  PARKING_PRICE_OVERRIDE: "Tutar elle değiştirildi",

  PAYMENT_CREATE: "Tahsilat",
  PAYMENT_VOID: "Tahsilat iptali",

  TARIFF_VERSION_CREATE: "Tarife sürümü oluşturuldu",
  TARIFF_DEACTIVATE: "Tarife pasifleştirildi",
  WASHPRICE_UPDATE: "Yıkama fiyatı güncellendi",

  CUSTOMER_CREATE: "Müşteri eklendi",
  CUSTOMER_UPDATE: "Müşteri güncellendi",
  VEHICLE_CREATE: "Araç eklendi",
  VEHICLE_UPDATE: "Araç güncellendi",

  SUBSCRIPTION_CREATE: "Abonman oluşturuldu",
  SUBSCRIPTION_UPDATE: "Abonman güncellendi",
  SUBSCRIPTION_PRICE_CHANGE: "Abonman ücreti değişti",
  SUBSCRIPTION_RENEW: "Abonman yenilendi",
  SUBSCRIPTION_CANCEL: "Abonman iptal edildi",
  SUBSCRIPTION_PAYMENT: "Abonman tahsilatı",
  SUBSCRIPTION_PAYMENT_VOID: "Abonman tahsilatı iptali",
  SUBSCRIPTION_VEHICLE_ADD: "Abonmana plaka eklendi",
  SUBSCRIPTION_VEHICLE_REMOVE: "Abonmandan plaka çıkarıldı",
  SUBSCRIPTION_EXPIRE: "Abonman süresi doldu",
  CUSTOMER_VEHICLE_LINK: "Araç müşteriye bağlandı",
  CUSTOMER_VEHICLE_UNLINK: "Araç müşteriden ayrıldı",

  WASH_CREATE: "Yıkama kaydı açıldı",
  WASH_STATUS_CHANGE: "Yıkama durumu değişti",
  WASH_VOID: "Yıkama iptal edildi",
  WASH_ITEM_ADD: "Yıkama hizmeti eklendi",
  WASH_ITEM_REMOVE: "Yıkama hizmeti çıkarıldı",
  WASH_PAYMENT: "Yıkama tahsilatı",
  WASH_PAYMENT_VOID: "Yıkama tahsilatı iptali",
  WASH_SERVICE_CREATE: "Yıkama hizmeti tanımlandı",
  WASH_SERVICE_UPDATE: "Yıkama hizmeti güncellendi",

  DRAWER_OPEN: "Kasa açıldı",
  DRAWER_CLOSE: "Kasa kapatıldı",
  DRAWER_RECONCILE: "Kasa mutabakatı",
  CASH_MOVEMENT: "Kasa hareketi",

  EXPENSE_CREATE: "Gider kaydedildi",
  EXPENSE_VOID: "Gider iptal edildi",

  STAFF_ADVANCE_GIVE: "Personel avansı verildi",
  STAFF_ADVANCE_VOID: "Personel avansı iptal edildi",
  STAFF_SALARY_PAY: "Maaş ödendi",
  STAFF_PROFILE_UPDATE: "Personel maliyet profili güncellendi",

  SETTINGS_UPDATE: "Ayar değiştirildi",
  SITE_CONTENT_UPDATE: "Web sitesi içeriği güncellendi",
};

/** Filtre çipleri için gruplar: tek tek 60 eylem seçtirmek kullanılamaz olur. */
export const EYLEM_GRUPLARI: { kod: string; etiket: string; eylemler: string[] }[] = [
  {
    kod: "guvenlik",
    etiket: "Güvenlik",
    eylemler: [
      AUDIT_ACTIONS.LOGIN_SUCCESS,
      AUDIT_ACTIONS.LOGIN_FAIL,
      AUDIT_ACTIONS.LOGOUT,
      AUDIT_ACTIONS.PASSWORD_CHANGE,
      AUDIT_ACTIONS.PASSWORD_RESET,
      AUDIT_ACTIONS.ACCOUNT_LOCKED,
      AUDIT_ACTIONS.PERMISSION_DENIED,
    ],
  },
  {
    kod: "personel",
    etiket: "Personel",
    eylemler: [
      AUDIT_ACTIONS.USER_CREATE,
      AUDIT_ACTIONS.USER_UPDATE,
      AUDIT_ACTIONS.USER_DEACTIVATE,
      AUDIT_ACTIONS.USER_REACTIVATE,
      AUDIT_ACTIONS.USER_PERMISSION_CHANGE,
      AUDIT_ACTIONS.STAFF_PROFILE_UPDATE,
      AUDIT_ACTIONS.STAFF_ADVANCE_GIVE,
      AUDIT_ACTIONS.STAFF_ADVANCE_VOID,
      AUDIT_ACTIONS.STAFF_SALARY_PAY,
    ],
  },
  {
    kod: "para",
    etiket: "Para",
    eylemler: [
      AUDIT_ACTIONS.PAYMENT_CREATE,
      AUDIT_ACTIONS.PAYMENT_VOID,
      AUDIT_ACTIONS.DRAWER_OPEN,
      AUDIT_ACTIONS.DRAWER_CLOSE,
      AUDIT_ACTIONS.DRAWER_RECONCILE,
      AUDIT_ACTIONS.CASH_MOVEMENT,
      AUDIT_ACTIONS.EXPENSE_CREATE,
      AUDIT_ACTIONS.EXPENSE_VOID,
    ],
  },
  {
    kod: "iptal",
    etiket: "İptal ve düzeltme",
    eylemler: [
      AUDIT_ACTIONS.PARKING_VOID,
      AUDIT_ACTIONS.PARKING_DISCOUNT,
      AUDIT_ACTIONS.PARKING_PRICE_OVERRIDE,
      AUDIT_ACTIONS.PAYMENT_VOID,
      AUDIT_ACTIONS.WASH_VOID,
      AUDIT_ACTIONS.EXPENSE_VOID,
      AUDIT_ACTIONS.SUBSCRIPTION_CANCEL,
      AUDIT_ACTIONS.STAFF_ADVANCE_VOID,
    ],
  },
  {
    kod: "fiyat",
    etiket: "Fiyat ve ayar",
    eylemler: [
      AUDIT_ACTIONS.TARIFF_VERSION_CREATE,
      AUDIT_ACTIONS.TARIFF_DEACTIVATE,
      AUDIT_ACTIONS.WASHPRICE_UPDATE,
      AUDIT_ACTIONS.WASH_SERVICE_CREATE,
      AUDIT_ACTIONS.WASH_SERVICE_UPDATE,
      AUDIT_ACTIONS.SUBSCRIPTION_PRICE_CHANGE,
      AUDIT_ACTIONS.SETTINGS_UPDATE,
    ],
  },
];

export interface DenetimSatiri {
  id: string;
  at: Date;
  eylem: string;
  eylemEtiketi: string;
  kayitTuru: string;
  kayitId: string | null;
  kisi: string;
  not: string | null;
  oncesi: unknown;
  sonrasi: unknown;
  ip: string | null;
}

export interface DenetimFiltresi {
  grup?: string | null;
  eylem?: string | null;
  userId?: string | null;
  kayitTuru?: string | null;
  baslangic?: Date | null;
  bitis?: Date | null;
  limit?: number;
  imlecId?: string | null;
}

export async function denetimKayitlari(
  filtre: DenetimFiltresi = {},
): Promise<{ satirlar: DenetimSatiri[]; devamVarMi: boolean; sonId: string | null }> {
  const limit = Math.min(filtre.limit ?? 50, 200);

  const grup = filtre.grup
    ? EYLEM_GRUPLARI.find((g) => g.kod === filtre.grup)
    : undefined;

  const where = {
    ...(filtre.eylem ? { action: filtre.eylem } : grup ? { action: { in: grup.eylemler } } : {}),
    ...(filtre.userId ? { userId: filtre.userId } : {}),
    ...(filtre.kayitTuru ? { entityType: filtre.kayitTuru } : {}),
    ...(filtre.baslangic || filtre.bitis
      ? {
          // AuditLog zaman alanı `at` (createdAt değil).
          at: {
            ...(filtre.baslangic ? { gte: filtre.baslangic } : {}),
            ...(filtre.bitis ? { lt: filtre.bitis } : {}),
          },
        }
      : {}),
  };

  // +1 satır çekip "devamı var mı" sorusunu ek sorgu atmadan yanıtlarız.
  const kayitlar = await prisma.auditLog.findMany({
    where,
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filtre.imlecId ? { cursor: { id: filtre.imlecId }, skip: 1 } : {}),
  });

  const devamVarMi = kayitlar.length > limit;
  const sayfa = devamVarMi ? kayitlar.slice(0, limit) : kayitlar;

  return {
    satirlar: sayfa.map((k) => ({
      id: k.id,
      at: k.at,
      eylem: k.action,
      eylemEtiketi: EYLEM_ETIKETLERI[k.action] ?? k.action,
      kayitTuru: k.entityType,
      kayitId: k.entityId,
      kisi: k.actorLabel,
      not: k.note,
      oncesi: k.before,
      sonrasi: k.after,
      ip: k.ip,
    })),
    devamVarMi,
    sonId: sayfa.length > 0 ? sayfa[sayfa.length - 1]!.id : null,
  };
}

/** Filtre açılırlarını beslemek için: kayıtta geçen kişiler ve kayıt türleri. */
export async function denetimFiltreSecenekleri() {
  const [kisiler, turler] = await Promise.all([
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, username: true },
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
      select: { entityType: true },
      take: 60,
    }),
  ]);

  return {
    kisiler: kisiler.map((k) => ({ id: k.id, ad: k.fullName || k.username })),
    kayitTurleri: turler.map((t) => t.entityType),
  };
}
