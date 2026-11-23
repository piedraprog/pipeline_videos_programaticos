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

## Runbook: product demo (`"template": "demo"`)

A 16:9 walkthrough of a desktop web app: the product sits in a browser window and one camera take travels across it. Example: `plans/form-product-demo.json` (fictional FORM store). Template `engines/gsap/demo.html`, style `soft-depth`, motion kit `engines/gsap/lib/motion.js`.

1. **Capture** the screens with the regular capture stage at a desktop viewport (`plans/form-desktop-capture.json`). Give every element the camera, cursor or spotlight will visit a name in the screenshot's `"boxes"`. Copy the PNGs and `*.boxes.json` into the brand kit's `shots/`. Captures are 2x, so the camera can zoom to about 1.85 without softening.
2. **Story** (`plan.story`): `intro` and `outro` (`title`, `subtitle`, `duration`), `screens` (`id`, `image`, `boxes`, `url`), and `beats`. A beat has `screen`, `duration`, optional `title`/`caption` (the caption card), and four tracks whose `at` is seconds from the start of the beat:
   - `camera`: `{at, focus, fill, tilt:[x,y], duration, dip}`. `focus` is a box name or `"full"`. `fill` is the share of the frame the box should occupy. `dip` (0.1-0.2) pulls the zoom back mid-move; use it for a long pan between two close-ups.
   - `cursor`: `{at, to, anchor:[x,y], duration, click}`. The click lands when the move ends.
   - `highlight`: `{at, box, label, duration}`. Dims the rest of the page.
   - `scroll`: `{at, to, duration}` for full-page captures; `to` is a box name or a page y.
3. **Choreography rules.** Do not move everything at once: camera first, then the caption, then the cursor. End a beat with a click and switch screen on the next beat so the change has a cause. Leave at least 1.2 s of hold after the camera settles. Alternate the tilt sign between beats; keep it within ±6 degrees while text must be read. Never overlap two camera moves in time.
4. **Motion blur.** `"fps": 240, "outFps": 30, "shutter": 180` renders 8 sub-frames per output frame and averages the 4 inside the open shutter. Use `"fps": 60` without `shutter` for fast drafts.
5. **Render cost.** Capture is the slow stage, and three things keep it down:
   - Frames are cached per scene in `<output>/frame-cache/`. Editing one scene re-captures that scene and the one before it; editing narration, music or volume re-captures nothing. `--fresh` ignores the cache.
   - A still frame is captured once instead of once per blur sample. The template reports motion through `window.isMoving(t)`; a template without it gets every sample captured.
   - Four capture pages is the measured optimum (`--workers=N` overrides). More pages are slower because they share one GPU process.
   - `"supersample": 2` captures at twice the resolution and scales down for sharper text, at roughly 3.5x the capture time; `"crf"` sets the compression (default 17, lower is better). Iterate without them and add them for the final render.
6. **Run** `--qa-only`, read the contact sheet, then render. Then extract frames around every camera move and screen change and look at them; a passing QA does not prove the motion reads well.

## Runbook: draft narration (`bun run voice`)

Synthetic voice is allowed only as an internal draft (see Delivery rules). It never replaces the recorded voice in a delivered piece.

1. Keys live in `.env` (copy `.env.example`; git-ignored): `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`. Never paste a key into a plan, a commit or the chat.
2. Write one `say` line per scene in the plan (`story.intro.say`, `story.beats[].say`, `story.outro.say`) and a `voice` block: `{"provider": "elevenlabs", "elevenlabs": {"voiceId": "..."}, "openai": {"voiceId": "cedar", "instructions": "..."}}`. `bun run voice -- --list-voices` prints the ElevenLabs voices of the account.
3. Check the timing before the full render: `bun run render -- <plan>.json --qa-only`, then `bun run voice -- <plan>.json --check` synthesizes the lines and reports whether each one fits. Each line starts 0.4 s into its scene and may keep talking over the silent beats that follow; the command fails if it would run into the next narrated scene. Then render and run `bun run voice -- <plan>.json [--provider=openai]`.
4. Output: `<output>/<name>-voz-<provider>.mp4` (voice over ducked music, video untouched) and `marcas-de-tiempo.txt`. Audio is cached per line in `<output>/voice/`, so rerunning costs nothing unless the text or voice changed.
5. Music: `"musicFile": "<path>"` in the plan uses that track instead of the synthesized bed (looped or cut to length, faded in and out). Keep licensed or client tracks under `private/`. `bun run voice` rebuilds the music on every run, so changing `musicFile` or `music` does not need a new picture render. The `executive` bed has no cut accents.
6. `voice.pronounce` maps a written word to how it should be said (`{"SAP": "sap"}` reads the acronym as a word); on-screen copy and the timestamps keep the written form. `voice.musicVolume` sets the music level under the voice (default 0.75). A track shorter than the piece is repeated with a crossfade.
7. The narration goes through the same forbidden-messaging gate as on-screen copy. OpenAI's usage policy requires telling listeners the voice is AI-generated.

## Public repository: private work goes in `private/`

- This repository is public. Anything for a client or an unreleased product (brand kit, plan, screenshots, copy, renders) goes under `private/` (`private/brands/<client>/`, `private/plans/<name>.json`, output `private/projects/<name>`). It is git-ignored. Never create those files under `brands/`, `plans/` or `demos/`.
- Engine code, styles and templates stay generic. Do not hardcode a client name, client copy, a real phone number or a real email in `engines/`, `styles/`, `src/`, `templates/` or `tests/`; read them from the plan or brand kit. Use placeholders such as `+58 400-0000000` in public examples.
- `scripts/privacy-check.ts` runs on commit, on push and in CI. Do not bypass it with `--no-verify`. A new public brand needs an explicit entry in `privacy.config.json → publicBrands` and the owner's permission.
- Before the first private project on a machine, check that `.private-terms` exists and lists the client and project names.

## Delivery rules (Jose, 2026-10-14)
- La locución final la graba Jose. Do not deliver a piece with synthetic voice. Exception (Jose, 2026-11-23): `bun run voice` may synthesize a draft narration for internal review; its file is named `-voz-<provider>` and is never the deliverable. For VO-led pieces deliver the no-voice version (music bed optional) timed to the script, plus a phrase-timestamps .txt as a guide.
- Videos are delivered without intro or outro. Bumpers (`bun run bumper`) are separate assets; Jose adds them in post. Do not concatenate bumpers or use an `outro` scene at the end of a piece; end cleanly on the last content scene with the music faded out.
- Style `playful-sticker` is deprecated/not allowed.
