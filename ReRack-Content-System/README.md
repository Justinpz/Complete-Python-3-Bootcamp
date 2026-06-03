# ReRack — Social Media Content System

> **FORGED DAILY.**
>
> A complete content production operating system for **ReRack**, a premium
> tactical-luxury men's fitness & lifestyle apparel brand. This system does
> **not** generate images itself — it organizes, strategizes, and manages the
> entire workflow around image generation, caption writing, scheduling, and
> performance tracking, so every post is strategically planned, tonally
> perfect, and visually coherent.

---

## What this is

Social media management, turned from chaotic daily decision-making into a
disciplined, repeatable system. You bring the image generator (Higgsfield); this
repo brings the brand rules, the prompt library, the captions, the calendar, the
model spec, and the tracking.

## The five content pillars

Every post belongs to exactly one pillar. This is the organizing principle of the
whole feed.

| Pillar | % of Feed | Purpose | Vibe |
|---|---|---|---|
| **The Standard** | 30% | Philosophy, discipline, identity | Text-focused, minimalist |
| **The Uniform** | 25% | Product on the recurring model (ATLAS) | Hero shots, premium |
| **The Work** | 20% | Training, process, grind | Raw, industrial, moody |
| **The Object** | 15% | Product detail, macro, craft | Close-up, texture |
| **The Drop** | 10% | Launches, scarcity | Urgency, exclusivity |

**Pillar rules:** never two product days in a row · The Standard anchors the feed ·
balance the mix monthly · every Reel is primarily The Work or The Standard.

## Folder structure

```
ReRack-Content-System/
├── 1-Brand-Bible/         The rules. Source of truth for every decision.
│   ├── brand-identity.md
│   ├── color-palette.md
│   ├── typography-rules.md
│   ├── visual-guidelines.md
│   └── voice-and-tone.md
├── 2-Prompt-Library/      Copy-paste Higgsfield prompts, by pillar (85-100).
│   ├── the-standard-prompts.md
│   ├── the-uniform-prompts.md
│   ├── the-work-prompts.md
│   ├── the-object-prompts.md
│   ├── the-drop-prompts.md
│   └── reel-video-prompts.md
├── 3-Caption-Engine/      300 captions + 150 reel hooks, in ReRack's voice.
│   ├── caption-framework.md
│   ├── caption-pack-001.md … caption-pack-010.md
│   └── reel-hooks-pack-001.md … reel-hooks-pack-005.md
├── 4-Content-Calendar/    What to post, when, with which prompt + caption.
│   ├── 30-day-calendar.md
│   ├── 90-day-calendar.md
│   └── posting-schedule.md
├── 5-Soul-Character/      ATLAS — the one recurring model. Consistency spec.
│   ├── soul-reference.md
│   └── model-specifications.md
├── 6-Asset-Tracker/       Generated → posted → performance.
│   ├── generated-assets.md
│   ├── posted-content.md
│   └── performance-log.md
├── 7-Scripts-and-Tools/   Python automation (standard library only).
│   ├── weekly-briefing-generator.py
│   ├── calendar-auditor.py
│   └── performance-analyzer.py
└── README.md
```

## The ID convention (how everything links)

The calendar references the library and the engine by stable IDs:

| Asset | ID format | Example |
|---|---|---|
| Image prompt | `STD/UNI/WRK/OBJ/DRP-##` | `UNI-07` |
| Reel video prompt | `REEL-##` | `REEL-02` |
| Caption | `CAP-###` (001–300) | `CAP-118` |
| Reel hook | `HOOK-###` (001–150) | `HOOK-044` |
| Generated asset | `RR-YYYYMMDD-###` | `RR-20260608-001` |

A calendar day cites a prompt ID + caption/hook ID; you pull the actual copy from
the library/engine, generate the asset, log it in the tracker, and post.

## The daily / weekly workflow

1. **Sunday — plan the week.**
   `python 7-Scripts-and-Tools/weekly-briefing-generator.py`
   Prints the week's posts, the Higgsfield generation queue, and the schedule.
2. **Generate.** For each post, open the referenced prompt in `2-Prompt-Library/`,
   paste into Higgsfield, generate at the right aspect ratio. Log each asset in
   `6-Asset-Tracker/generated-assets.md`. For ATLAS images, run the consistency
   checklist in `5-Soul-Character/soul-reference.md`.
3. **Write / pull captions.** Grab the referenced `CAP-###` / `HOOK-###` from
   `3-Caption-Engine/`. Adjust only if needed; keep the voice.
4. **Audit before scheduling.**
   `python 7-Scripts-and-Tools/calendar-auditor.py`
   Confirms pillar rules (no two product days in a row, mix, reel cadence).
5. **Post & record.** Move the asset to `6-Asset-Tracker/posted-content.md` with
   its permalink.
6. **Measure.** After ~48–72h, log metrics in `performance-log.md`, then run
   `python 7-Scripts-and-Tools/performance-analyzer.py` for pillar mix and
   engagement by pillar. Distill weekly/monthly learnings back into the system.

## The tools

| Script | What it does |
|---|---|
| `weekly-briefing-generator.py` | Reads the 30-day calendar, prints a week's briefing + generation queue. `--week N`, `--all`. |
| `calendar-auditor.py` | Validates the calendar against pillar rules; non-zero exit on violations. `--strict`. |
| `performance-analyzer.py` | Reads the tracker tables; reports live pillar mix and engagement by pillar. |

All three use only the Python standard library — `python3 <script> --help` for options.

## Brand in one breath

Premium tactical-luxury apparel for disciplined men rebuilding themselves.
Monochrome, industrial, cinematic. Hard light, deep shadow, matte grade, film
grain, negative space. The voice is direct, controlled, intelligent — a man with
nothing to prove. No neon, no cheese, no hype. One recurring model (ATLAS), one
standard, one uniform.

**FORGED DAILY.**
