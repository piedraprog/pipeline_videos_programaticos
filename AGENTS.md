# Agent instructions

## Product boundaries

- This is a filesystem-based web-to-video CLI with two engines: **remotion** (capture manifest → `templates/`, silent) and **gsap** (`engines/gsap/`: brand kit + style + story plans, 60fps seek capture, synthesized music/SFX). Do not add a database or voice-over unless the user explicitly changes scope. The no-audio rules below apply to the Remotion engine only.
- A project starts from `plans/<plan-file>.json`; generated files live at `projects/<projectName>/` (`plan.json`, `manifest.json`, `assets/`, `output.mp4`).
- `src/schema.ts` is authoritative for all plan, action, visual-config, and manifest fields. Do not invent action names, selectors, or configuration fields.
- Capture and render are separate stages. Capture performs real browser actions; render requires a complete valid manifest and referenced screenshots.

## Creating a demo

1. Read `src/schema.ts`, `plans/ecommerce-purchase.json`, and the relevant README section before authoring a plan.
2. Create a self-contained `plans/<project>.json`: unique lowercase hyphenated project/scene IDs, valid URL, reasonable viewport/fps, optional headline/subtitle and visual theme, readable scene titles/captions, ordered supported actions, and a screenshot action in every scene. Check that selectors should be visible after preceding actions.
3. Keep scene duration long enough to read its contents (usually 120–180 frames at 60 fps). For editorial motion set `fps: 60` and `visual.motionStyle: "editorial"`; classic defaults preserve old plans. Overlaps reduce final duration (editorial 0.35 seconds, classic 0.6 seconds; capped for short scenes).
4. Run `bun run capture -- plans/<project>.json` and wait for a successful exit. On failure, use the named scene/action/selector to fix the plan; do not claim success from partial screenshots.
5. Confirm `projects/<projectName>/manifest.json` exists, parses against `ManifestSchema`, and lists expected assets; inspect the PNG files.
6. Run `bun run render -- <projectName>` and wait for successful completion.
7. Confirm `projects/<projectName>/output.mp4` exists, is non-empty, and can be opened/played. Clearly distinguish code/type checks, capture, and render evidence.

## Rendering and determinism

- Keep output vertical 1080×1920 and preserve captured UI legibility; decorative backgrounds and motion must remain subordinate.
- Derive all motion from `useCurrentFrame()` / composition fps or the official `@remotion/gsap` `useGsapTimeline()` adapter. Never use CSS animations/transitions, timers, wall-clock time, or uncontrolled randomness.
- For GSAP, add tweens only to the hook-provided paused timeline and only target DOM/SVG descendants scoped by its returned ref. The adapter seeks the timeline per Remotion frame. Do not play/resume/restart/reverse/seek/progress/time it; do not use callbacks, `timeline.call()`, async builders, `Math.random()`, `repeatRefresh`, free-running `gsap.to()`, or unsupported interactive plugins such as ScrollTrigger/Draggable.
- Keep GSAP timelines small; derive scalar values/background motion with Remotion when that is simpler. Use `<Img>` with `staticFile()` for local screenshots.
- Do not change the output format, capture runtime, dependencies, or project path semantics without verifying effects in both scripts. Keep all Remotion packages aligned to the same exact version.
- No audio or voice-over in this pipeline phase.

## Commands

```bash
bun install
bunx playwright install chromium
bun run demo
# Or inspect before rendering:
bun run capture -- plans/studio-store.json
bun run render -- studio-store
# Older remote/classic example:
bun run capture -- plans/ecommerce-purchase.json
bun run render -- ecommerce-purchase
```

Capture requires Node.js 24+ and uses Node under Bun to avoid the observed Chromium launch timeout on Windows. See `README.md` for manual authoring, plan schema overview, output checks, animation customization, and troubleshooting.

## Local demo and truthful motion claims

- `demos/studio-store/index.html` is a fictional self-contained catalog/cart/checkout. It works via `file://`; there is no server, backend or real payment. Stock updates on simulated checkout and resets on reload.
- Explicit `./` / `../` page paths resolve relative to the input plan, not cwd. Generated normalized plans contain machine-specific file URLs and are not portable source plans.
- Screenshots are discrete browser states. Do not claim that 60 fps motion-graphics transitions are continuous web interaction recordings or optical-flow interpolation.
- Editorial uses bundled/awaited typography and scene-beat choreography with reading holds. Keep timings in seconds multiplied by FPS.

## Capture readiness and visual QA

- Every scene has exactly one screenshot. Use explicit `waitFor` selectors/text for loaded application data, not arbitrary sleep delays.
- For actions producing a confirmation dialog, declare `click.dialog.message`; do not navigate before the confirmation completes.
- Inspect actual captured product/catalog/cart content, not just file existence. A successful render can still faithfully render an empty page.
- Prefer 390×844 mobile captures for the phone frame. Inspect first frame, settled scenes, transition midpoints, and final frame; never claim visual quality from typecheck alone.

## Independent layers

