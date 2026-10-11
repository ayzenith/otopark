---
target: Londra Camping public site (src/app/(site))
total_score: 18
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 3
target_identity: "file:/home/user/otopark/src/app/(site)/page.tsx"
target_fingerprint: "sha256:6376e2adf533ee24284b4fc6bc8eb1de4d33ae8bf92e27267a99851d0df860a5"
target_path: /home/user/otopark/src/app/(site)/page.tsx
timestamp: 2026-10-11T21-27-58Z
slug: src-app-site-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No current-page state in nav |
| 2 | Match System / Real World | 3 | Minutes don't say walk vs drive |
| 3 | User Control and Freedom | 3 | Simple pages |
| 4 | Consistency and Standards | 1 | Yellow = directions on /, = call on inner pages; "Hemen yakını" vs "Hemen arkası"; fixed bar only on / |
| 5 | Error Prevention | 2 | Unverified claims: "Yer ayırtmak", abonman price by vehicle type, kamyonet |
| 6 | Recognition Rather Than Recall | 3 | Inner pages hide actions on mobile |
| 7 | Flexibility and Efficiency | n/a | Persuade brochure site |
| 8 | Aesthetic and Minimalist Design | 2 | Facts repeated 3-4x on /; /fiyatlar stub |
| 9 | Error Recovery | 2 | No address fallback if Maps link fails |
| 10 | Help and Documentation | n/a | Marketing site |
| **Total** | | **18/32** | Acceptable |

## Design Specificity Verdict
Category-interchangeable: dark SaaS hero + cream feature sections, no loaded typeface (system sans), blurred yellow+blue glow orbs (page.tsx:61-68), icon-tile + title + grey text pattern everywhere. Real brand (red banners, giant phone number, white booth, green mesh fence) absent. Detector: CLI clean (0); browser: low-contrast (amber 12px labels 2.8-3.1:1 incl. footer "7/24 AÇIK" layout.tsx:167; Personel girişi 2.7:1 layout.tsx:210; iletisim dt 2.7:1), icon-tile-stack parcalar.tsx:258 (2/5/4 per page), kicker-above-heading / hero-eyebrow-chip (partly intentional per CLAUDE.md numbered labels).

## Priority Issues
- [P0] Real photography used as a footnote (256px strip below fold on mobile, absent on inner pages). Fix: photo as first viewport, framed on banners+booth, caption "Girişte bu kırmızı pankartları göreceksiniz"; crops on inner pages. /impeccable bolder
- [P1] No typographic identity. Fix: characterful display face with full Turkish glyphs; business name as a mark like the banner lettering. /impeccable typeset
- [P1] Inconsistent/duplicated actions and facts (6 buttons in mobile first viewport; yellow meaning flips; fixed bar home-only; location list two sources). /impeccable distill
- [P1] Unverified claims in copy (otopark/page.tsx:195 "Yer ayırtmak", :126 abonman by vehicle type, :116 kamyonet). /impeccable clarify
- [P2] Glow orbs + blue leakage, small-amber contrast, stub /fiyatlar and /iletisim. /impeccable polish

## Persona Red Flags
Jordan: open-air vs covered unknown; no address/entrance caption; yakını vs arkası; Ne kadar? -> call.
Riley: landmark row wraps to 5 lines at 390 (parcalar.tsx:326); no clamp on long business name in hero.
Casey: mobile secondary nav 32px (layout.tsx:135); /otopark first CTA ~3600px down; bar colour mapping flips.

## Minor Observations
Desktop glow clipped at header seam; stray "P" icon above footer on /otopark; repetitive panel paragraph and 01->04 numbering gap; colour logo brings blue into footer.

## Questions to Consider
Photo + one button only? Why is the site quieter than the fence? What if it were road signage?
