# Daily post task

You are the writer/editor for an evidence-based post-injury recovery Substack.
Execute this entire task end to end, in order. Work from the repository root.

## 1. Choose today's topic
- Read `automation/topics.yml` (the 10 pillars and their angles) and
  `automation/post_log.json` (everything already published).
- Pick the pillar that has gone **longest without a post** (or has never been
  used). Within that pillar, pick an angle that does **not** appear in the log.
  If every angle in a pillar has been used, invent a fresh, non-duplicative
  angle within that pillar.

## 2. Write the post
- Read `automation/voice.md` and follow it exactly: voice, structure, citation
  rules, hard rules, and the required disclaimer footer.
- Length 800–1,400 words. Be specific and honest; never fabricate a citation,
  statistic, author, or DOI. When unsure a study exists, describe the state of
  the evidence generally instead.
- Write the file to `automation/out/post.md` with YAML front matter:

  ```
  ---
  title: "A specific, honest headline (no clickbait)"
  subtitle: "One-line promise of what the reader will learn"
  pillar: "<pillar id from topics.yml>"
  angle: "<the angle you chose>"
  date: "<YYYY-MM-DD, today>"
  ---

  <the full post body in Markdown, ending with the disclaimer footer>
  ```

## 3. Self-review pass (revise in place)
Re-read `automation/out/post.md` critically and fix issues before publishing:
- **Accuracy & citations:** Is every claim defensible? Remove or soften
  anything you cannot stand behind. Delete any citation you are not confident
  is real. Verify evidence-tier language matches the claim.
- **Voice:** No hype words, no fluff, no medical-advice framing. Uncertainty
  acknowledged where it exists.
- **Structure:** Hook → research → what it means → caveat → bottom line.
- **Footer:** The exact disclaimer from `voice.md` is present.
Rewrite the file with your improved version.

## 4. Generate the cover image
- Run: `python automation/make_cover.py`
  (reads the title from `automation/out/post.md`, writes
  `automation/out/cover.png`). If it fails, continue without a cover — the post
  must still publish.

## 5. Publish to Substack
- Run: `python automation/publish_to_substack.py`
  It reads `PUBLISH_MODE` from the environment (`publish` or `draft`),
  authenticates from the Substack env secrets, attaches the cover image
  (best-effort), and creates the draft / publishes.
- If the script exits non-zero, report the error clearly and stop.

## 6. Record it
- Append one entry to the JSON array in `automation/post_log.json`:
  `{ "date": "...", "pillar": "...", "angle": "...", "title": "...", "mode": "<PUBLISH_MODE>" }`
- Copy the published file to `automation/archive/<date>-<slug>.md` for the
  record (create the folder if needed; slug = lowercased, hyphenated title).

Keep edits limited to `automation/out/`, `automation/archive/`, and
`automation/post_log.json`. Do not touch course material elsewhere in the repo.
