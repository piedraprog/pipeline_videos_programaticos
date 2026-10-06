# Agent instructions

## Product boundaries

- This is a filesystem-based web-to-video CLI. Do not add a database or audio/voice-over behavior unless the user explicitly changes scope.
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
