import { chromium, type Page } from 'playwright';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  if (!input) throw new Error('Usage: bun run capture -- <plan.json> [--viewport=WxH] [--project=<name>]');
  // CLI overrides let one plan capture several viewports (e.g. mobile for 9:16, desktop for 16:9).
  const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
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
  const vp = flag('viewport');
  if (vp) { const [w, h] = vp.split('x').map(Number); if (!w || !h) throw new Error('--viewport must look like 1440x900'); plan.viewport = { width: w, height: h }; }
  const projectOverride = flag('project');
  if (projectOverride) { if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(projectOverride)) throw new Error('--project must be lowercase-hyphenated'); plan.projectName = projectOverride; }
  const resolvePage = (location: string) => /^\.{1,2}\//.test(location)
    ? pathToFileURL(path.resolve(path.dirname(planPath), location)).href : location;
  plan.baseUrl = resolvePage(plan.baseUrl);
  for (const scene of plan.scenes) for (const action of scene.actions) {
    if (action.type === 'navigate') action.url = resolvePage(action.url);
  }
  const projectDir = path.join(rootDir, 'projects', plan.projectName);
  const assetsDir = path.join(projectDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  // A failed recapture must never leave a stale manifest eligible for rendering.
  await rm(path.join(projectDir, 'manifest.json'), { force: true });
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
    const sessionLoad = plan.session?.load ? path.join(rootDir, plan.session.load) : undefined;
    let storageState: string | undefined;
    if (sessionLoad) { try { await readFile(sessionLoad); storageState = sessionLoad; } catch { throw new Error(`Session ${plan.session!.load} not found. Run the plan that saves it first.`); } }
    const context = await browser.newContext({
      viewport: { width: plan.viewport.width, height: plan.viewport.height },
      deviceScaleFactor: 2,
      ...(storageState ? { storageState } : {}),
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
            case 'click': {
              // optional: dismiss-if-present UI (first-visit notices); skipped when absent after 3 s.
              if (action.optional && !(await page.locator(action.selector).first().waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false))) break;
              const element = await ensureSelector(page, action.selector, scene.id);
              if (action.dialog) {
                const dialogPromise = page.waitForEvent('dialog', { timeout: 10_000 }).then(async (dialog) => {
                  const message = dialog.message();
                  await dialog.accept();
                  if (!message.includes(action.dialog!.message)) throw new Error(`Expected dialog containing "${action.dialog!.message}", received "${message}".`);
                });
                await Promise.all([dialogPromise, element.click({ timeout: 10_000 })]);
              } else {
                await element.click({ timeout: 10_000 });
              }
              break;
            }
            case 'waitFor': {
              const element = action.text ? page.locator(action.selector).filter({ hasText: action.text }).first() : page.locator(action.selector).first();
              await element.waitFor({ state: 'visible', timeout: 10_000 });
              break;
            }
            case 'scroll':
              await (await ensureSelector(page, action.selector, scene.id)).evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
              break;
            case 'scrollTo': {
              const target = action.selector ? await (await ensureSelector(page, action.selector, scene.id)).evaluate((el) => el.getBoundingClientRect().top + scrollY - 80) : action.y ?? 0;
              await page.evaluate(([y, smooth]) => scrollTo({ top: y as number, behavior: smooth ? 'smooth' : 'instant' }), [target, action.smooth] as const);
              // Settle: same scroll position on consecutive animation frames.
              await page.waitForFunction(() => new Promise<boolean>((r) => { const a = scrollY; requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY === a))); }), undefined, { timeout: 10_000 });
              break;
            }
            case 'fill': {
              const value = action.valueEnv ? process.env[action.valueEnv] : action.value;
              if (value === undefined) throw new Error(`Environment variable ${action.valueEnv} is not set.`);
              const element = await ensureSelector(page, action.selector, scene.id);
              if (action.typeDelayMs) { await element.click(); await element.press('ControlOrMeta+A'); await element.pressSequentially(value, { delay: action.typeDelayMs }); }
              else await element.fill(value);
              break;
            }
            case 'press':
              await page.keyboard.press(action.key);
              break;
            case 'hover':
              await (await ensureSelector(page, action.selector, scene.id)).hover({ timeout: 10_000 });
              break;
            case 'css':
              await page.addStyleTag({ content: action.css });
              break;
            case 'screenshot': {
              await page.waitForFunction(() => document.fonts.status === 'loaded' && Array.from(document.images).every((image) => {
                const rect = image.getBoundingClientRect();
                const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
                return !visible || image.complete;
              }), undefined, { timeout: 10_000 });
              await page.evaluate(async () => {
                await Promise.all(Array.from(document.images).filter((image) => {
                  const rect = image.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
                }).map(async (image) => {
                  await image.decode();
                  if (image.naturalWidth === 0) throw new Error(`Visible image failed to load: ${image.currentSrc}`);
                }));
              });
              const filename = `${scene.id}.png`;
              const destination = path.join(assetsDir, filename);
              if (action.selector) {
                const element = await ensureSelector(page, action.selector, scene.id);
                await element.screenshot({ path: destination, type: 'png', scale: 'device', animations: 'disabled' });
              } else {
                if (action.fullPage) {
                  // Full-page capture (optionally capped) so the render can scroll through real page content.
                  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
                  const height = Math.min(pageHeight, action.maxHeight ?? 6000);
                  const y0 = await page.evaluate(() => scrollY);
                  // Lazy images: walk the captured range so every image inside it loads and decodes.
                  for (let y = 0; y < height; y += Math.round(plan.viewport.height * 0.8)) {
                    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
                    await page.waitForFunction(() => Array.from(document.images).every((image) => {
                      const r = image.getBoundingClientRect();
                      return !(r.width > 0 && r.bottom > -innerHeight && r.top < innerHeight * 2) || (image.complete && image.naturalWidth > 0);
                    }), undefined, { timeout: 15_000 }).catch(() => { throw new Error(`Images near y=${y} did not finish loading.`); });
                  }
                  await page.evaluate(async (h) => { await Promise.all(Array.from(document.images).filter((i) => i.getBoundingClientRect().top + scrollY < h && i.complete).map((i) => i.decode().catch(() => {}))); }, height);
                  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
                  await page.screenshot({ path: destination, type: 'png', scale: 'device', fullPage: true, clip: { x: 0, y: 0, width: plan.viewport.width, height }, animations: 'disabled' });
                  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y0);
                } else {
                  await page.screenshot({ path: destination, type: 'png', scale: 'device', fullPage: false, animations: 'disabled' });
                }
              }
              if (action.boxes) {
                // Element boxes (CSS px, relative to the screenshot) for the GSAP engine: zooms, highlights, tap targets.
                const boxes: Record<string, { x: number; y: number; width: number; height: number; text: string }> = {};
                const origin = action.selector ? await (await ensureSelector(page, action.selector, scene.id)).boundingBox() : { x: 0, y: 0 };
                // Full-page images are document-relative; viewport images are relative to the current scroll position.
                const scrollOffset = action.fullPage && !action.selector ? await page.evaluate(() => scrollY) : 0;
                for (const [name, selector] of Object.entries(action.boxes)) {
                  const element = page.locator(selector).first();
                  await element.waitFor({ state: 'attached', timeout: 10_000 });
                  const box = await element.boundingBox();
                  if (!box) throw new Error(`Scene "${scene.id}" box "${name}" (${selector}) has no layout box.`);
                  const text = (await element.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 160);
                  boxes[name] = { x: box.x - (origin?.x ?? 0), y: box.y + scrollOffset - (origin?.y ?? 0), width: box.width, height: box.height, text };
                }
                await writeFile(path.join(assetsDir, `${scene.id}.boxes.json`), JSON.stringify(boxes, null, 2));
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
    if (plan.session?.save) { await mkdir(path.join(rootDir, '.sessions'), { recursive: true }); await context.storageState({ path: path.join(rootDir, plan.session.save) }); }
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
