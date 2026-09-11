# illinoisinteractive.github.io

Pages site for Illinois Interactive (.org) — the temporary home while the full site is built.

## What's here

A single-page placeholder:

- `index.html` — hero, "What we'll be" cards, "What's next" roadmap, contact
- `styles.css` — dark theme (prairie gold + signal teal) with 8-bit accents (Press Start 2P, hard offset shadows, square corners), responsive, `prefers-reduced-motion` aware
- `main.js` — scroll reveals + a pointer-aware canvas "playfield". Two swappable background engines share the palette: pixel nodes with drifting 8-bit sprites (default), or size-varied falling pieces — tetrominoes, pixel fragments, and recognizable 8-bit power-ups (mushroom, star, heart, ghost, gem) — open `index.html?bg=fall` to preview the alternate

Pure vanilla HTML/CSS/JS. No build step, no dependencies beyond a Google Fonts stylesheet (Space Grotesk + Press Start 2P) with system-font fallbacks.

## Contact

Current placeholder contact: `illinoisinteract@gmail.com` (role-based addresses like `chair@illinoisinteractive.org` will replace it once the org's mail is live).

## Deploy

Push to `main` and GitHub Pages serves it at `https://illinoisinteractive.github.io`. The custom domain `illinoisinteractive.org` can be added in the Pages settings whenever DNS is ready.
