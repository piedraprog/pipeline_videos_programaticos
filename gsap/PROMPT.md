# PROMPT — programmatic GSAP videos (modular)

Copy this prompt, fill in the swappable blocks and hand it to the agent. The **TECH** block is fixed; everything else is swappable.
No visual style is the "base": the look always comes from the STYLE block (`styles/*.json`).

---

## [TECH] — fixed, do not edit
- One HTML page (`template/index.html` for pieces, `template/bumper.html` for intros/outros) with **one paused GSAP timeline**. Expose `window.seek(t)` and `window.meta` (duration, style, post, music/sfx). Do not use `setTimeout`, CSS animations, `Date.now()` or `Math.random()`: use a seeded RNG (mulberry32), so each frame is deterministic.
- Capture: Playwright opens the page through the local HTTP server (not file://), calls `seek(i/60)` and takes a screenshot of each frame at **60fps**.
- Post: ffmpeg `tmix=frames=2` → **30fps** (natural motion blur). Add a glow (screen blend) and noise only if the style asks for it (`post.glowPass`, `post.noise`).
- Audio: code-synthesized music (`tools/music.py`, profile + BPM from the style), with cuts aligned to the beat. Bumpers get synthesized SFX (`tools/sfx.py`) from `meta.sfx`. No external audio files.
- Mandatory QA before rendering (`--qa-only`):
  - Safe area.
  - Text overflow.
  - Letters clipped by masks.
  - Messaging gate: words listed in `brand.json → messaging.forbidden` must not appear.
  - Contact sheet.
- `--motion-check` on cuts: consecutive frames, no jumps.
- Movement: overlapping transitions, continuous camera, match cuts, varied timing. No visible step counter or progress bar.

## [BRAND] — swappable
`brands/<brand>/brand.json` → name, logo/isotype, palette, themes, `messaging` (tagline, ctas[], claims[], offer, forbidden[]).
The copy comes from `brands/<brand>/messaging.md` (with source citations). Do not invent offers, prices or promotions. Do not promise anything the brand does not offer (e.g. "gratis" if there is no free plan).

## [STYLE] — swappable
`"style": "<id>"` in the plan → `styles/<id>.json` (see `styles/README.md`). Available styles: dark-glow, light-corporate, kinetic-type, editorial-grid, playful-sticker.
To create a style from a reference video, see `references/README.md`.

## [STORY] — swappable
Scenes in `plans/<piece>.json`:
- Hook.
- 2–4 product beats (device + kicker + title with a *keyword*).
- 1–3 short phrases.
- Outro with the brand's real CTA.
Copy in neutral Latin American Spanish (tú), short sentences, one idea per scene.

## [FORMAT] — swappable
`format`: 9x16 | 16x9 | 1x1. Safe area per format (9x16: leave room for the platform UI at the top and bottom).

## [AUDIO] — swappable
Inherited from the style (`audio.music`, `audio.bpm`). Override it in the plan only if needed.

---
Commands:
- `node tools/render.mjs plans/x.json --qa-only`
- `node tools/render.mjs plans/x.json`
- `node tools/bumper.mjs brands/selltly/brand.json bumpers intro:A:9x16:dark outro:B:16x9:light`
