---
version: 1
slug: "src-app-site-page-tsx"
primary_target: "src/app/(site)/page.tsx"
related_targets: ["src/app/(site)/layout.tsx","src/app/(site)/parcalar.tsx"]
---

# Surface brief: public site homepage (`/`)

Scope: the public marketing site `src/app/(site)`; homepage first, inner pages (/otopark, /oto-yikama, /fiyatlar, /iletisim) follow in the same system. Visitor mode: **Persuade**.

Audience/job: a driver on a phone near Ataköy deciding in seconds whether to drive here; action = YOL TARİFİ AL (Google Maps), then WhatsApp / call. Proof on hand: one real entrance photo, owner-given minutes to transit and fair centers, 7/24 security + camera sentences. Constraints: PRODUCT.md (no prices unless entered, no reservation claim, nothing invented, panel-driven content, JS-free visibility, 48px targets). Owner choices 11.10.2026: direction "Otoyol Tabelası"; Fiyatlar leaves the menu unless a price line exists.

## Direction contract

THESIS: The site is the motorway sign that leads you to the lot: an overhead gantry of brand-navy and brand-blue sign panels, white reflective letterforms, destinations with minutes, and the real entrance photo as the arrival. It refuses the category default of a dark hero with tagline, three icon cards and a map.

OWN-WORLD: Night-asphalt navy ground (#00112E / #001A47); sign panels in logo navy #002C72 and logo blue #0159E6 with a 3px white inset border and rounded corners; flat steel gantry beam. White Overpass (Highway Gothic lineage), mixed case like Turkish motorway signs; drawn white pictograms (M, metrobüs, fair hall, blue-square P, wash). The only light surface is the white action plate. No yellow, no gradients, no glow, no kickers, no section numbers.

STORY: The visitor reads the place name on the main sign, sees it is open 7/24 and how many minutes it is from metrobüs, metro and the fair/trade centers, recognises the red-banner entrance in the photo, and taps YOL TARİFİ AL.

FIRST VIEWPORT: Phone: compact navy header + wrapping menu; main navy sign (drawn arrow top-right, business name as h1, white "7/24 AÇIK" plate); white YOL TARİFİ AL plate full width, WhatsApp/Ara plates beneath; blue destination sign (Metrobüs 2 dk, Metro 3 dk, Dünya Ticaret Merkezi 6 dk, Fuar Merkezi 7 dk) starts in view. Desktop: steel beam across, main sign (wide) + destination sign under it like a gantry, action plates in a row below, arrival photo starting at the fold.

FORM: Overhead motorway gantry signage (KGM-style), candidate 1 of my ordered list (shown as IMPECCABLE'S PICK; the roll assigned candidate 5, user chose this). Seed key 47ba2ad2 (degraded roll, no challengers). Signature motion: signs settle into place once on load (short drop + de-blur, staggered), the arrow nudges once; the phone action bar rises only after the gantry scrolls away (CSS scroll timeline, visible fallback).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
