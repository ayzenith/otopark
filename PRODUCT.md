# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary (public site):** Drivers in Istanbul, almost always on a phone, looking for a safe place to leave a car near Ataköy: visitors to İstanbul Dünya Ticaret Merkezi / İstanbul Fuar Merkezi, people heading to the metro/metrobüs, residents and workers around Nef, Selenium, Ataköy Towers, Nivo, Kültür Üniversitesi and Airport AVM, and caravan owners. Their job: decide in seconds whether to drive here, then get directions, call or WhatsApp.
- **Secondary (panel, not this surface):** the owner (patron) and parking staff, on phones, running entries/exits, washing, subscriptions and the cash drawer.

## Product Purpose

Londra Camping Otopark is a real, 7/24 open-air parking lot with a professional car wash on the same site, in Ataköy, Istanbul. The public site exists to turn a driver's search into a visit: show that the place is real, safe, open right now and easy to reach, then hand them directions in one tap. Success = a visitor taps YOL TARİFİ AL (Google Maps), calls, or writes on WhatsApp.

## Positioning

A guarded, camera-watched, always-open lot a two-minute walk from the metrobüs and three from the metro, minutes from the fair and trade centers, that also washes your car while you're away and accepts caravans. A neighbouring lot can copy "parking"; it can't copy this location, the 7/24 guard + camera on this site, and wash-while-parked in one place.

## Operating Context

- Visitors arrive from Google search / Maps on a phone, often while driving or about to leave; one-handed use, outdoor light.
- The physical site: open-air lot behind a green mesh fence, white guard booth, red "LONDRA CAMPING OTO PARK 0555 056 79 79" banners at the entrance, a camera mast. The entrance photo is the way a driver recognises the place.
- The site content is edited by the owner from the panel (business info, homepage text, optional price lines, gallery); missing fields hide their section.

## Capabilities and Constraints

- Pages: `/` · `/otopark` · `/oto-yikama` · `/fiyatlar` · `/iletisim`; all must keep working (Next.js App Router, server-rendered, data from the panel).
- Open-air lot (confirmed 11.10.2026). Open 7/24 (owner: "bu bilgi kesin olsun, çok önemli").
- Phone and WhatsApp: the same number, 0555 056 79 79.
- Accepted vehicles include cars, SUV, minibüs, kamyonet (confirmed 11.10.2026) and caravans (caravans have their own daily pricing).
- Monthly subscription: unlimited entry/exit, price is set per customer.
- Car wash: priced by vehicle type, done by staff on site, open 7/24 (owner, 11.10.2026).
- **No prices on the site** unless the owner enters a free-text price line in the panel; tariff engine never feeds the site.
- **No reservation service** — never say a spot can be reserved (confirmed 11.10.2026).
- Nothing is invented: unentered address/phone/hours/prices render no section and no placeholder; the panel lists them as missing.
- Copy is Turkish; Turkish date/phone formats; full Turkish glyph support (İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü) required in every face.
- Mobile-first: primary touch targets 64px, secondary 56px, minimum 48px; no horizontal scroll.
- Site motion must not depend on JS: content is visible if scripts fail; `prefers-reduced-motion` turns motion off.
- Absolute URLs come from `NEXT_PUBLIC_SITE_URL`; domain `londracampingtandircioglu.com`.

## Brand Commitments

- Name: **Londra Camping Otopark**.
- **Logo colours are the brand colours** (owner, 11.10.2026): deep navy `#002C72` and electric blue `#0159E6` (the logo's arrow runs navy → blue). The red/white entrance banners are signage, not the brand palette.
- Logo assets: `public/logo.png` (colour, transparent), `public/logo-beyaz.png` (white mono, for dark grounds); the mark is an interlocking "dF"-like ribbon ending in a rightward arrow.
- The owner rejected an earlier version as "the most basic, obviously-AI theme"; the goal is a site that reads as made by a professional creative agency, premium automotive, original and memorable. No generic card grids, no decorative gradients.
- Primary action wording: **YOL TARİFİ AL**.
- Owner's own sentences (keep verbatim when used): "Aracınız profesyonel güvenlik ekibimiz tarafından 7/24 korunur." · "Otoparkımız kesintisiz kamera sistemi ile sürekli izlenmektedir."

## Evidence on Hand

- One real, owner-supplied photo: `public/otopark-giris.webp` (entrance, red banners with phone number, white booth, green mesh fence, cars, daylight). More photos not available for now (11.10.2026).
- Location facts (owner): metrobüs 2 min, metro 3 min, İstanbul Dünya Ticaret Merkezi 6 min, İstanbul Fuar Merkezi 7 min; right behind Nef ("hemen arkası"); behind Kültür Üniversitesi / Airport AVM; Selenium, Ataköy Towers, Nivo also nearby. The site's spec table shows Nef, Kültür Üniversitesi, Airport AVM (owner's pick, 11.10.2026). Whether minutes are walking or driving is not stated — don't specify. Single source: `src/app/(site)/konum-bilgisi.ts`.
- Google Maps link: `https://maps.app.goo.gl/rLR4CvWx5VsCNLr5A`.
- **Absent, never fabricate:** street address text, full legal trade name, Instagram, testimonials, customer counts, ratings, capacity numbers, prices, wash services beyond İç Dış Yıkama, extra services (pasta cila, vale…).

## Product Principles

1. Recognition beats persuasion: a driver who can picture the entrance and the route will come.
2. One action leads everywhere: directions first, call/WhatsApp second, the same mapping on every page.
3. Say only what is true and confirmed; an empty section is better than an invented one.
4. Built for a phone in a hand outside, then made flawless on desktop.

## Accessibility & Inclusion

WCAG AA contrast for all text (outdoor phone use); touch targets ≥48px; content visible without JS; reduced-motion respected; full Turkish character support.
