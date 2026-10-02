import { describe, expect, it } from "vitest";
import {
  businessDayEnd,
  businessDayRange,
  businessDayStart,
  daysBetween,
  diffMinutes,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
  isWeekend,
  minuteOfDay,
} from "@/lib/datetime";

describe("Türkçe tarih/saat biçimleme (Europe/Istanbul)", () => {
  it("tarihi gg.aa.yyyy yazar", () => {
    // 2 Ekim 2026, 11:32 Istanbul = 08:32 UTC
    const t = new Date("2026-10-02T08:32:00Z");
    expect(formatDate(t)).toBe("02.10.2026");
    expect(formatTime(t)).toBe("11:32");
    expect(formatDateTime(t)).toBe("02.10.2026 11:32");
  });

  it("UTC gece yarısını Istanbul saatine doğru çevirir", () => {
    // 1 Ocak 2026 00:30 UTC = 03:30 Istanbul (aynı gün)
    const t = new Date("2026-01-01T00:30:00Z");
    expect(formatDate(t)).toBe("01.01.2026");
    expect(formatTime(t)).toBe("03:30");
  });

  it("Istanbul gece yarısından önceki UTC anını önceki güne yazmaz", () => {
    // 1 Ocak 2026 22:00 UTC = 2 Ocak 01:00 Istanbul
    const t = new Date("2026-01-01T22:00:00Z");
    expect(formatDate(t)).toBe("02.01.2026");
  });
});

describe("formatDuration", () => {
  it("sıfır süreyi yazar", () => {
    expect(formatDuration(0)).toBe("0 dakika");
  });
  it("dakikayı yazar", () => {
    expect(formatDuration(45)).toBe("45 dakika");
    expect(formatDuration(1)).toBe("1 dakika");
  });
  it("tam saati yazar", () => {
    expect(formatDuration(60)).toBe("1 saat");
    expect(formatDuration(120)).toBe("2 saat");
  });
  it("saat ve dakikayı birlikte yazar", () => {
    expect(formatDuration(192)).toBe("3 saat 12 dakika");
    expect(formatDuration(61)).toBe("1 saat 1 dakika");
  });
  it("günü yazar ve uzun sürede dakikayı gizler", () => {
    expect(formatDuration(1440)).toBe("1 gün");
    expect(formatDuration(1500)).toBe("1 gün 1 saat");
    // 1 gün 1 saat 5 dakika -> dakika gürültü yapmasın
    expect(formatDuration(1505)).toBe("1 gün 1 saat");
  });
  it("negatif süreyi 0 sayar", () => {
    expect(formatDuration(-10)).toBe("0 dakika");
  });
});

describe("diffMinutes", () => {
  it("dakika farkını aşağı yuvarlar", () => {
    const a = new Date("2026-10-02T11:00:00Z");
    expect(diffMinutes(a, new Date("2026-10-02T14:12:00Z"))).toBe(192);
    expect(diffMinutes(a, new Date("2026-10-02T11:00:59Z"))).toBe(0);
    expect(diffMinutes(a, new Date("2026-10-02T11:01:00Z"))).toBe(1);
  });
});

describe("işletme günü (karar: takvim günü 00:00-00:00)", () => {
  it("gün başlangıcı Istanbul gece yarısıdır", () => {
    // 2 Ekim 2026 14:00 Istanbul -> gün başı 2 Ekim 00:00 Istanbul = 1 Ekim 21:00 UTC
    const t = new Date("2026-10-02T11:00:00Z");
    const start = businessDayStart(t);
    expect(formatDate(start)).toBe("02.10.2026");
    expect(formatTime(start)).toBe("00:00");
  });

  it("gün bitişi başlangıçtan tam 24 saat sonradır", () => {
    const t = new Date("2026-10-02T11:00:00Z");
    const start = businessDayStart(t);
    const end = businessDayEnd(t);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("gece yarısına yakın anlar doğru güne düşer", () => {
    // 2 Ekim 23:50 Istanbul = 20:50 UTC -> hâlâ 2 Ekim
    const geceyarisindanOnce = new Date("2026-10-02T20:50:00Z");
    expect(formatDate(businessDayStart(geceyarisindanOnce))).toBe("02.10.2026");

    // 3 Ekim 00:10 Istanbul = 2 Ekim 21:10 UTC -> artık 3 Ekim
    const geceyarisindanSonra = new Date("2026-10-02T21:10:00Z");
    expect(formatDate(businessDayStart(geceyarisindanSonra))).toBe("03.10.2026");
  });

  it("vardiya başlangıcı 8 olarak ayarlanırsa gün sınırı kayar", () => {
    // Gelecekte gece vardiyası için yapılandırılabilir olduğunu doğrular.
    // 3 Ekim 05:00 Istanbul (02:00 UTC) -> 08:00 sınırında hâlâ 2 Ekim'in günü
    const t = new Date("2026-10-03T02:00:00Z");
    const start = businessDayStart(t, 8);
    expect(formatDate(start)).toBe("02.10.2026");
    expect(formatTime(start)).toBe("08:00");
  });

  it("aralık [başlangıç, bitiş) döner", () => {
    const { start, end } = businessDayRange(new Date("2026-10-02T11:00:00Z"));
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe("minuteOfDay ve isWeekend (gece/haftasonu tarifesi için)", () => {
  it("günün dakikasını Istanbul saatine göre verir", () => {
    // 20:30 Istanbul = 17:30 UTC -> 1230
    expect(minuteOfDay(new Date("2026-10-02T17:30:00Z"))).toBe(1230);
    // 00:00 Istanbul = önceki gün 21:00 UTC -> 0
    expect(minuteOfDay(new Date("2026-10-01T21:00:00Z"))).toBe(0);
  });

  it("hafta sonunu tanır", () => {
    // 3 Ekim 2026 Cumartesi
    expect(isWeekend(new Date("2026-10-03T09:00:00Z"))).toBe(true);
    // 4 Ekim 2026 Pazar
    expect(isWeekend(new Date("2026-10-04T09:00:00Z"))).toBe(true);
    // 2 Ekim 2026 Cuma
    expect(isWeekend(new Date("2026-10-02T09:00:00Z"))).toBe(false);
  });
});

describe("daysBetween (abonman kalan gün)", () => {
  it("tam gün sayısını verir", () => {
    const a = new Date("2026-10-02T00:00:00Z");
    expect(daysBetween(a, new Date("2026-10-28T00:00:00Z"))).toBe(26);
    expect(daysBetween(a, new Date("2026-10-02T23:00:00Z"))).toBe(0);
  });
});
