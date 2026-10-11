---
version: 1
slug: "src-app-site-page-tsx"
primary_target: "src/app/(site)/page.tsx"
related_targets: ["src/app/(site)/layout.tsx","src/app/(site)/parcalar.tsx"]
---

# Surface brief: public site (`/`, `/otopark`, `/oto-yikama`, `/iletisim`, `/fiyatlar`)

Visitor mode: **Persuade**. Audience/job: a driver on a phone near Ataköy deciding in seconds whether to drive here; action = YOL TARİFİ AL (Google Maps), then WhatsApp / call. Proof on hand: one real entrance photo; owner-given minutes and landmarks; 7/24 security + camera sentences; oto yıkama 7/24 (owner, 11.10.2026). Constraints: PRODUCT.md (no prices unless entered, no reservation claim, nothing invented, panel-driven content, JS-free visibility, 48px targets).

Decision history (11.10.2026): critique 18/32 → user first picked "Otoyol Tabelası" (built, reviewed in code) → user switched to **"Teknik Veri"** after seeing both; asked for WhatsApp logo in the bar, spec rows "Güvenlik ve kamera 7/24", "Oto yıkama 7/24", and Nef / Kültür Üniversitesi / Airport AVM. Fiyatlar leaves the menu unless a price line exists.

## Direction contract

THESIS: Londra Camping is presented like a new car model's launch brochure: the real entrance photo full-bleed with annotated callouts, the business name set as a model badge, and a technical-data table as the proof. It refuses the category default of a dark hero with tagline, icon cards and a map.

OWN-WORLD: Cool "showroom white" ground (#EEF1F6); logo navy #002C72 for type, rules and committed bands; logo blue #0159E6 reserved for the directions action and callout rings. One family, Archivo, at three widths: expanded 900 uppercase (model name, section titles), 110-115% for data and labels, normal for body. Separation by navy rules, never cards; tables and definition lists carry facts. No yellow, no gradients, no glow, no kickers, no decorative numbers.

STORY: The visitor sees the actual entrance (guard booth, camera, gate called out), reads the name, sees 7/24 and the spec sheet (security, wash, minutes to metrobüs/metro/DTM/fair, landmarks behind), and taps the blue YOL TARİFİ AL.

FIRST VIEWPORT: Navy header; full-bleed photo (16:10 phone, 3:1 desktop) with three callouts that never cover the red banners; showroom tab rising over the photo's bottom edge holding the name; navy 7/24 plate + "Açık hava otopark · Oto yıkama"; blue YOL TARİFİ AL full width with WhatsApp / Ara beneath; on desktop the Teknik veriler table sits to the right.

FORM: Car-launch brochure with spec sheet, candidate 5 of my ordered list (the roll's assigned direction), seed key 47ba2ad2 (degraded roll, no challengers). Signature motion: callouts draw once on load (dot, leader line, label; 180-260ms, staggered); phone action bar rises only after the cover scrolls away (CSS scroll timeline, visible fallback).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
