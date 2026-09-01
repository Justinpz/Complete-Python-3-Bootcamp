# Daily Substack automation

Writes, self-reviews, and publishes one **evidence-based post-injury recovery**
post per day to your Substack — fully automated, running off your **Claude
subscription** (not pay-per-token API credits).

## How it works

```
GitHub Actions (daily cron)
  └─ Claude Code Action  [auth: CLAUDE_CODE_OAUTH_TOKEN → your subscription]
       reads topics.yml + post_log.json + voice.md
       1. picks the least-recently-covered pillar + a fresh angle
       2. writes the post (out/post.md)
       3. self-reviews for accuracy / citations / voice, then revises
       4. generates a cover image (make_cover.py)
       5. publishes via publish_to_substack.py
       6. logs it to post_log.json + archive/
  └─ commits the updated log + archive back to the repo
```

| File | Role |
|------|------|
| `prompt.md` | The task Claude runs each day. |
| `voice.md` | Editorial standard (voice, structure, citation rules, disclaimer). |
| `topics.yml` | The 10 pillars and their angles. |
| `post_log.json` | History; drives topic rotation. Starts as `[]`. |
| `make_cover.py` | Branded cover image (Pillow, no external service). |
| `publish_to_substack.py` | Pushes the post to Substack (unofficial API). |
| `../.github/workflows/daily-substack.yml` | The daily schedule. |

## One-time setup

### 1. Generate your Claude subscription token
On your own machine, with Claude Code installed and logged into your Pro/Max
subscription:

```bash
claude setup-token
```

Copy the `sk-ant-oat01-...` token it prints (shown once).

### 2. Get your Substack auth
Recommended: **session cookies** (more reliable than email/password). Log into
Substack in your browser, open DevTools → Application/Storage → Cookies, and
copy the cookie string for your Substack domain. Alternatively use your email +
password.

### 3. Add repository secrets
GitHub → repo **Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Value |
|--------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | the `sk-ant-oat01-...` token from step 1 |
| `SUBSTACK_PUBLICATION_URL` | e.g. `https://yourname.substack.com` |
| `SUBSTACK_COOKIES` | your cookie string *(or use the two below instead)* |
| `SUBSTACK_EMAIL` | your Substack login email *(if not using cookies)* |
| `SUBSTACK_PASSWORD` | your Substack password *(if not using cookies)* |

> Do **not** add `ANTHROPIC_API_KEY` — if present it overrides the OAuth token
> and you'd be billed per token instead of using your subscription.

### 4. Test before going live
Run the workflow manually first, in **draft** mode:

GitHub → **Actions → Daily Substack Post → Run workflow** → `publish_mode:
draft`. This generates a post and creates a **draft** in your Substack
dashboard without publishing.

**The pipeline ships in draft-first mode:** both scheduled and manual runs
create drafts for you to review and publish. Once you're happy with the
quality, flip to fully automatic publishing (see below).

You can also dry-run the publisher locally:

```bash
pip install -r automation/requirements.txt
# put a sample post at automation/out/post.md, then:
PUBLISH_MODE=draft \
SUBSTACK_PUBLICATION_URL=... SUBSTACK_COOKIES=... \
python automation/publish_to_substack.py
```

## Operating notes

- **Schedule:** edit the `cron` line in the workflow (`0 13 * * *` = 13:00 UTC).
- **Going live:** the workflow defaults to `draft`. When you're ready for fully
  automatic publishing, change the `PUBLISH_MODE` fallback in the workflow from
  `'draft'` to `'publish'` (or run manually with `publish_mode: publish`).
- **Token refresh:** the Substack session cookie expires every few weeks — when
  publishing starts failing on auth, regenerate `SUBSTACK_COOKIES`. The
  `CLAUDE_CODE_OAUTH_TOKEN` may also need periodic regeneration via
  `claude setup-token`.
- **Richer cover art:** `make_cover.py` produces a clean branded title card with
  no external dependency. To use AI-generated covers instead, replace that step
  with a call to an image API/MCP that writes the same `automation/out/cover.png`.

## Honest caveats

- **Substack has no official API.** This uses the community
  [`python-substack`](https://github.com/ma2za/python-substack) library, which
  can break if Substack changes its internals.
- **Fully automated publishing of cited medical content** means an occasional
  imperfect citation could go live with no human gate. Mitigations: the
  self-review pass, the disclaimer footer on every post, and the draft-mode
  escape hatch above. Running the first week or two in draft mode is the safest
  way to calibrate.
