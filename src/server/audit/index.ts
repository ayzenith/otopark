/**
 * Denetim kaydi yazici.
 *
 * KURAL: Her yazma islemi denetim kaydi uretir - kim, ne zaman, hangi kayit,
 * onceki deger, yeni deger. Denetim tablosu append-only'dir; veritabani
 * tetikleyicisi UPDATE ve DELETE girisimlerini reddeder.
 *
 * Denetlenen islemlerin listesi: docs/03-roller-yetki-matrisi.md (3.5)
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db";

/** Denetlenen islem tipleri. Yeni islem eklerken buraya da eklenir. */
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAIL: "LOGIN_FAIL",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  PASSWORD_RESET: "PASSWORD_RESET",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  PERMISSION_DENIED: "PERMISSION_DENIED",

  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DEACTIVATE: "USER_DEACTIVATE",
  USER_REACTIVATE: "USER_REACTIVATE",
  USER_PERMISSION_CHANGE: "USER_PERMISSION_CHANGE",

  SHIFT_OPEN: "SHIFT_OPEN",
  SHIFT_CLOSE: "SHIFT_CLOSE",

  PARKING_ENTRY: "PARKING_ENTRY",
  PARKING_EXIT: "PARKING_EXIT",
  PARKING_VOID: "PARKING_VOID",
  PARKING_DISCOUNT: "PARKING_DISCOUNT",
  PARKING_PRICE_OVERRIDE: "PARKING_PRICE_OVERRIDE",

  PAYMENT_CREATE: "PAYMENT_CREATE",
  PAYMENT_VOID: "PAYMENT_VOID",

  TARIFF_VERSION_CREATE: "TARIFF_VERSION_CREATE",
  TARIFF_DEACTIVATE: "TARIFF_DEACTIVATE",
  WASHPRICE_UPDATE: "WASHPRICE_UPDATE",

  CUSTOMER_CREATE: "CUSTOMER_CREATE",
  CUSTOMER_UPDATE: "CUSTOMER_UPDATE",
  VEHICLE_CREATE: "VEHICLE_CREATE",
  VEHICLE_UPDATE: "VEHICLE_UPDATE",

  SUBSCRIPTION_CREATE: "SUBSCRIPTION_CREATE",
  SUBSCRIPTION_UPDATE: "SUBSCRIPTION_UPDATE",
  SUBSCRIPTION_PRICE_CHANGE: "SUBSCRIPTION_PRICE_CHANGE",
  SUBSCRIPTION_RENEW: "SUBSCRIPTION_RENEW",
  SUBSCRIPTION_CANCEL: "SUBSCRIPTION_CANCEL",
  SUBSCRIPTION_PAYMENT: "SUBSCRIPTION_PAYMENT",
  SUBSCRIPTION_PAYMENT_VOID: "SUBSCRIPTION_PAYMENT_VOID",
  SUBSCRIPTION_VEHICLE_ADD: "SUBSCRIPTION_VEHICLE_ADD",
  SUBSCRIPTION_VEHICLE_REMOVE: "SUBSCRIPTION_VEHICLE_REMOVE",
  /// Suresi dolan abonmanin otomatik olarak EXPIRED'a dusurulmesi.
  SUBSCRIPTION_EXPIRE: "SUBSCRIPTION_EXPIRE",
  CUSTOMER_VEHICLE_LINK: "CUSTOMER_VEHICLE_LINK",
  CUSTOMER_VEHICLE_UNLINK: "CUSTOMER_VEHICLE_UNLINK",

  WASH_CREATE: "WASH_CREATE",
  WASH_STATUS_CHANGE: "WASH_STATUS_CHANGE",
  WASH_VOID: "WASH_VOID",
  WASH_ITEM_ADD: "WASH_ITEM_ADD",
  WASH_ITEM_REMOVE: "WASH_ITEM_REMOVE",
  WASH_PAYMENT: "WASH_PAYMENT",
  WASH_PAYMENT_VOID: "WASH_PAYMENT_VOID",
  WASH_SERVICE_CREATE: "WASH_SERVICE_CREATE",
  WASH_SERVICE_UPDATE: "WASH_SERVICE_UPDATE",

  DRAWER_OPEN: "DRAWER_OPEN",
  DRAWER_CLOSE: "DRAWER_CLOSE",
  DRAWER_RECONCILE: "DRAWER_RECONCILE",
  CASH_MOVEMENT: "CASH_MOVEMENT",

  EXPENSE_CREATE: "EXPENSE_CREATE",
  EXPENSE_VOID: "EXPENSE_VOID",

  /// Personel avansi GIDER DEGIL, alacaktir - bu yuzden EXPENSE_* degil
  /// kendi eylem tipleri var (karar 05.10.2026).
  STAFF_ADVANCE_GIVE: "STAFF_ADVANCE_GIVE",
  STAFF_ADVANCE_VOID: "STAFF_ADVANCE_VOID",
  STAFF_SALARY_PAY: "STAFF_SALARY_PAY",
  STAFF_PROFILE_UPDATE: "STAFF_PROFILE_UPDATE",

  SETTINGS_UPDATE: "SETTINGS_UPDATE",
  SITE_CONTENT_UPDATE: "SITE_CONTENT_UPDATE",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** Kullanici kaydi yoksa (basarisiz giris gibi) null olabilir. */
  userId?: string | null;
  /** Kullanici sonradan degisse bile kim oldugu metin olarak korunur. */
  actorLabel: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  note?: string | null;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Denetim kaydi yazar.
 *
 * Transaction icinde cagrildiginda `tx` gecirilir; boylece islem geri alinirsa
 * denetim kaydi da geri alinir ve tutarsizlik olusmaz.
 */
export async function writeAudit(input: AuditInput, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      userId: input.userId ?? null,
      actorLabel: input.actorLabel,
      before: toJson(input.before),
      after: toJson(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      note: input.note ?? null,
    },
  });
}

/**
 * Hassas alanlari denetim kaydina yazmadan once temizler.
 * Parola hash'i, oturum jetonu gibi degerler denetim kaydina girmez.
 */
const REDACTED_KEYS = new Set([
  "passwordHash",
  "password",
  "sessionToken",
  "sessionTokenHash",
  "token",
  "secret",
]);

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return redact(value) as Prisma.InputJsonValue;
}

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Date) return value.toISOString();

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k)) {
      out[k] = "[gizlendi]";
      continue;
    }
    // Prisma Decimal gibi nesneler metne cevrilir.
    if (v && typeof v === "object" && "toFixed" in v && typeof v.toFixed === "function") {
      out[k] = String(v);
      continue;
    }
    out[k] = redact(v);
  }
  return out;
}
