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
| RR-20260608-001 | 2026-06-08 | The Standard | Image | STD-04 | n/a | Draft | No | _example row — replace_ |
| | | | | | | | | |

<!-- Append new rows above this line. Keep newest at top of the data block if you prefer reverse-chronological. -->

## Consistency check (for ATLAS assets)

Before marking any ATLAS image `Approved`, run the checklist in `5-Soul-Character/soul-reference.md`:
- [ ] Same face / age / skin tone / hair / beard.
- [ ] Composed, serious expression (no wide smile).
- [ ] On-palette wardrobe, ReRack tee, no foreign logos.
- [ ] Hard directional light, matte grade, grain.
- [ ] Alone in an industrial/minimal environment.
- [ ] Sits cleanly beside the last 5 ATLAS posts.
