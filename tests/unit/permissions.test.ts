import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_LABELS,
  basePermissionsForRole,
  hasAnyPermission,
  hasPermission,
  resolvePermissions,
} from "@/lib/permissions";

const P = PERMISSIONS;

describe("rol taban izin kümeleri", () => {
  it("patron istisnasız tüm izinlere sahiptir", () => {
    const owner = resolvePermissions("OWNER");
    for (const p of ALL_PERMISSIONS) {
      expect(owner.has(p), `patron şu izne sahip olmalı: ${p}`).toBe(true);
    }
  });

  it("personel günlük işlemleri yapabilir", () => {
    const staff = resolvePermissions("STAFF");
    expect(staff.has(P.PARKING_ENTRY)).toBe(true);
    expect(staff.has(P.PARKING_EXIT)).toBe(true);
    expect(staff.has(P.PARKING_SEARCH)).toBe(true);
    expect(staff.has(P.WASH_CREATE)).toBe(true);
    expect(staff.has(P.SUBSCRIPTION_VIEW)).toBe(true);
    expect(staff.has(P.CASH_REPORT_SELF)).toBe(true);
  });

  it("PERSONEL FİNANSAL RAPORLARA VE AYARLARA ERİŞEMEZ", () => {
    // Projenin açık gereksinimi: personel patronun özel finansal raporlarına
    // ve sistem ayarlarına yetkisiz erişemez.
    const staff = resolvePermissions("STAFF");
    expect(staff.has(P.FINANCE_INCOME_VIEW)).toBe(false);
    expect(staff.has(P.FINANCE_EXPENSE_VIEW)).toBe(false);
    expect(staff.has(P.FINANCE_REPORT_VIEW)).toBe(false);
    expect(staff.has(P.FINANCE_REPORT_EXPORT)).toBe(false);
    expect(staff.has(P.TARIFF_EDIT)).toBe(false);
    expect(staff.has(P.WASHPRICE_EDIT)).toBe(false);
    expect(staff.has(P.SETTINGS_BUSINESS_EDIT)).toBe(false);
    expect(staff.has(P.PERSONNEL_MANAGE)).toBe(false);
    expect(staff.has(P.PERSONNEL_COST_VIEW)).toBe(false);
    expect(staff.has(P.AUDIT_VIEW)).toBe(false);
    expect(staff.has(P.USER_MANAGE)).toBe(false);
  });

  it("personel maaş bilgisini göremez", () => {
    expect(resolvePermissions("STAFF").has(P.PERSONNEL_COST_VIEW)).toBe(false);
    expect(resolvePermissions("MANAGER").has(P.PERSONNEL_COST_VIEW)).toBe(false);
    expect(resolvePermissions("OWNER").has(P.PERSONNEL_COST_VIEW)).toBe(true);
  });

  it("vardiya sorumlusu personelin tüm izinlerini kapsar", () => {
    const staff = basePermissionsForRole("STAFF");
    const manager = resolvePermissions("MANAGER");
    for (const p of staff) {
      expect(manager.has(p), `sorumlu şu izne sahip olmalı: ${p}`).toBe(true);
    }
  });

  it("vardiya sorumlusu kasa kapatabilir ama finansa giremez", () => {
    const manager = resolvePermissions("MANAGER");
    expect(manager.has(P.CASH_DRAWER_CLOSE)).toBe(true);
    expect(manager.has(P.CASH_REPORT_ALL)).toBe(true);
    expect(manager.has(P.PARKING_VOID)).toBe(true);
    expect(manager.has(P.FINANCE_REPORT_VIEW)).toBe(false);
    expect(manager.has(P.TARIFF_EDIT)).toBe(false);
  });

  it("abonmana özel fiyat belirleme yalnızca patronda", () => {
    expect(resolvePermissions("OWNER").has(P.SUBSCRIPTION_PRICE_SET)).toBe(true);
    expect(resolvePermissions("MANAGER").has(P.SUBSCRIPTION_PRICE_SET)).toBe(false);
    expect(resolvePermissions("STAFF").has(P.SUBSCRIPTION_PRICE_SET)).toBe(false);
  });

  it("park tutarını elle değiştirme yalnızca patronda", () => {
    expect(resolvePermissions("OWNER").has(P.PARKING_OVERRIDE_PRICE)).toBe(true);
    expect(resolvePermissions("MANAGER").has(P.PARKING_OVERRIDE_PRICE)).toBe(false);
    expect(resolvePermissions("STAFF").has(P.PARKING_OVERRIDE_PRICE)).toBe(false);
  });
});

