# ReRack — Posted Content Record

> **PURPOSE:** The permanent record of everything published to Instagram. One row per live post. Feeds `performance-analyzer.py` and the monthly pillar-balance audit.
>
> **HOW TO USE:** When an asset goes live, move it from `generated-assets.md` and log it here with its post URL/permalink and the IDs used.

---

## Logging convention

- **Post Date / Time:** real publish time (EST).
- **Pillar:** which of the five.
- **Format:** Image / Reel / Carousel / Story.
- **Asset ID:** from `generated-assets.md`.
- **Prompt / Caption / Hook IDs:** what was actually used (e.g. `UNI-07` · `CAP-118` · `HOOK-044`).
- **Permalink:** Instagram URL.

## Posted Log

| Post Date | Time (EST) | Pillar | Format | Asset ID | Prompt ID | Caption ID | Hook ID | Permalink | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 2026-06-03 | — | The Standard | Image | RR-20260603-001 | STD-01 | CAP-003 | — | https://www.instagram.com/p/DZIiXIxCjTg/ | First live post. Quote-overlay render (STD-01_quote.png), "Motivation is a guest. Discipline lives here." |
| | | | | | | | | | |

<!-- Append new posts above. -->

## Monthly pillar mix (update at month end)

Target: **The Standard 30% · The Uniform 25% · The Work 20% · The Object 15% · The Drop 10%**

| Month | Standard | Uniform | Work | Object | Drop | Total | On target? |
|---|---|---|---|---|---|---|---|
| 2026-06 | | | | | | | |

Run `python 7-Scripts-and-Tools/performance-analyzer.py` to compute these automatically from this file once rows are populated.
