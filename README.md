# Web-to-video demo pipeline

Create vertical product demos from real browser interactions. A JSON plan drives Playwright capture; Remotion composes the screenshots into a 1080×1920 MP4. Editorial mode supports independently scheduled background, graphics, logo, text and phone layers, with frame-driven depth entrances and accelerated screen transitions at 60 fps. Each project is stored in its own folder; there is no database. Audio and voice-over are out of scope.

## Requirements

- Bun 1.3+ for scripts and rendering
- Node.js 24+ for Playwright capture (important on Windows)
- Network access to install dependencies/Chromium or visit a remote website. The FORM demo uses bundled assets and needs no network during capture/render.

## Fastest path: run the included demo

From the repository root:

```bash
bun install
bunx playwright install chromium
bun run demo
```

The render is `projects/studio-store/output.mp4`: 1080×1920, 60 fps, 720 frames (12 seconds). Five captured states show catalog → product → added to bag → cart → simulated confirmation. No payment is made. Stock decreases only on checkout; reload resets the in-memory store. Open `demos/studio-store/index.html` directly in a browser to try it manually; no server is required.

Run the stages independently to inspect or correct a capture:

```bash
bun run capture -- plans/studio-store.json
bun run render -- studio-store
```

Capture must finish successfully first and produce a manifest. Rendering never performs browser interaction or creates missing screenshots. The older remote example remains available as `plans/ecommerce-purchase.json` (30 fps, classic motion).

### Visual direction

FORM uses an editorial product-store aesthetic: forest green, warm paper, acid-lime accents and terracotta, local Manrope typography, and original SVG illustrations. The anchor is an oversized catalog headline with an offset lime seal, not a generic gradient landing page. Design feasibility/impact rubric: 13/15 (subjective design assessment, not a benchmark). Typography, 8-pixel spacing rhythm and geometric backplates connect the store and video.

## Make a simple demo manually

1. Copy `plans/studio-store.json` to `plans/my-demo.json`.
2. Edit `projectName`, `baseUrl`, the visual options, and scenes. Use lowercase letters/numbers/hyphens for project and scene IDs. Give each scene a title/caption and enough duration to read the screen (typically 120–180 frames at 60 fps). Set `fps: 60` and `visual.motionStyle: "editorial"` for the new layer; old plans default to classic motion.
3. List the browser actions in the exact order they should happen. Each scene must include exactly one screenshot. For asynchronous pages, add a `waitFor` action for the real content before capture; navigation completion alone is not proof that data loaded.
4. Capture and inspect the screenshots/manifest:

   ```bash
   bun run capture -- plans/my-demo.json
   ```

   Review `projects/my-demo/assets/` and `projects/my-demo/manifest.json`. If capture fails, correct the URL, action order, or selector in the plan and rerun capture.
5. Render and verify the output:

   ```bash
   bun run render -- my-demo
   ```

   Confirm `projects/my-demo/output.mp4` exists and plays. Do not treat a partial capture, a manifest alone, or a successful typecheck as a completed video.

## Plan format

```json
{
  "projectName": "my-demo",
  "title": "Product name",
  "subtitle": "A short opening line",
  "visual": { "accentColor": "#67e8c1", "backgroundStyle": "aurora" },
  "baseUrl": "https://example.com/",
  "viewport": { "width": 390, "height": 844 },
  "fps": 30,
  "scenes": [
    {
      "id": "home",
      "title": "Explore the experience",
      "caption": "Optional concise supporting line.",
      "durationFrames": 90,
      "actions": [
        { "type": "navigate", "url": "https://example.com/" },
        { "type": "screenshot" }
      ]
    },
    {
      "id": "features",
      "title": "See the key features",
      "durationFrames": 90,
      "actions": [
        { "type": "scroll", "selector": "#features" },
        { "type": "screenshot", "selector": "#features" }
      ]
    }
  ]
}
```

`title`, `subtitle`, and `visual` are optional; defaults come from Zod. `backgroundStyle` is `aurora`, `midnight`, or `warm`; `accentColor` is a six-digit hex color. `motionStyle` is `classic` (default) or `editorial`. Scene `title` and `caption` are optional. Durations are frames: 90 frames at 30 fps = 180 frames at 60 fps = 3 seconds. Output remains vertical 1080×1920 regardless of capture viewport.

`baseUrl` and `navigate.url` accept URLs or explicit `./` / `../` local paths, resolved **relative to the input plan**, not the working directory. The local example uses `../demos/studio-store/index.html`. Generated `projects/<name>/plan.json` contains resolved machine-specific file URLs; copy the original source plan instead.

