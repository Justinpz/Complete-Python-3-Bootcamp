#!/usr/bin/env python3
"""
ReRack — Performance Analyzer
=============================

Reads the asset tracker's markdown tables and turns logged numbers into
decisions: which pillar earns saves, which posting time wins, and whether the
live feed actually hit the 30/25/20/15/10 pillar target.

Inputs (markdown tables in 6-Asset-Tracker/):
  - posted-content.md   -> pillar mix of what actually shipped
  - performance-log.md  -> engagement metrics per post

Usage:
    python performance-analyzer.py
    python performance-analyzer.py --tracker /path/to/6-Asset-Tracker

Rows whose cells are blank or contain "example"/"replace" are ignored, so the
script is safe to run against a freshly-seeded tracker (it just reports "no
data yet"). Standard library only.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TRACKER = os.path.normpath(os.path.join(HERE, "..", "6-Asset-Tracker"))

TARGET_MIX = {
    "The Standard": 30,
    "The Uniform": 25,
    "The Work": 20,
    "The Object": 15,
    "The Drop": 10,
}
PLACEHOLDER = re.compile(r"example|replace|_url_|TBD", re.IGNORECASE)


def parse_md_tables(path: str) -> list[list[dict]]:
    """Return every markdown table in a file as a list of {header: cell} rows."""
    if not os.path.exists(path):
        return []
    tables: list[list[dict]] = []
    header: list[str] | None = None
    rows: list[dict] = []

    def flush():
        nonlocal header, rows
        if header and rows:
            tables.append(rows)
        header, rows = None, []

    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if line.startswith("|") and line.endswith("|"):
                cells = [c.strip() for c in line.strip("|").split("|")]
                if set("".join(cells)) <= set("-: "):  # separator row
                    continue
                if header is None:
                    header = cells
                else:
                    if len(cells) == len(header):
                        rows.append(dict(zip(header, cells)))
            else:
                flush()
        flush()
    return tables


def is_real_row(row: dict) -> bool:
    joined = " ".join(v for v in row.values() if v)
    if not joined.strip():
        return False
    if PLACEHOLDER.search(joined):
        return False
    return True


def find_table_with(tables: list[list[dict]], *needed: str) -> list[dict]:
    for t in tables:
        if not t:
            continue
        cols = {c.lower() for c in t[0].keys()}
        if all(any(n.lower() in c for c in cols) for n in needed):
            return [r for r in t if is_real_row(r)]
    return []


def col(row: dict, *names: str) -> str:
    for key in row:
        kl = key.lower()
        if any(n.lower() in kl for n in names):
            return row[key]
    return ""


def to_num(s: str) -> float | None:
    s = (s or "").replace(",", "").replace("%", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def report_pillar_mix(tracker: str) -> None:
    tables = parse_md_tables(os.path.join(tracker, "posted-content.md"))
    rows = find_table_with(tables, "Pillar", "Format")
    print("-" * 60)
    print("  PILLAR MIX OF LIVE POSTS  (target 30/25/20/15/10)")
    print("-" * 60)
    if not rows:
        print("  No posted content logged yet.")
        return
    counts: dict[str, int] = {}
    for r in rows:
        p = col(r, "Pillar").strip()
        if p:
            counts[p] = counts.get(p, 0) + 1
    total = sum(counts.values())
    for pillar, target in TARGET_MIX.items():
        n = counts.get(pillar, 0)
        pct = round(100 * n / total) if total else 0
        flag = "" if abs(pct - target) <= 7 else "  <-- off target"
        bar = "#" * n
        print(f"  {pillar:<14} {pct:>3}%  (n={n:<3}) {bar}{flag}")
    print(f"  Total posts: {total}")


def report_engagement(tracker: str) -> None:
    tables = parse_md_tables(os.path.join(tracker, "performance-log.md"))
    rows = find_table_with(tables, "Pillar", "Reach")
    print("-" * 60)
    print("  ENGAGEMENT BY PILLAR")
    print("-" * 60)
    if not rows:
        print("  No performance metrics logged yet.")
        return

    agg: dict[str, dict[str, float]] = {}
    best_saves = (None, -1.0)
    for r in rows:
        pillar = col(r, "Pillar").strip() or "?"
        reach = to_num(col(r, "Reach"))
        likes = to_num(col(r, "Likes")) or 0
        comments = to_num(col(r, "Comments")) or 0
        saves = to_num(col(r, "Saves")) or 0
        shares = to_num(col(r, "Shares")) or 0
        a = agg.setdefault(pillar, {"n": 0, "reach": 0, "saves": 0,
                                    "shares": 0, "eng": 0.0})
        a["n"] += 1
        a["reach"] += reach or 0
        a["saves"] += saves
        a["shares"] += shares
        if reach and reach > 0:
            a["eng"] += 100 * (likes + comments + saves + shares) / reach
        date = col(r, "Post Date", "Date")
        if saves > best_saves[1]:
            best_saves = (f"{date} ({pillar})", saves)

    print(f"  {'Pillar':<14}{'posts':>6}{'avg eng%':>10}{'avg saves':>11}{'avg shares':>12}")
    for pillar, a in sorted(agg.items(), key=lambda kv: -kv[1]["n"]):
        n = a["n"] or 1
        print(f"  {pillar:<14}{a['n']:>6}{a['eng']/n:>10.1f}"
              f"{a['saves']/n:>11.1f}{a['shares']/n:>12.1f}")
    if best_saves[0]:
        print(f"\n  Most-saved post: {best_saves[0]} -> {int(best_saves[1])} saves")
    print("\n  Reminder: saves + shares signal identity resonance — weight them"
          "\n  above likes when deciding what to make more of.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Analyze ReRack content performance.")
    ap.add_argument("--tracker", default=DEFAULT_TRACKER,
                    help="Path to the 6-Asset-Tracker directory.")
    args = ap.parse_args()

    if not os.path.isdir(args.tracker):
        sys.exit(f"Tracker directory not found: {args.tracker}")

    print("=" * 60)
    print("  RERACK PERFORMANCE ANALYZER")
    print("=" * 60)
    report_pillar_mix(args.tracker)
    print()
    report_engagement(args.tracker)
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
