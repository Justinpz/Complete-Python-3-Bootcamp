# ReRack — Generated Assets Log

> **PURPOSE:** A running ledger of every image/video generated (via Higgsfield or otherwise) before it is posted. This is the holding tank — assets move from here to `posted-content.md` once they go live.
>
> **HOW TO USE:** Add one row per generated asset. Status: `Draft` → `Approved` → `Scheduled` → `Posted`. The `weekly-briefing-generator.py` and `calendar-auditor.py` scripts read this file.

---

## Logging convention

- **Asset ID:** `RR-YYYYMMDD-###` (generation date + sequence). Example: `RR-20260608-001`.
- **Prompt Reference:** the prompt ID used (e.g. `STD-04`, `UNI-11`, `REEL-02`).
- **Pillar:** The Standard / The Uniform / The Work / The Object / The Drop.
- **Type:** Image / Reel / Story / Carousel.
- **Soul:** `ATLAS_RR_001` if the recurring model appears; else `n/a`.
- **Status:** Draft / Approved / Scheduled / Posted / Rejected.
- **Posted?** Yes/No (+ date once live).

## Generated Assets

| Asset ID | Date Generated | Pillar | Type | Prompt Ref | Soul | Status | Posted? | Notes |
|---|---|---|---|---|---|---|---|---|
| RR-20260603-001 | 2026-06-03 | The Standard | Image (4:5, 2k) | STD-01 | n/a | Posted | Yes (2026-06-03) | Concrete wall, golden shaft. Higgsfield nano_banana_pro · clean job 3645cc3f · quote-overlay job e48325a1 (CAP-003 hero line burned in) · LIVE: instagram.com/p/DZIiXIxCjTg/ |
| RR-20260603-002 | 2026-06-03 | The Standard | Image (4:5, 2k) | STD-02 | n/a | Approved | No | Light pool on rubber floor. clean job bc1a3b63 · quote-overlay job 547e08b1 ("Standards beat feelings." / CAP-006 burned in) · exports STD-02_clean.png / STD-02_quote.png · ready to post |
| RR-20260603-003 | 2026-06-03 | The Standard | Image (9:16, 2k) | STD-03 | n/a | Approved | No | Brutalist stairwell, STORY format. clean job bcfa1395 · quote-overlay job 9d4138ad ("Become hard to kill." / CAP-007 burned in) · exports STD-03_clean.png / STD-03_quote.png · post as a Story |
| RR-20260603-004 | 2026-06-03 | The Standard | Image (4:5, 2k) | STD-04 | ATLAS (small) | Approved | No | Lone figure in concrete hall. clean job 1812e851 · quote-overlay job f37c4b90 (CAP-001 "You don't rise to your goals. You fall to your standards." burned in upper-left; first overlay attempt 152b2b45 duplicated a line, re-rolled) · exports STD-04_clean.png / STD-04_quote.png · ready to post |
| RR-20260603-005 | 2026-06-03 | The Standard | Image (4:5, 2k) | STD-05 | n/a | Draft | No | Chalk dust in tungsten beam. job e7e5ffa2 · pair CAP-005 |
| RR-20260603-006 | 2026-06-03 | The Standard | Image (4:5, 2k) | STD-06 | n/a | Draft | No | Pre-dawn bench, blue hour. job c27e8232 · pair CAP-002 |

<!-- Append new rows above this line. Keep newest at top of the data block if you prefer reverse-chronological. -->

## Consistency check (for ATLAS assets)

Before marking any ATLAS image `Approved`, run the checklist in `5-Soul-Character/soul-reference.md`:
- [ ] Same face / age / skin tone / hair / beard.
- [ ] Composed, serious expression (no wide smile).
- [ ] On-palette wardrobe, ReRack tee, no foreign logos.
- [ ] Hard directional light, matte grade, grain.
- [ ] Alone in an industrial/minimal environment.
- [ ] Sits cleanly beside the last 5 ATLAS posts.
