import { chromium, type Page } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VideoPlanSchema, type VideoManifest } from './schema.ts';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensureSelector(page: Page, selector: string, sceneId: string): Promise<ReturnType<Page['locator']>> {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 10_000 });
  } catch (error) {
    throw new Error(`Scene "${sceneId}": selector "${selector}" was not found or did not become visible within 10 seconds. Check the selector and page state. ${describeError(error)}`);
  }
  return locator;
}

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: bun run capture -- <plan.json>');
  const planPath = path.resolve(process.cwd(), input);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(planPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read plan at ${planPath}: ${describeError(error)}`);
  }
  const parsed = VideoPlanSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid capture plan:\n${parsed.error.issues.map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n')}`);
  const plan = parsed.data;
  const projectDir = path.join(rootDir, 'projects', plan.projectName);
  const assetsDir = path.join(projectDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  await writeFile(path.join(projectDir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const platformHint = process.platform === 'win32'
      ? 'On Windows, run "bunx playwright install chromium" and ensure the installed browser matches the Playwright version.'
      : 'Run "bunx playwright install --with-deps chromium" in the target Linux environment.';
    throw new Error(`Could not launch headless Chromium. ${platformHint} Original error: ${describeError(error)}`);
  }

  const manifest: VideoManifest = {
    projectName: plan.projectName,
    title: plan.title,
    subtitle: plan.subtitle,
    visual: plan.visual,
    fps: plan.fps,
    width: 1080,
    height: 1920,
    scenes: [],
  };
  try {
    const context = await browser.newContext({
      viewport: { width: plan.viewport.width, height: plan.viewport.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(plan.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    for (const scene of plan.scenes) {
      let captured = false;
      for (const action of scene.actions) {
        try {
          switch (action.type) {
            case 'navigate':
              await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
              break;
            case 'click':
              await (await ensureSelector(page, action.selector, scene.id)).click({ timeout: 10_000 });
              break;
            case 'scroll':
              await (await ensureSelector(page, action.selector, scene.id)).scrollIntoViewIfNeeded({ timeout: 10_000 });
              break;
            case 'screenshot': {
              const filename = `${scene.id}.png`;
              const destination = path.join(assetsDir, filename);
              if (action.selector) {
                const element = await ensureSelector(page, action.selector, scene.id);
                await element.screenshot({ path: destination, type: 'png', scale: 'device' });
              } else {
                await page.screenshot({ path: destination, type: 'png', scale: 'device', fullPage: false });
              }
              manifest.scenes.push({
                id: scene.id,
                ...(scene.title ? { title: scene.title } : {}),
                ...(scene.caption ? { caption: scene.caption } : {}),
                asset: `projects/${plan.projectName}/assets/${filename}`,
                durationFrames: scene.durationFrames,
              });
              captured = true;
              break;
            }
          }
        } catch (error) {
          throw new Error(`Scene "${scene.id}" action "${action.type}" failed${'selector' in action && action.selector ? ` for selector "${action.selector}"` : ''}: ${describeError(error)}`);
        }
      }
      if (!captured) throw new Error(`Scene "${scene.id}" completed without producing a screenshot.`);
      console.log(`Captured ${scene.id}`);
    }
    await writeFile(path.join(projectDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Capture complete: ${path.relative(rootDir, projectDir)} (${manifest.scenes.length} scenes)`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Capture failed: ${describeError(error)}`);
  process.exitCode = 1;
});
