#!/usr/bin/env python3
"""
ReRack — Daily Post Reminder (Telegram)
=======================================

Finds today's post in the 30-day content calendar and sends it to you as a
Telegram message. Designed to run from a scheduled GitHub Action at 04:00
Europe/Berlin, but also runnable by hand.

It reads the calendar, matches today's date (Europe/Berlin by default), and
builds a concise reminder: pillar, format, the image/video prompt ID, the
caption/hook ID, post time, and the strategic note. Then it POSTs to the
Telegram Bot API.

Env (set as GitHub Action secrets):
    TELEGRAM_BOT_TOKEN   bot token from @BotFather
    TELEGRAM_CHAT_ID     your chat id (from @userinfobot or getUpdates)

Usage:
    python daily-reminder.py                 # today (Europe/Berlin), send via Telegram
    python daily-reminder.py --dry-run       # print the message, don't send
    python daily-reminder.py --date 2026-06-08
    python daily-reminder.py --tz Europe/Berlin

Standard library only. Exit 0 on success (including "no post scheduled today").
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import os
import sys
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))


def _load_parser():
    """Reuse the calendar parser from the weekly briefing generator."""
    spec = importlib.util.spec_from_file_location(
        "wbg", os.path.join(HERE, "weekly-briefing-generator.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


wbg = _load_parser()


def today_in(tz_name: str) -> dt.date:
    """Today's date in the given IANA timezone, falling back to system local."""
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo(tz_name)).date()
    except Exception:
        return dt.date.today()


def find_day(days: list[dict], target: dt.date) -> dict | None:
    iso = target.isoformat()
    for d in days:
        if d.get("date") == iso:
            return d
    return None


def build_message(day: dict | None, target: dt.date) -> str:
    weekday = target.strftime("%a")
    if day is None:
        return (
            "🪨 RERACK — no post scheduled for "
            f"{weekday} {target.isoformat()}.\n\n"
            "Either it's before the calendar starts (Day 1 = 2026-06-08) or the "
            "30-day calendar has run out. Generate the next month and keep the "
            "feed forged.\n\nFORGED DAILY."
        )
    f = day["fields"]
    reel = wbg.is_reel(day)
    lines = [
        f"🪨 RERACK — Day {day['day']} · {weekday} {target.isoformat()}",
        "",
        f"Pillar:  {f.get('pillar', '?')}",
        f"Format:  {f.get('content type', 'Static image')}",
        f"Time:    {f.get('post time', 'TBD')}",
    ]
    if reel:
        lines.append(f"Video:   {f.get('video prompt', '—')}")
        lines.append(f"Hook:    {f.get('reel hook', '—')}")
        if f.get("duration"):
            lines.append(f"Length:  {f.get('duration')}")
    else:
        lines.append(f"Image:   {f.get('image prompt', '—')}")
        lines.append(f"Caption: {f.get('caption', '—')}")
    if f.get("notes"):
        lines.append("")
        lines.append(f"Why: {f.get('notes')}")
    lines.append("")
    lines.append("Generate it, run the ATLAS check, post it. FORGED DAILY.")
    return "\n".join(lines)


def send_telegram(token: str, chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram API error: {payload}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Send today's ReRack post reminder to Telegram.")
    ap.add_argument("--calendar", default=wbg.DEFAULT_CALENDAR)
    ap.add_argument("--date", help="Override date (YYYY-MM-DD).")
    ap.add_argument("--tz", default="Europe/Berlin", help="Timezone for 'today'.")
    ap.add_argument("--dry-run", action="store_true", help="Print the message, do not send.")
    args = ap.parse_args()

    target = dt.date.fromisoformat(args.date) if args.date else today_in(args.tz)
    days = wbg.parse_calendar(args.calendar)
    message = build_message(find_day(days, target), target)

    if args.dry_run:
        print(message)
        return 0

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — printing instead:\n")
        print(message)
        return 0

    try:
        send_telegram(token, chat_id, message)
        print(f"Sent reminder for {target.isoformat()}.")
        return 0
    except (urllib.error.URLError, RuntimeError) as e:
        print(f"Failed to send Telegram message: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
