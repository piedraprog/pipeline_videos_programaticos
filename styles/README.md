# Styles
Each `*.json` is a visual "recipe" that the template reads (`plan.style`). If the plan doesn't set one, the default is dark-glow (dark theme) or light-corporate (light theme).

| id | Look | Audio |
|---|---|---|
| dark-glow | Dark, glow, rise-blur letters, serif keyword | cinematic 120 |
| light-corporate | Light background, clean, soft motion | corporate 116 |
| kinetic-type | Anton uppercase, flat colors cycling per scene, slam, panel-wipe, hard shadow | punchy 124 |
| editorial-grid | Paper with grid, Fraunces + DM Mono, wipe, left aligned | minimal 100 |
| ~~playful-sticker~~ | **DEPRECATED — not allowed** (rejected by Jose 2026-10-14). The render fails if a plan uses it. | — |

Fields:
- `theme`, `roles`
- `background{type: glow|flat-cycle|paper-grid|confetti, particles, grain, vignette, cycle}`
- `fonts{display,keyword,label}` (TTF files in `engines/gsap/fonts/`)
- `text{enter: rise-blur|slam|wipe|pop, align, sticker, keyword, sizeBoost}`
- `motion{enter,overshoot,camera,blur,tilt}`
- `transition{type: crossfade|panel-wipe|wipe, overlap}`
- `device{shadow}`
- `post{glowPass,noise}`
- `audio{music,bpm}`

To create a new style: copy the closest one, change the fields, then run `--qa-only` and look at the contact sheet.

A style JSON with `"deprecated": "<reason>"` is blocked: the gsap engine throws and the render fails.

## Product demo styles (`"template": "demo"`)

| id | Look | Audio |
|---|---|---|
| soft-depth | Browser window floating in soft light, one continuous camera take with tilt and parallax, curved cursor, spotlights, frosted caption cards | minimal 104 |
| deep-brand | Same camera work on a deep backdrop lit by brand-colored glows: maximum contrast for a light interface, dark glass captions | executive 100 |

These styles hold neutral colors. A brand recolors them with `brand.json → demoColors`, where `"@name"` reads `palette.name`:

```json
"demoColors": { "bg": "@paper", "glows": ["@lime", "@terracotta", "@sage"], "accent": "@forest", "accentText": "@lime" }
```

A brand that dresses more than one style keys the block by style name: `"demoColors": { "soft-depth": {...}, "deep-brand": {...} }`. `kicker` colors the small line above the headline (defaults to `accent`).

A plan can override any color the same way with `"colors"`. The motion vocabulary (camera, cursor, eases, word reveals) lives in `engines/gsap/lib/motion.js` and is shared by every template that imports it.
