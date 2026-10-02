/**
 * Izin sabitleri ve rol taban kumeleri.
 * Yetki matrisi: docs/03-roller-yetki-matrisi.md
 *
 * MIMARI KURAL: Bu dosya hem sunucuda hem arayuzde kullanilir, ancak GUVENLIK
 * yalnizca sunucu tarafinda saglanir. Arayuzde izin kontrolu sadece butonu
 * gizlemek icindir; asil koruma her Server Action'in basindaki
 * requirePermission() cagrisidir.
 */

export const PERMISSIONS = {
  // Otopark
  PARKING_ENTRY: "parking.entry",
  PARKING_EXIT: "parking.exit",
  PARKING_SEARCH: "parking.search",
  PARKING_HISTORY_VIEW: "parking.history.view",
  PARKING_VOID: "parking.void",
  PARKING_DISCOUNT: "parking.discount",
  PARKING_OVERRIDE_PRICE: "parking.override_price",

  // Abonman
  SUBSCRIPTION_VIEW: "subscription.view",
  SUBSCRIPTION_CREATE: "subscription.create",
  SUBSCRIPTION_EDIT: "subscription.edit",
  SUBSCRIPTION_PRICE_SET: "subscription.price.set",
  SUBSCRIPTION_CANCEL: "subscription.cancel",
  SUBSCRIPTION_PAYMENT_COLLECT: "subscription.payment.collect",

  // Musteri
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_EDIT: "customer.edit",

  // Oto yikama
  WASH_CREATE: "wash.create",
  WASH_UPDATE_STATUS: "wash.update_status",
  WASH_COLLECT: "wash.collect",
  WASH_VOID: "wash.void",
  WASH_REPORT_VIEW: "wash.report.view",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MOVEMENT_CREATE: "inventory.movement.create",

  // Kasa ve vardiya
  CASH_SHIFT_OPEN: "cash.shift.open",
  CASH_SHIFT_CLOSE: "cash.shift.close",
  CASH_DRAWER_OPEN: "cash.drawer.open",
  CASH_DRAWER_CLOSE: "cash.drawer.close",
  CASH_MOVEMENT_CREATE: "cash.movement.create",
  CASH_REPORT_SELF: "cash.report.self",
  CASH_REPORT_ALL: "cash.report.all",
  CASH_VOID: "cash.void",

  // Finans
  FINANCE_INCOME_VIEW: "finance.income.view",
  FINANCE_EXPENSE_VIEW: "finance.expense.view",
  FINANCE_EXPENSE_CREATE: "finance.expense.create",
  FINANCE_EXPENSE_VOID: "finance.expense.void",
  FINANCE_REPORT_VIEW: "finance.report.view",
  FINANCE_REPORT_EXPORT: "finance.report.export",

  // Tarifeler
  TARIFF_VIEW: "tariff.view",
  TARIFF_EDIT: "tariff.edit",
  WASHPRICE_VIEW: "washprice.view",
  WASHPRICE_EDIT: "washprice.edit",

  // Personel
  PERSONNEL_VIEW: "personnel.view",
  PERSONNEL_MANAGE: "personnel.manage",
  PERSONNEL_COST_VIEW: "personnel.cost.view",

  // Web sitesi
  SITE_CONTENT_EDIT: "site.content.edit",
  SITE_PRICE_EDIT: "site.price.edit",

  // Sistem
  SETTINGS_BUSINESS_EDIT: "settings.business.edit",
  AUDIT_VIEW: "audit.view",
  USER_MANAGE: "user.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Tum izinlerin listesi (personel yetkilendirme ekraninda kullanilir). */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export type RoleName = "OWNER" | "MANAGER" | "STAFF";

const P = PERMISSIONS;

/** STAFF - personel: yalnizca gunluk islemleri yapar. */
const STAFF_PERMISSIONS: Permission[] = [
  P.PARKING_ENTRY,
  P.PARKING_EXIT,
  P.PARKING_SEARCH,
  P.PARKING_HISTORY_VIEW,
  P.SUBSCRIPTION_VIEW,
  P.CUSTOMER_VIEW,
  P.WASH_CREATE,
  P.WASH_UPDATE_STATUS,
  P.WASH_COLLECT,
  P.CASH_SHIFT_OPEN,
  P.CASH_SHIFT_CLOSE,
  P.CASH_REPORT_SELF,
  P.TARIFF_VIEW,
  P.WASHPRICE_VIEW,
];

/** MANAGER - vardiya sorumlusu: personelin tumu + kasa/abonman yonetimi. */
const MANAGER_PERMISSIONS: Permission[] = [
  ...STAFF_PERMISSIONS,
  P.PARKING_VOID,
  P.PARKING_DISCOUNT,
  P.SUBSCRIPTION_CREATE,
  P.SUBSCRIPTION_EDIT,
  P.SUBSCRIPTION_PAYMENT_COLLECT,
  P.CUSTOMER_CREATE,
  P.CUSTOMER_EDIT,
  P.WASH_VOID,
  P.WASH_REPORT_VIEW,
  P.INVENTORY_VIEW,
  P.INVENTORY_MOVEMENT_CREATE,
  P.CASH_DRAWER_OPEN,
  P.CASH_DRAWER_CLOSE,
  P.CASH_MOVEMENT_CREATE,
  P.CASH_REPORT_ALL,
  P.PERSONNEL_VIEW,
];

/** OWNER - patron: istisnasiz tum izinler. */
const OWNER_PERMISSIONS: Permission[] = ALL_PERMISSIONS;

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  OWNER: OWNER_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
};