Supported actions: `navigate` with `url`, `click` with `selector`, `scroll` with `selector`, `waitFor` with `selector` and optional `text`, and `screenshot` with an optional `selector` (omitted means viewport screenshot). Screenshots wait for visible images and fonts, disable CSS animation, and are contained rather than cropped inside the phone. Use a mobile viewport such as 390×844 for legibility; desktop captures will remain desktop layouts. A failed recapture removes the old manifest so stale scenes cannot accidentally render. Each scene must have exactly one screenshot action. `waitFor` accepts `selector` and optional `text` and fails after 10 seconds if content is not visible. A `click` may declare `dialog: { "message": "Product added" }`; capture waits for, validates, and accepts that dialog before continuing. The authoritative schemas and defaults are in `src/schema.ts`.

## What the renderer does

- **Legacy editorial (when `visual.layers` is absent):** word-stagger reveals (~0.34 s), coordinated caption/rule entrance, short header exit, and a 0.55 s device entrance with restrained settling. At each scene change the device and geometric backplate reposition in 0.4–0.45 s, then hold still for reading. No perpetual drift or particle loop.
- **Editorial transitions:** alternating horizontal/vertical screen slides with acceleration/deceleration. Overlap is 0.35 s (21 frames at 60 fps), bounded by neighboring durations. FORM has 684 source frames minus four 21-frame overlaps = 600 screen frames; a 90-frame intro delay and a 30-frame ending hold make 720 composition frames.
- **Classic:** preserves the original palette/gradient, stable phone, subtle shapes and cubic slide. Its 0.6 s overlap scales with FPS: 18 frames at 30 fps, 36 at 60 fps. Short scenes remain safely bounded.
- Motion uses Remotion's frame clock or the official `@remotion/gsap` paused-timeline adapter. No free-running animation clock, CSS animation, timers, callbacks, or uncontrolled randomness. The bundled editorial font is awaited before rendering frames.

**Capture is not video recording.** These are real browser interactions captured at discrete states, with motion-graphics transitions added afterwards. 60 fps means 60 animation samples per second, not continuous scroll/click footage or optical-flow interpolation of static PNGs. Continuous interface movement would require a separate video source; this implementation does not claim that capability.

Edit `templates/LayeredReel.tsx` for configurable layers, `templates/EditorialReel.tsx` for legacy editorial styling, `templates/AgnosticReel.tsx` for classic, and `templates/timing.ts` for shared timing. Validate new inputs in `src/schema.ts` and propagate through capture. Keep UI legible and use `<Img>` / `staticFile()` for captured assets. Express motion in seconds × FPS, not fixed 30 fps frame counts.

Bundled Manrope is distributed under SIL OFL; see `demos/studio-store/fonts/OFL.txt`. The store and SVG products are authored for this example. No code/assets from the unlicensed Remotion trailer were copied.

## Independent layers and choreography

The FORM example uses `visual.layers`; removing that field preserves the old editorial/classic output. Layers require `motionStyle: "editorial"`. They share one frame clock, but **screen changes never trigger the other layers**. The demo begins with FORM alone, reveals the phone from perceived depth at 0.8 s, starts screen playback at 1.5 s and reveals the first headline at 1.65 s. The phone then stays settled; the backplate has its own unrelated cue. This is 2.5D perspective/scale, not a Three.js scene.

`durationSeconds` is the complete composition, including intro/outro. `screenStartSeconds` delays the screenshot timeline without shortening the first scene. The first screenshot is already inside the phone during its entrance; it does not reveal a blank screen. The final screenshot holds through the ending. Screenshot durations remain `durationFrames`, with 0.35 s overlaps.

Each track has an `id`, `type`, absolute `start` and `duration` in **seconds**, and integer `zIndex`. Larger zIndex is in front; array order breaks ties. Each layer has its own stacking context; the subject groups the phone and its clipped screen. No parent transform couples text/background/subject.

Supported types:
- `background`: required hex `color`, optional `pattern: "none" | "grid"`. Static without keyframes; animate its transform/opacity explicitly if desired.
- `graphic` / `foreground`: hex `color`, `shape: "disc" | "ring" | "slash"`. Type communicates intent; zIndex determines actual order.
- `subject`: exactly one phone/screen group; it must cover the delayed screen timeline.
- `text` / `logo`: text content, hex `color`, optional `fontSize` and `align`. Logo currently means a typographic mark, not an imported image.

