# Web-to-video demo pipeline

Create polished vertical product demos from real browser interactions. A JSON plan drives Playwright capture; Remotion turns the screenshots into a 1080×1920 MP4 with animated backgrounds, a phone frame, scene titles, progress, transitions, and a deterministic GSAP title timeline. Each project is stored in its own folder; there is no database. Audio and voice-over are out of scope.

## Requirements

- Bun 1.3+ for scripts and rendering
- Node.js 24+ for Playwright capture (important on Windows)
- Network access to install Chromium and visit the target website

## Fastest path: run the included demo

From the repository root:

```bash
bun install
bunx playwright install chromium
bun run capture -- plans/ecommerce-purchase.json
bun run render -- ecommerce-purchase
```

The render is `projects/ecommerce-purchase/output.mp4`. Capture must finish successfully first and produce a manifest. Rendering never performs browser interaction or creates missing screenshots.

## Make a simple demo manually

1. Copy `plans/ecommerce-purchase.json` to `plans/my-demo.json`.
2. Edit `projectName`, `baseUrl`, the visual options, and scenes. Use lowercase letters/numbers/hyphens for project and scene IDs. Give each scene a title/caption and enough duration to read the screen (typically 75–120 frames at 30 fps).
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

`title`, `subtitle`, and `visual` are optional; defaults are supplied by the Zod schema. `backgroundStyle` is `aurora`, `midnight`, or `warm`; `accentColor` must be a six-digit hex color. Scene `title` and `caption` are optional. Durations are frames, not seconds: at 30 fps, 90 frames is 3 seconds. The composition is vertical 1080×1920 regardless of the capture viewport.

Supported actions: `navigate` with `url`, `click` with `selector`, `scroll` with `selector`, `waitFor` with `selector` and optional `text`, and `screenshot` with an optional `selector` (omitted means viewport screenshot). Screenshots wait for visible images and fonts, disable CSS animation, and are contained rather than cropped inside the phone. Use a mobile viewport such as 390�844 for legibility; desktop captures will remain desktop layouts. A failed recapture removes the old manifest so stale scenes cannot accidentally render. Each scene must have exactly one screenshot action. `waitFor` accepts `selector` and optional `text` and fails after 10 seconds if content is not visible. A `click` may declare `dialog: { "message": "Product added" }`; capture waits for, validates, and accepts that dialog before continuing. The authoritative schemas and defaults are in `src/schema.ts`.

## What the renderer does

- Uses a restrained animated gradient background, with a stable palette and slow frame-derived glow movement; the captured website remains the focus.
- Presents each screenshot in a phone mockup with a title, optional caption, and scene progress marker.
- Keeps the background and phone frame stable; only screen contents slide, while headers switch without doubled text. Transition overlaps reduce total video duration by the overlap frames.
- Uses Remotion's frame clock for background motion. `@remotion/gsap` owns a paused timeline and seeks it to each requested frame for the title/rule entrance. There is no free-running animation clock, CSS animation, timer, callbacks, or uncontrolled randomness.

To change visual styling, edit `templates/AgnosticReel.tsx`; validate any new plan input in `src/schema.ts` and pass it through capture to the manifest. Keep motion subordinate to the screenshot and use Remotion's `<Img>` / `staticFile()` for captured assets.

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

Tests cover scene timing, mobile defaults, exactly one screenshot per scene, missing loaded content, and missing/unexpected add-to-cart confirmations. Browser contract tests use a local fixture server and require the installed Chromium.