- `visual.layers` requires editorial mode; absence preserves old behavior. Read `LayerSchema` / `LayersSchema` in `src/schema.ts` before creating tracks; no invented fields or arbitrary animation code.
- Schedule logo, background/graphics, subject, copy and optional foreground independently. Do not tie every entrance to scene boundaries. The subject is one phone+clipped-screen group; text must not inherit its transform.
- Timing: global `durationSeconds`, delayed `screenStartSeconds`, track `start`/`duration` and local keyframe `time` are seconds. Screenshot scene durations remain frames. Include all overlap-adjusted screen time in the composition; the subject must cover it.
- Depth is deterministic 2.5D perspective/scale, not real 3D. Logo tracks currently support text marks. zIndex explicitly controls stacking; higher values are in front, equal values preserve array order.
- Follow the FORM solo-logo → depth-reveal phone → later text example; leave the settled UI readable. Author opacity keys for intentional entrances/exits rather than sudden unmounts.
- Visual-only render iterations may edit manifest.visual.layers without recapturing. Preserve source/fps/scene/asset fields, mirror accepted visuals to the source plan, and remember capture replaces manual manifest changes. Website/action/scene duration/FPS changes require capture.
- QA the solo-logo hold, phone depth entrance (first screenshot visible), delayed title, settled content, screen overlap midpoint and final hold. Passing schema/type tests alone does not prove visual quality.

## Runbook: GSAP engine (brand videos, bumpers)

Setup once per machine (Linux box or Windows): `bun run setup`. It checks Node >= 24, runs `bun install` (includes `ffmpeg-static`), installs Playwright Chromium, and installs Python numpy/pillow from `requirements.txt`. Overrides: `FFMPEG=<path>`, `PYTHON=<exe>`. It says FAIL clearly if something is missing.

Layout (everything shared, nothing in side folders):
- `brands/<brand>/`:
  - `brand.json`: palette, themes, logo/isotype, `messaging{tagline,ctas,claims,offer,forbidden}`, `bumper{introDuration,outroDuration}`.
  - `messaging.md`: copy with source citations.
  - `shots/`: stock walkthrough captures (store/admin) + `boxes.json`.
- `styles/<id>.json`: visual recipes (see `styles/README.md`). Turning a reference video into a style: `references/README.md`.
- `plans/<name>.json` with `"engine":"gsap"`: brand + style + format + scenes (story). The modular prompt for authoring one is in `PROMPT.md`.
- `engines/gsap/`:
  - `index.html` (pieces) and `bumper.html` (intro/outro).
  - `tools/`: render, bumper, music, sfx, QA.
- Outputs go to `projects/<name>/` (mp4, `contact-sheet.png`, `qa/`, `meta.json`). GSAP outputs and frames are gitignored.

New video for any brand:
1. **Brand kit:** copy `brands/selltly` as a template. Fill in palette/themes/logo. Vectorize the logo with `bun run vectorize-logo` (needs `pip install potracer`).
2. **Messaging:** write `messaging.md` only from the brand's own sources, and cite them. Put the real CTAs and claims in `brand.json → messaging`. List anything the brand does not offer in `forbidden` (e.g. "gratis" when there is no free plan). The render fails if forbidden copy appears (accent-insensitive). Never invent prices or promotions.
3. **Style:** set `"style"` to dark-glow | light-corporate | kinetic-type | editorial-grid (playful-sticker is deprecated), or a new one in `styles/`.
4. **Story:** a hook, 2–4 device beats over `brands/<b>/shots/*`, short phrases, and a real CTA as the last content beat (no outro scene; bumpers are separate assets). Spanish copy uses neutral tú. No step counters.
5. **Format:** `"format"` 9x16 | 16x9 | 1x1.
6. **Run:**
   - `bun run render -- plans/<name>.json --qa-only`. Fix every QA FAIL, then open `projects/<name>/contact-sheet.png`.
   - `bun run render -- plans/<name>.json --motion-check` to look for jumps at cuts.
   - `bun run render -- plans/<name>.json` for the final mp4.

Stock walkthroughs (store/admin): capture them with the regular capture stage. A screenshot action can declare `"boxes": {"name": "<selector>"}`; capture then writes `projects/<p>/assets/<scene>.boxes.json` (CSS px relative to the screenshot) for zooms and taps. Copy the PNGs and boxes into `brands/<b>/shots/`. Only read storefront/admin pages; never place orders or change admin data.

Bumpers: `bun run bumper -- brands/<b>/brand.json projects/bumpers-<b> intro:A:9x16:dark outro:B:16x9:light [--qa-only]`
- Variants: A fly-in, B draw + pop, C orbit + snap, D gooey split.
- Intro default length is 3.5 s; change it via `brand.json → bumper.introDuration` or `?duration=`.
- Outros end on the brand's real CTA.

QA gates (all must pass before claiming success):
- QA checks: safe area, text overflow, letters clipped by masks, forbidden messaging, `--motion-check` spikes.
- Then inspect the contact sheet and frames yourself. A passing exit code is not visual proof.
- `bun test` must stay green; it needs Node >= 24.

## Delivery rules (Jose, 2026-10-14)
- No se genera voice over/TTS; la locución la graba Jose. Do not synthesize or mux any voice. For VO-led pieces deliver the no-voice version (music bed optional) timed to the script, plus a phrase-timestamps .txt as a guide.
- Videos are delivered without intro or outro. Bumpers (`bun run bumper`) are separate assets; Jose adds them in post. Do not concatenate bumpers or use an `outro` scene at the end of a piece; end cleanly on the last content scene with the music faded out.
- Style `playful-sticker` is deprecated/not allowed.