All tracks accept `x`, `y` (top-left output pixels), `width`, `height`, `z` (perspective depth), `scale`, `opacity`, `rotation`, `rotateX` and `keyframes`. Defaults: position/depth/rotations 0, scale/opacity 1; subject size 610×1300, background 1080×1920, copy width 896. Set subject position explicitly (FORM uses x235/y450). Keyframe `time` is **relative to that layer's start**, in seconds. Omitted pose properties carry forward from the preceding keyframe/base pose. Destination `ease` is `linear`, `smooth`, `snappy` or `settle`; settle adds a small overshoot to spatial values, while opacity is clamped. Holds need no per-frame keys.

Example subject track (inside `visual.layers.tracks`):

```json
{
  "id": "phone", "type": "subject", "start": 0.8, "duration": 11.2,
  "x": 235, "y": 450, "width": 610, "height": 1300, "zIndex": 10,
  "keyframes": [
    { "time": 0, "z": -950, "scale": 0.64, "opacity": 0, "rotateX": 18 },
    { "time": 0.65, "z": 0, "scale": 1, "opacity": 1, "rotateX": 0, "ease": "settle" }
  ]
}
```

Copy `plans/studio-store.json` for a complete working layer arrangement. Schedule logo, subject, headline and caption separately; do not assign all of them the same start simply because a screenshot changes. Every track and keyframe must fit inside the composition. Zod rejects duplicate IDs, unknown fields/types, invalid ranges, unsorted keys, a cropped screen timeline and layers combined with classic mode. No arbitrary JavaScript, CSS animation or GSAP expression is accepted from JSON.

### Iterate without recapturing

For **visual-only** experiments, edit `visual.layers` in `projects/studio-store/manifest.json` and run `bun run render -- studio-store`. Keep projectName, fps, scene IDs/durations and asset paths intact. Persist the same visual configuration back into the source `plans/studio-store.json` when accepted: the next capture regenerates the manifest and overwrites manual manifest edits. If the website, actions, screenshot content, scene durations or FPS change, recapture from the source plan.

Agent direction example: “Keep screenshots and purchase flow intact. Give the logo a 0.7 s solo hold, reveal the subject from depth, show the first headline after the subject settles, and keep background cues independent of screen transitions. Set a reading hold after every entrance. Validate the layer clock, render, and inspect opening/settled/transition/end frames.”

## Agent checklist

See `AGENTS.md`. Agents must read the current schema and example plan, use selectors/actions supported by the schema, run capture before render, verify screenshots and manifest, and check the non-empty playable MP4 before claiming completion.

## Troubleshooting

- **Chromium launch timeout on Windows:** check `node --version` (24+) and run `bunx playwright install chromium`. Capture is launched by Bun but executed by Node because Chromium previously timed out when launched directly under Bun in this environment.
- **Selector missing/not visible:** inspect the current target page, selector, prior scene actions, and whether content is inside a frame or loads asynchronously. The capture error identifies the scene and selector.
- **Manifest missing:** capture did not finish. Fix the capture error first; render deliberately refuses to run without a valid manifest.
- **Screenshot asset missing:** verify manifest paths are repository-root relative and the expected PNG exists in `projects/<projectName>/assets/`.
- **Render looks unchanged:** rerun capture if the source website should have changed, then inspect the new PNGs and manifest before rendering again.
- **Output is not playable:** verify the render process completed successfully and the MP4 is non-empty; retry only after checking the underlying asset or render error.

## Regression checks

```bash
bun test
bunx tsc --noEmit
```

Tests cover FPS-normalized timing, editorial settings, local paths, mobile defaults, screenshot counts, readiness/confirmation failures, and a real demo purchase/stock update. Browser tests use Node/Playwright and require installed Chromium. Tests do not replace PNG inspection and MP4 playback.

## GSAP engine (brand videos + bumpers)

```bash
bun run setup                                            # deps, Chromium, ffmpeg (ffmpeg-static), Python numpy/pillow
bun run render -- plans/selltly-9x16-light.json --qa-only  # QA gates + contact sheet
bun run render -- plans/selltly-9x16-light.json            # full render -> projects/selltly-9x16-light/
bun run render -- plans/selltly-9x16.json --motion-check
bun run bumper -- brands/selltly/brand.json projects/bumpers-selltly intro:A:9x16:dark
bun test
```

`bun run render` picks the engine: a plan with `"engine":"gsap"` goes to `engines/gsap/`; a project name renders with Remotion as before.
Brand kits live in `brands/`, styles in `styles/`, and the modular authoring prompt is in `PROMPT.md`. The agent runbook is in `AGENTS.md`.