describe("kullanıcıya özel izinler (yeni rol tanımlamadan yetki seviyesi)", () => {
  it("personele ek izin verilebilir", () => {
    // "Ahmet personel ama kasa kapatabilsin"
    const izinler = resolvePermissions("STAFF", [
      { permission: P.CASH_DRAWER_CLOSE, granted: true },
    ]);
    expect(izinler.has(P.CASH_DRAWER_CLOSE)).toBe(true);
    // Diğer kısıtlar korunur:
    expect(izinler.has(P.FINANCE_REPORT_VIEW)).toBe(false);
  });

  it("rolün taban izni kullanıcıdan kaldırılabilir", () => {
    const izinler = resolvePermissions("STAFF", [
      { permission: P.PARKING_EXIT, granted: false },
    ]);
    expect(izinler.has(P.PARKING_EXIT)).toBe(false);
    expect(izinler.has(P.PARKING_ENTRY)).toBe(true);
  });

  it("patronun izni de kaldırılabilir (kendi tercihiyle)", () => {
    const izinler = resolvePermissions("OWNER", [
      { permission: P.PARKING_ENTRY, granted: false },
    ]);
    expect(izinler.has(P.PARKING_ENTRY)).toBe(false);
  });

  it("aynı izin için ekleme ve kaldırma sırası sonucu belirler", () => {
    const sonKaldirma = resolvePermissions("STAFF", [
      { permission: P.CASH_VOID, granted: true },
      { permission: P.CASH_VOID, granted: false },
    ]);
    expect(sonKaldirma.has(P.CASH_VOID)).toBe(false);
  });
});

describe("yardımcı fonksiyonlar", () => {
  it("hasPermission ve hasAnyPermission", () => {
    const izinler = resolvePermissions("STAFF");
    expect(hasPermission(izinler, P.PARKING_ENTRY)).toBe(true);
    expect(hasPermission(izinler, P.TARIFF_EDIT)).toBe(false);
    expect(hasAnyPermission(izinler, [P.TARIFF_EDIT, P.PARKING_ENTRY])).toBe(true);
    expect(hasAnyPermission(izinler, [P.TARIFF_EDIT, P.USER_MANAGE])).toBe(false);
  });
});

describe("izin kataloğu tutarlılığı", () => {
  it("her iznin Türkçe açıklaması var", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(PERMISSION_LABELS[p], `açıklama eksik: ${p}`).toBeTruthy();
    }
  });

  it("izin adları tekrarsız", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });
});

// ---------------------------------------------------------------------------
// SERVER ACTION HATA CEVIRIMI
// ---------------------------------------------------------------------------
describe("runAction hata çevirimi", () => {
  it("İŞ HATALARI KULLANICIYA AYNEN GÖSTERİLİR", async () => {
    // Gerileme korumasi: bir donem IslemHatasi genel "İşlem tamamlanamadı"
    // mesajina cevriliyordu ve personel ne yapacagini anlayamiyordu.
    const { runAction } = await import("@/server/auth/authz");
    const { IslemHatasi } = await import("@/server/errors");

    const sonuc = await runAction(async () => {
      throw new IslemHatasi("ZATEN_ICERIDE", "Bu araç 14:28 itibarıyla otoparkta.");
    });

    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) {
      expect(sonuc.error).toBe("Bu araç 14:28 itibarıyla otoparkta.");
      expect(sonuc.code).toBe("ZATEN_ICERIDE");
    }
  });

  it("beklenmeyen hatalar kullanıcıya sızdırılmaz", async () => {
    const { runAction } = await import("@/server/auth/authz");
    const sonuc = await runAction(async () => {
      throw new Error("veritabanı bağlantı dizesi: postgres://gizli@sunucu");
    });

    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) {
      expect(sonuc.error).not.toContain("postgres://");
      expect(sonuc.error).toContain("İşlem tamamlanamadı");
      expect(sonuc.code).toBe("SUNUCU_HATASI");
    }
  });

  it("başarılı işlem veriyi döndürür", async () => {
    const { runAction } = await import("@/server/auth/authz");
    const sonuc = await runAction(async () => ({ tutar: 11500 }));
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.data.tutar).toBe(11500);
  });
});
