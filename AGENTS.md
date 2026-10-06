# Agent instructions

## Product boundaries

- This is a filesystem-based web-to-video CLI. Do not add a database or audio/voice-over behavior unless the user explicitly changes scope.
- A project starts from `plans/<plan-file>.json`; generated files live at `projects/<projectName>/` (`plan.json`, `manifest.json`, `assets/`, `output.mp4`).
- `src/schema.ts` is authoritative for all plan, action, visual-config, and manifest fields. Do not invent action names, selectors, or configuration fields.
- Capture and render are separate stages. Capture performs real browser actions; render requires a complete valid manifest and referenced screenshots.

## Creating a demo

1. Read `src/schema.ts`, `plans/ecommerce-purchase.json`, and the relevant README section before authoring a plan.
2. Create a self-contained `plans/<project>.json`: unique lowercase hyphenated project/scene IDs, valid URL, reasonable viewport/fps, optional headline/subtitle and visual theme, readable scene titles/captions, ordered supported actions, and a screenshot action in every scene. Check that selectors should be visible after preceding actions.
3. Keep scene duration long enough to read its contents (usually 75–120 frames at 30 fps). Transitions overlap and reduce final duration.
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
bun run capture -- plans/ecommerce-purchase.json
bun run render -- ecommerce-purchase
```

Capture requires Node.js 24+ and uses Node under Bun to avoid the observed Chromium launch timeout on Windows. See `README.md` for manual authoring, plan schema overview, output checks, animation customization, and troubleshooting.

## Capture readiness and visual QA

- Every scene has exactly one screenshot. Use explicit `waitFor` selectors/text for loaded application data, not arbitrary sleep delays.
- For actions producing a confirmation dialog, declare `click.dialog.message`; do not navigate before the confirmation completes.
- Inspect actual captured product/catalog/cart content, not just file existence. A successful render can still faithfully render an empty page.
- Prefer 390�844 mobile captures for the phone frame. Inspect first frame, settled scenes, transition midpoints, and final frame; never claim visual quality from typecheck alone.
