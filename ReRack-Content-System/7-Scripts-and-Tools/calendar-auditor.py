#!/usr/bin/env python3
"""
ReRack — Calendar Auditor
=========================

Validates the 30-day content calendar against ReRack's pillar rules so the
feed stays disciplined and on-brand. Run it after editing the calendar and
before committing a month of posts.

Checks:
  1. No product (The Uniform + The Object) on two consecutive days.
  2. Pillar mix lands near the target: Standard 30 / Uniform 25 / Work 20 /
     Object 15 / Drop 10 (percent of posts).
  3. ~3 Reels per week (flags <2 or >4).
  4. Every Reel is primarily The Work or The Standard.
  5. Every day references an image/video prompt AND (for static) a caption.

Usage:
    python calendar-auditor.py
    python calendar-auditor.py --calendar /path/to/30-day-calendar.md
    python calendar-auditor.py --strict   # warnings also cause non-zero exit

Exit code 0 = clean (no errors). Non-zero = at least one error.
Standard library only.
"""
from __future__ import annotations

import argparse
import os
import sys

# Reuse the calendar parser from the briefing generator.
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util


def _load_parser():
    spec = importlib.util.spec_from_file_location(
        "wbg", os.path.join(HERE, "weekly-briefing-generator.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


wbg = _load_parser()

DEFAULT_CALENDAR = wbg.DEFAULT_CALENDAR
PRODUCT_PILLARS = {"the uniform", "the object"}
REEL_PILLARS = {"the work", "the standard"}
TARGET_MIX = {
    "the standard": 30,
    "the uniform": 25,
    "the work": 20,
    "the object": 15,
    "the drop": 10,
}
MIX_TOLERANCE = 7  # percentage points of slack per pillar


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passes: list[str] = []

    def err(self, m: str) -> None:
        self.errors.append(m)

    def warn(self, m: str) -> None:
        self.warnings.append(m)

    def ok(self, m: str) -> None:
        self.passes.append(m)


def pillar_of(day: dict) -> str:
    return day["fields"].get("pillar", "").strip().lower()


def check_consecutive_product(days, rep: Report) -> None:
    flagged = False
    for a, b in zip(days, days[1:]):
        if pillar_of(a) in PRODUCT_PILLARS and pillar_of(b) in PRODUCT_PILLARS:
            rep.err(
                f"Two product days in a row: Day {a['day']} ({a['fields'].get('pillar')}) "
                f"-> Day {b['day']} ({b['fields'].get('pillar')})."
            )
            flagged = True
    if not flagged:
        rep.ok("No product (Uniform/Object) posts on consecutive days.")


def check_mix(days, rep: Report) -> None:
    total = len(days)
    counts: dict[str, int] = {}
    for d in days:
        counts[pillar_of(d)] = counts.get(pillar_of(d), 0) + 1
    rep.ok(f"Parsed {total} posts.")
    for pillar, target in TARGET_MIX.items():
        actual_pct = round(100 * counts.get(pillar, 0) / total) if total else 0
        delta = actual_pct - target
        label = pillar.title()
        line = f"{label}: {actual_pct}% (target {target}%, n={counts.get(pillar, 0)})"
        if abs(delta) > MIX_TOLERANCE:
            rep.warn(f"Pillar mix off — {line}.")
        else:
            rep.ok(f"Pillar mix OK — {line}.")
    unknown = counts.get("", 0)
    if unknown:
        rep.err(f"{unknown} day(s) have no recognizable Pillar field.")


def check_reels(days, rep: Report) -> None:
    by_week: dict[int, int] = {}
    for d in days:
        if wbg.is_reel(d):
            w = wbg.week_of(d)
            by_week[w] = by_week.get(w, 0) + 1
            if pillar_of(d) not in REEL_PILLARS:
                rep.warn(
                    f"Day {d['day']} is a Reel but pillar is "
                    f"'{d['fields'].get('pillar')}' (reels should be Work/Standard)."
                )
    weeks = sorted({wbg.week_of(d) for d in days})
    for w in weeks:
        n = by_week.get(w, 0)
        if n < 2:
            rep.warn(f"Week {w}: only {n} reel(s) (~3 recommended).")
        elif n > 4:
            rep.warn(f"Week {w}: {n} reels (more than ~3 recommended).")
        else:
            rep.ok(f"Week {w}: {n} reels.")


def check_completeness(days, rep: Report) -> None:
    incomplete = 0
    for d in days:
        f = d["fields"]
        if wbg.is_reel(d):
            if not (f.get("video prompt") and f.get("reel hook")):
                rep.warn(f"Day {d['day']} (Reel) missing video prompt or hook.")
                incomplete += 1
        else:
            if not f.get("image prompt"):
                rep.warn(f"Day {d['day']} missing image prompt reference.")
                incomplete += 1
            if not f.get("caption"):
                rep.warn(f"Day {d['day']} missing caption reference.")
                incomplete += 1
    if not incomplete:
        rep.ok("Every day references the prompts/captions it needs.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Audit the ReRack content calendar.")
    ap.add_argument("--calendar", default=DEFAULT_CALENDAR)
    ap.add_argument("--strict", action="store_true",
                    help="Treat warnings as failures (non-zero exit).")
    args = ap.parse_args()

    days = wbg.parse_calendar(args.calendar)
    if not days:
        sys.exit("No day blocks parsed. Check the calendar format.")

    rep = Report()
    check_mix(days, rep)
    check_consecutive_product(days, rep)
    check_reels(days, rep)
    check_completeness(days, rep)

    print("=" * 60)
    print("  RERACK CALENDAR AUDIT")
    print("=" * 60)
    for m in rep.passes:
        print(f"  [PASS] {m}")
    for m in rep.warnings:
        print(f"  [WARN] {m}")
    for m in rep.errors:
        print(f"  [FAIL] {m}")
    print("-" * 60)
    print(f"  {len(rep.passes)} passed · {len(rep.warnings)} warnings · "
          f"{len(rep.errors)} errors")
    print("=" * 60)

    if rep.errors or (args.strict and rep.warnings):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
