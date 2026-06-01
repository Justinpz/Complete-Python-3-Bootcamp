#!/usr/bin/env python3
"""Publish (or draft) the day's post to Substack.

Reads automation/out/post.md (YAML front matter + Markdown body), authenticates
with the unofficial python-substack library, attaches automation/out/cover.png
(best-effort), and either creates a draft or publishes based on PUBLISH_MODE.

Environment:
  PUBLISH_MODE              "publish" (default) or "draft"
  SUBSTACK_PUBLICATION_URL  e.g. https://yourname.substack.com   (required)
  Auth — provide ONE of:
    SUBSTACK_COOKIES        cookie string copied from a logged-in browser
    SUBSTACK_EMAIL + SUBSTACK_PASSWORD

Substack has no official API; this relies on python-substack, which can break
if Substack changes its internals. Session cookies expire — refresh the secret
periodically (see automation/README.md).
"""
from __future__ import annotations

import os
import sys

import frontmatter

HERE = os.path.dirname(os.path.abspath(__file__))
POST_PATH = os.path.join(HERE, "out", "post.md")
COVER_PATH = os.path.join(HERE, "out", "cover.png")


def fail(msg: str) -> "None":
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def build_api():
    from substack import Api

    publication_url = os.getenv("SUBSTACK_PUBLICATION_URL")
    if not publication_url:
        fail("SUBSTACK_PUBLICATION_URL is not set.")

    cookies = os.getenv("SUBSTACK_COOKIES")
    email = os.getenv("SUBSTACK_EMAIL")
    password = os.getenv("SUBSTACK_PASSWORD")

    if cookies:
        return Api(cookies_string=cookies, publication_url=publication_url)
    if email and password:
        return Api(email=email, password=password, publication_url=publication_url)
    fail("No Substack auth: set SUBSTACK_COOKIES or SUBSTACK_EMAIL + SUBSTACK_PASSWORD.")


def build_post(api, title: str, subtitle: str, body_md: str):
    """Build a python-substack Post from Markdown, with graceful fallback."""
    from substack.post import Post

    post = Post(title=title, subtitle=subtitle, user_id=api.get_user_id())

    # Preferred path: native Markdown import (newer library versions).
    if hasattr(post, "from_markdown"):
        try:
            post.from_markdown(body_md)
            return post
        except Exception as exc:  # pragma: no cover - depends on lib version
            print(f"from_markdown failed ({exc}); falling back to block builder.")

    # Fallback: build simple blocks so we never hard-fail on formatting.
    for raw in body_md.split("\n\n"):
        chunk = raw.strip()
        if not chunk:
            continue
        if chunk.startswith("#"):
            level = len(chunk) - len(chunk.lstrip("#"))
            text = chunk.lstrip("#").strip()
            if hasattr(post, "heading"):
                post.heading(text, level=min(max(level, 1), 6))
            else:
                post.paragraph(text)
        elif chunk == "---":
            if hasattr(post, "horizontal_rule"):
                post.horizontal_rule()
        else:
            post.paragraph(chunk)
    return post


def attach_cover(api, post) -> None:
    """Best-effort cover image. Never fatal — the body must publish regardless."""
    if not os.path.exists(COVER_PATH):
        print("No cover image found; publishing without one.")
        return
    try:
        uploaded = api.get_image(COVER_PATH)
        url = uploaded.get("url") if isinstance(uploaded, dict) else uploaded
        if url and hasattr(post, "set_cover_image"):
            post.set_cover_image(url)
            print("Attached cover image.")
        else:
            print("Cover uploaded but could not be attached to this library version.")
    except Exception as exc:
        print(f"Cover image step skipped ({exc}).")


def main() -> None:
    mode = os.getenv("PUBLISH_MODE", "publish").strip().lower()
    if mode not in {"publish", "draft"}:
        fail(f"PUBLISH_MODE must be 'publish' or 'draft', got {mode!r}.")

    if not os.path.exists(POST_PATH):
        fail(f"Post not found at {POST_PATH}.")

    loaded = frontmatter.load(POST_PATH)
    title = (loaded.get("title") or "").strip()
    subtitle = (loaded.get("subtitle") or "").strip()
    body = loaded.content.strip()
    if not title or not body:
        fail("Post is missing a title or body.")

    api = build_api()
    post = build_post(api, title, subtitle, body)
    attach_cover(api, post)

    draft = api.post_draft(post.get_draft())
    draft_id = draft.get("id") if isinstance(draft, dict) else draft
    print(f"Created draft {draft_id}: {title!r}")

    if mode == "draft":
        print("PUBLISH_MODE=draft — left as a draft for review. Nothing went live.")
        return

    api.prepublish_draft(draft_id)
    api.publish_draft(draft_id)
    print(f"Published: {title!r}")


if __name__ == "__main__":
    main()
