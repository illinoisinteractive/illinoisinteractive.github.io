# illinoisinteractive.github.io

Pages site for Illinois Interactive (.org) — the temporary home while the full site is built.

## What's here

A single-page placeholder:

- `index.html` — hero, "What we'll be" cards, "What's next" roadmap, contact
- `styles.css` — dark theme (prairie gold + signal teal) with 8-bit accents (Press Start 2P, hard offset shadows, square corners), responsive, `prefers-reduced-motion` aware
- `main.js` — scroll reveals + a pointer-aware canvas "playfield". Two swappable background engines share the palette: pixel nodes with drifting 8-bit sprites (default), or size-varied falling pieces — tetrominoes, pixel fragments, and recognizable 8-bit power-ups (mushroom, star, heart, ghost, gem) — open `index.html?bg=fall` to preview the alternate

- `content.js` + `content/site-content.json` — renders the "Latest" strip and contact email from synced Doc content (falls back to the static HTML)

Pure vanilla HTML/CSS/JS. No build step, no dependencies beyond a Google Fonts stylesheet (Space Grotesk + Press Start 2P) with system-font fallbacks.

## Content sync (Google Doc)

Leadership can update the "Latest" strip and the contact email from a Google Doc — no web files involved.

- `.github/scripts/convert_doc.py` — pulls the doc's public export and flattens each Heading 2 section to sanitized plain text in `content/site-content.json` (stdlib only; images are dropped, lists become `•` lines)
- `.github/workflows/google-doc-sync.yml` — runs every 15 minutes and on demand from the repo's **Actions** tab; commits only when content changed, which triggers a Pages deploy

To point it at a doc: paste the doc ID (the middle of the doc URL) into `DOC_ID` in the script. The doc must be shared **Anyone with the link → Viewer**. Doc convention: start sections with Heading 2 — `Announcement` and/or `Contact`. If a sync ever parses to zero sections (e.g. sharing got revoked), the last good content is kept and the site is unaffected.

## Contact

Current placeholder contact: `illinoisinteract@gmail.com` (role-based addresses like `chair@illinoisinteractive.org` will replace it once the org's mail is live).

## Deploy

Push to `main` and GitHub Pages serves it at `https://illinoisinteractive.github.io`. The custom domain `illinoisinteractive.org` can be added in the Pages settings whenever DNS is ready.
