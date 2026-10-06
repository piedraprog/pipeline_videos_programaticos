# Deterministic web-to-video pipeline

Capture browser interactions from a validated JSON plan, then render the resulting screenshots into a vertical 1080×1920 MP4. Each project is a filesystem folder under `projects/`; no database is used.

## Setup

```bash
bun install
bunx playwright install chromium
```

Capture is orchestrated through the Bun CLI, but the capture process runs on Node.js 24+ because Playwright's Chromium subprocess launch currently times out under Bun on some Windows installations. Install Node.js 24 or newer and keep Bun installed; `bun run capture` forwards the plan arguments to Node. Rendering remains on Bun.

## Run

```bash
bun run capture -- plans/ecommerce-purchase.json
bun run render -- ecommerce-purchase
```

Capture writes a normalized `plan.json`, PNG assets, and `manifest.json` to `projects/<projectName>/`. Render writes `projects/<projectName>/output.mp4`. The Remotion renderer bundles the local composition and reads assets from the repository root.

## Plan format

Each scene has a stable ID, a frame duration, and ordered actions. Supported actions are `navigate` (`url`), `click` (`selector`), `scroll` (`selector`), and `screenshot` (optional `selector`; otherwise captures the viewport). Every scene must include a screenshot. Selectors must resolve to visible elements; failures include the scene and selector for quick correction. Example: `plans/ecommerce-purchase.json`.

The capture viewport defaults to 1080×1920 and screenshots use device scale for high-resolution PNGs. Chromium must be installed with Playwright before capture. No audio or voice-over is included.
