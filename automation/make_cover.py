#!/usr/bin/env python3
"""Generate a simple branded cover image for the day's post.

Reads the title (and pillar) from automation/out/post.md front matter and
writes a 1200x600 PNG to automation/out/cover.png. Intentionally dependency
-light (Pillow only) so it runs in CI without the image-generation MCP. To use
richer AI cover art instead, swap this step for an MCP/image-API call that
writes the same output path.
"""
from __future__ import annotations

import os
import textwrap

import frontmatter
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
POST_PATH = os.path.join(HERE, "out", "post.md")
COVER_PATH = os.path.join(HERE, "out", "cover.png")

WIDTH, HEIGHT = 1200, 600
BG_TOP = (15, 23, 42)      # slate-900
BG_BOTTOM = (30, 41, 59)   # slate-800
ACCENT = (56, 189, 248)    # sky-400
TEXT = (241, 245, 249)     # slate-100
MUTED = (148, 163, 184)    # slate-400

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial.ttf",
]


def _font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _vertical_gradient(width: int, height: int, top, bottom) -> Image.Image:
    base = Image.new("RGB", (width, height), top)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        t = y / max(height - 1, 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)
    return base


def main() -> None:
    post = frontmatter.load(POST_PATH)
    title = (post.get("title") or "Evidence-Based Recovery").strip()
    pillar = (post.get("pillar") or "").replace("-", " ").upper()

    img = _vertical_gradient(WIDTH, HEIGHT, BG_TOP, BG_BOTTOM)
    draw = ImageDraw.Draw(img)

    # Accent bar
    draw.rectangle([(80, 150), (140, 158)], fill=ACCENT)

    # Kicker (pillar)
    if pillar:
        draw.text((80, 110), pillar, font=_font(26), fill=ACCENT)

    # Title, wrapped
    title_font = _font(58)
    wrapped = textwrap.wrap(title, width=28)[:5]
    y = 190
    for line in wrapped:
        draw.text((80, y), line, font=title_font, fill=TEXT)
        y += 74

    # Footer brand
    draw.text((80, HEIGHT - 70), "EVIDENCE-BASED RECOVERY", font=_font(24), fill=MUTED)

    os.makedirs(os.path.dirname(COVER_PATH), exist_ok=True)
    img.save(COVER_PATH, "PNG")
    print(f"Wrote cover image: {COVER_PATH}")


if __name__ == "__main__":
    main()
