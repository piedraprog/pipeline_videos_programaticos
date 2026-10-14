# Reference: apple-saas-continuous

- **Source:** Instagram reel, "Platomico" restaurant POS demo (35 s, 9:16). Shared by Jose on 2026-10-14. Not downloaded or stored in the repo.
- **Style file:** `styles/apple-saas-continuous.json`. **Template:** `engines/gsap/continuous.html` (`"template": "continuous"` in the plan; the story goes in `plan.story`).

## What it does
- Off-white `#f7f7f7` background with a faint grid; one dark `#111` scene. Black text in a clean neo-grotesque sans (Inter). Green `#22c55e` dots for success/live.
- Snappy spring eases (power4 / expo / back.out).
- One continuous take: the camera zooms along Z into an element that morphs into the next scene. No hard cuts.
- A global "Dynamic Island" pill, top center: icon, status text and a blinking green "En vivo" dot. It pops along Y every time the scene changes.

## Scene grammar
1. **Problem.** Centered lines swap on the beat. Inline icons pop out into floating app icons with a sine hover.
2. **Hub.** The icons snap into a hexagon around the central logo, and SVG lines draw to the center. Labels sit under the icons; a tiny label at the top ("/ ...") and a line at the bottom.
3. **Zoom into the logo.** It morphs into the device UI; the user acts and staggered toasts cascade. Short line at the bottom.
4. **Zoom into the first toast.** Dark scene with a list UI: an item pops, gets clicked, turns green and slides away.
5. **Zoom out to white.** Phone and desktop dashboard slide up while the island updates.
6. **Push-in on a number** that counts up.
7. **Collapse into the logo.** A ripple; the logo shifts left; brand name, subtitle and a "•"-separated feature list.

## Mapping to the brand
- Brand palette only as accents over the light base. Green is kept for live/success.
- Every number must be real (captures and manifests).
- No intro/outro bumper and no voiceover (AGENTS.md delivery rules). The closing lockup is a content scene.
