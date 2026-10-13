# Styles
Each `*.json` is a visual "recipe" that the template reads (`plan.style`). If the plan doesn't set one, the default is dark-glow (dark theme) or light-corporate (light theme).

| id | Look | Audio |
|---|---|---|
| dark-glow | Dark, glow, rise-blur letters, serif keyword | cinematic 120 |
| light-corporate | Light background, clean, soft motion | corporate 116 |
| kinetic-type | Anton uppercase, flat colors cycling per scene, slam, panel-wipe, hard shadow | punchy 124 |
| editorial-grid | Paper with grid, Fraunces + DM Mono, wipe, left aligned | minimal 100 |
| playful-sticker | Fredoka, confetti in brand colors, sticker words, elastic pop | playful 118 |

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
