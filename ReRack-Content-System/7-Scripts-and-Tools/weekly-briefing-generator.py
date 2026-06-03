#!/usr/bin/env python3
"""
ReRack — Weekly Briefing Generator
==================================

Reads the 30-day content calendar and produces a clean, actionable briefing
for a single week: exactly what to generate, what to write, and when to post.
Use it every Sunday to set up the week.

Usage:
    python weekly-briefing-generator.py                # the upcoming/active week
    python weekly-briefing-generator.py --week 2       # week 2 of the calendar
    python weekly-briefing-generator.py --all          # every week
    python weekly-briefing-generator.py --calendar /path/to/30-day-calendar.md

Output is plain text suitable for pasting into a notes app or a Sunday email.
Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CALENDAR = os.path.normpath(
    os.path.join(HERE, "..", "4-Content-Calendar", "30-day-calendar.md")
)

DAY_HEADER = re.compile(r"^##\s*Day\s+(\d+)\s*[—–-]\s*(.+?)\s*$")
FIELD = re.compile(r"^\*\*(.+?):\*\*\s*(.*)$")
DATE_IN_HEADER = re.compile(r"(\d{4}-\d{2}-\d{2})")


def parse_calendar(path: str) -> list[dict]:
    """Parse the 30-day calendar into a list of per-day post dicts."""
    if not os.path.exists(path):
        sys.exit(f"Calendar not found: {path}\n"
                 f"Generate it first (4-Content-Calendar/30-day-calendar.md).")

    days: list[dict] = []
    current: dict | None = None
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.rstrip("\n")
            header = DAY_HEADER.match(line)
            if header:
                if current:
                    days.append(current)
                day_num = int(header.group(1))
                label = header.group(2).strip()
                date_match = DATE_IN_HEADER.search(label)
                current = {
                    "day": day_num,
                    "label": label,
                    "date": date_match.group(1) if date_match else None,
                    "fields": {},
                }
                continue
            if current is not None:
                field = FIELD.match(line)
                if field:
                    key = field.group(1).strip().lower()
                    current["fields"][key] = field.group(2).strip()
        if current:
            days.append(current)
    return days


def is_reel(day: dict) -> bool:
    f = day["fields"]
    if "video prompt" in f or "reel hook" in f:
        return True
    ctype = f.get("content type", "").lower()
    if "reel" in ctype:
        return True
    return f.get("reel?", "").strip().lower().startswith("y")


def week_of(day: dict) -> int:
    return (day["day"] - 1) // 7 + 1


def pick_active_week(days: list[dict]) -> int:
    """Choose the week whose dates bracket today; fall back to week 1."""
    today = dt.date.today()
    for day in days:
        if day["date"]:
            try:
                d = dt.date.fromisoformat(day["date"])
            except ValueError:
                continue
            if d >= today:
                return week_of(day)
    return 1


def render_day(day: dict) -> str:
    f = day["fields"]
    reel = is_reel(day)
    icon = "[REEL]" if reel else "[IMG ]"
    pillar = f.get("pillar", "?")
    time = f.get("post time", "TBD")
    lines = [f"  {icon}  Day {day['day']:>2} — {day['label']}"]
    lines.append(f"         Pillar : {pillar}")
    if reel:
        lines.append(f"         Video  : {f.get('video prompt', '—')}")
        lines.append(f"         Hook   : {f.get('reel hook', '—')}")
        if "duration" in f:
            lines.append(f"         Length : {f.get('duration')}")
    else:
        lines.append(f"         Image  : {f.get('image prompt', '—')}")
        lines.append(f"         Caption: {f.get('caption', '—')}")
    lines.append(f"         Time   : {time}")
    if f.get("notes"):
        lines.append(f"         Why    : {f.get('notes')}")
    return "\n".join(lines)


def render_week(week: int, days: list[dict]) -> str:
    members = [d for d in days if week_of(d) == week]
    if not members:
        return f"(no days found for week {week})"

    pillar_counts: dict[str, int] = {}
    reels = 0
    todo_gen: list[str] = []
    for d in members:
        pillar_counts[d["fields"].get("pillar", "?")] = (
            pillar_counts.get(d["fields"].get("pillar", "?"), 0) + 1
        )
        if is_reel(d):
            reels += 1
            ref = d["fields"].get("video prompt", "—")
        else:
            ref = d["fields"].get("image prompt", "—")
        todo_gen.append(f"Day {d['day']}: {ref}")

    out = []
    out.append("=" * 64)
    out.append(f"  RERACK WEEKLY BRIEFING  —  WEEK {week}")
    out.append(f"  Forged daily. {len(members)} posts · {reels} reel(s)")
    out.append("=" * 64)
    out.append("")
    out.append("  PILLAR MIX THIS WEEK")
    for pillar, n in sorted(pillar_counts.items(), key=lambda kv: -kv[1]):
        bar = "#" * n
        out.append(f"    {pillar:<14} {bar} {n}")
    out.append("")
    if reels < 2:
        out.append("  ! Heads up: fewer than ~3 reels this week. Confirm cadence.")
        out.append("")
    out.append("  ASSETS TO GENERATE (Higgsfield queue)")
    for item in todo_gen:
        out.append(f"    [ ] {item}")
    out.append("")
    out.append("  DAILY SCHEDULE")
    for d in members:
        out.append(render_day(d))
        out.append("")
    out.append("  Before you ship: run calendar-auditor.py and the ATLAS")
    out.append("  consistency checklist on every model image.")
    out.append("=" * 64)
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate a ReRack weekly content briefing.")
    ap.add_argument("--calendar", default=DEFAULT_CALENDAR, help="Path to 30-day-calendar.md")
    ap.add_argument("--week", type=int, default=None, help="Week number (1-5). Default: active week.")
    ap.add_argument("--all", action="store_true", help="Print briefings for every week.")
    args = ap.parse_args()

    days = parse_calendar(args.calendar)
    if not days:
        sys.exit("No day blocks parsed from the calendar. Check its format.")

    weeks = sorted({week_of(d) for d in days})
    if args.all:
        for w in weeks:
            print(render_week(w, days))
            print()
    else:
        target = args.week or pick_active_week(days)
        if target not in weeks:
            sys.exit(f"Week {target} not in calendar (weeks present: {weeks}).")
        print(render_week(target, days))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
