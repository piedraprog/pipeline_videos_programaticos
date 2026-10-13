# gsap/ — brand video template (HTML + GSAP)

Self-contained, deterministic product-demo videos: one HTML page (`template/index.html`) reads a **brand** (`brands/<brand>/brand.json`) and a **plan** (`plans/*.json`), builds one paused GSAP timeline exposed as `window.seek(t)`, and lays itself out for `16x9` (1920x1080), `9x16` (1080x1920) or `1x1` (1080x1080).

## Layout
- `brands/<brand>/brand.json` – logos (`onLight`/`onDark` variants), palette + roles, `themes.dark|light` overrides, fonts, tagline, CTA, tone.
- `plans/*.json` – `brand`, `output`, `format`, `theme` (`dark`|`light`), `fps`, `outFps`, `bpm`, `seed`, `scenes[]`.
  Scene types: `hook` (copy), `device` (phone|browser + screenshot, optional `after`, `srcWidth`, `scrollTo`, `tap{x,y}` in CSS px, `zoom`, `hoverOnly`, `kicker`, `title`), `phrase` (copy), `outro` (logo + tagline + CTA). Durations are in `beats`. Wrap a keyword in `*asterisks*` for the serif-italic accent.
- `template/` – page, local fonts, `lib/gsap.min.js`.
- `tools/render.mjs` – static server + Playwright: QA gate → contact sheet → 60 fps frames → music → ffmpeg (30 fps frame blend, glow/grain per theme).
- `tools/music.py` (cinematic for dark, corporate for light), `tools/sheet.py`, `tools/motioncheck.py`.
- `assets/shots/` – storefront screenshots + `boxes.json` (button positions).
- `out/<name>/` – generated (git-ignored): `qa/`, `contact-sheet.png`, `music.wav`, `<name>.mp4`.

## Commands (run from this `gsap/` folder)
```bash
node tools/render.mjs plans/selltly-9x16-light.json --qa-only   # QA gate + contact sheet only
node tools/render.mjs plans/selltly-9x16-light.json --qa-only --motion-check   # + samples consecutive frames around every cut, fails on visual jumps
node tools/render.mjs plans/selltly-9x16-light.json             # full render -> out/selltly-9x16-light/selltly-9x16-light.mp4
```
The QA gate fails (exit 1) if any text leaves the format's title-safe area, overflows its box, or a letter is clipped by its mask.

New brand/format: add `brands/<brand>/brand.json` + logos, copy a plan, change `brand`, `format`, `theme`, `output`, scenes; run the same command.

## Motion language
Scenes overlap (~0.35 s): the next entrance starts before the previous exit ends; cuts land on the beat. Device scenes keep a continuous camera drift (no holds), zoom with expo/power inOut eases, and consecutive scenes on the same device match-cut (camera eases back to a shared pose, screens cross-dissolve). The hook icon flies into the corner mark. Text timing is varied per scene (seeded), exits stagger upward, entrances use overshoot on secondary elements. `theme: light` uses calmer eases, smaller blur/rotation, no glow pass and corporate music.

## Requirements
- Node 24 + `playwright` (resolved from the repo's `node_modules`; run `bunx playwright install chromium` once).
- `ffmpeg` on PATH.
- Python 3 with `numpy` and `Pillow` (`pip install numpy pillow`). On Windows the tool calls `python`; override with `PYTHON=...`.

## Modular system (update)
- `PROMPT.md`: fixed TECH block + swappable BRAND/STYLE/STORY/FORMAT/AUDIO blocks.
- `styles/`: visual recipes (see `styles/README.md`). `references/README.md`: how to turn a reference video into a style.
- `brands/<brand>/messaging.md`: copy with source citations; `brand.json → messaging` (tagline, ctas, claims, forbidden) is checked by the messaging gate.
- Bumpers: `template/bumper.html` (variants A–D, intro|outro, dark|light) + `tools/bumper.mjs` + `tools/sfx.py`:
  `node tools/bumper.mjs brands/selltly/brand.json out/bumpers intro:A:9x16:dark outro:A:16x9:light [--qa-only]`