/** Rolun taban izin kumesi. */
export function basePermissionsForRole(role: RoleName): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export interface PermissionOverride {
  permission: string;
  granted: boolean;
}

/**
 * Kullanicinin nihai izin kumesini hesaplar:
 *   rol taban kumesi + kullaniciya ozel eklenenler - kullaniciya ozel kaldirilanlar
 *
 * Bu sayede yeni rol tanimlamadan farkli yetki seviyeleri olusturulabilir:
 * "Ahmet personel ama kasa kapatabilsin" -> cash.drawer.close granted=true.
 */
export function resolvePermissions(
  role: RoleName,
  overrides: PermissionOverride[] = [],
): Set<string> {
  const result = new Set<string>(basePermissionsForRole(role));
  for (const o of overrides) {
    if (o.granted) result.add(o.permission);
    else result.delete(o.permission);
  }
  return result;
}

/** Izin kumesinde arama. */
export function hasPermission(permissions: Set<string>, permission: Permission): boolean {
  return permissions.has(permission);
}

/** Verilen izinlerden en az biri var mi? */
export function hasAnyPermission(permissions: Set<string>, required: Permission[]): boolean {
  return required.some((p) => permissions.has(p));
}

/** Izinlerin Turkce aciklamalari - personel yetkilendirme ekraninda gosterilir. */
export const PERMISSION_LABELS: Record<string, string> = {
  [P.PARKING_ENTRY]: "Araç girişi yapabilir",
  [P.PARKING_EXIT]: "Araç çıkışı ve tahsilat yapabilir",
  [P.PARKING_SEARCH]: "Plaka araması yapabilir",
  [P.PARKING_HISTORY_VIEW]: "Araç geçmişini görebilir",
  [P.PARKING_VOID]: "Hatalı park işlemini iptal edebilir",
  [P.PARKING_DISCOUNT]: "Park ücretine indirim uygulayabilir",
  [P.PARKING_OVERRIDE_PRICE]: "Park tutarını elle değiştirebilir",
  [P.SUBSCRIPTION_VIEW]: "Abonmanları görebilir",
  [P.SUBSCRIPTION_CREATE]: "Yeni abonman oluşturabilir",
  [P.SUBSCRIPTION_EDIT]: "Abonman bilgilerini düzenleyebilir",
  [P.SUBSCRIPTION_PRICE_SET]: "Abonmana özel ücret belirleyebilir",
  [P.SUBSCRIPTION_CANCEL]: "Abonman iptal edebilir",
  [P.SUBSCRIPTION_PAYMENT_COLLECT]: "Abonman tahsilatı kaydedebilir",
  [P.CUSTOMER_VIEW]: "Müşteri bilgilerini görebilir",
  [P.CUSTOMER_CREATE]: "Yeni müşteri ekleyebilir",
  [P.CUSTOMER_EDIT]: "Müşteri bilgilerini düzenleyebilir",
  [P.WASH_CREATE]: "Yıkama kaydı açabilir",
  [P.WASH_UPDATE_STATUS]: "Yıkama durumunu değiştirebilir",
  [P.WASH_COLLECT]: "Yıkama tahsilatı yapabilir",
  [P.WASH_VOID]: "Yıkama kaydını iptal edebilir",
  [P.WASH_REPORT_VIEW]: "Yıkama raporlarını görebilir",
  [P.INVENTORY_VIEW]: "Malzeme stoğunu görebilir",
  [P.INVENTORY_MOVEMENT_CREATE]: "Stok hareketi girebilir",
  [P.CASH_SHIFT_OPEN]: "Vardiya başlatabilir",
  [P.CASH_SHIFT_CLOSE]: "Vardiya kapatabilir",
  [P.CASH_DRAWER_OPEN]: "Kasa açabilir",
  [P.CASH_DRAWER_CLOSE]: "Kasa kapatabilir",
  [P.CASH_MOVEMENT_CREATE]: "Kasa hareketi girebilir",
  [P.CASH_REPORT_SELF]: "Kendi tahsilat özetini görebilir",
  [P.CASH_REPORT_ALL]: "Tüm personelin tahsilatını görebilir",
  [P.CASH_VOID]: "Tahsilat iptal edebilir",
  [P.FINANCE_INCOME_VIEW]: "Gelirleri görebilir",
  [P.FINANCE_EXPENSE_VIEW]: "Giderleri görebilir",
  [P.FINANCE_EXPENSE_CREATE]: "Gider kaydı girebilir",
  [P.FINANCE_EXPENSE_VOID]: "Gider kaydını iptal edebilir",
  [P.FINANCE_REPORT_VIEW]: "Finansal raporları görebilir",
  [P.FINANCE_REPORT_EXPORT]: "Raporları dışa aktarabilir",
  [P.TARIFF_VIEW]: "Otopark tarifelerini görebilir",
  [P.TARIFF_EDIT]: "Otopark tarifelerini değiştirebilir",
  [P.WASHPRICE_VIEW]: "Yıkama fiyatlarını görebilir",
  [P.WASHPRICE_EDIT]: "Yıkama fiyatlarını değiştirebilir",
  [P.PERSONNEL_VIEW]: "Personel listesini görebilir",
  [P.PERSONNEL_MANAGE]: "Personel ekleyip yetkilendirebilir",
  [P.PERSONNEL_COST_VIEW]: "Maaş ve personel maliyetlerini görebilir",
  [P.SITE_CONTENT_EDIT]: "Web sitesi içeriğini düzenleyebilir",
  [P.SITE_PRICE_EDIT]: "Web sitesindeki fiyatları düzenleyebilir",
  [P.SETTINGS_BUSINESS_EDIT]: "İşletme ayarlarını değiştirebilir",
  [P.AUDIT_VIEW]: "Denetim kayıtlarını görebilir",
  [P.USER_MANAGE]: "Kullanıcı hesaplarını yönetebilir",
};

export const ROLE_LABELS: Record<RoleName, string> = {
  OWNER: "İşletme Sahibi",
  MANAGER: "Vardiya Sorumlusu",
  STAFF: "Personel",
};
