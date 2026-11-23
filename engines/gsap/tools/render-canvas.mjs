// Canvas renderer: one browser page draws each scene with WebGL and encodes it to H.264 itself.
// Usage: bun run render -- <plan>.json --renderer=canvas [--qa-only] [--fresh]
// Every scene is its own clip, cached by what it shows. The final video is the clips joined without
// re-encoding, so changing one scene re-renders one clip and changing audio re-renders none.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FF, PY } from './bin.mjs';
import { inputFingerprint, segmentKey } from './frames.mjs';
import { prepareMusic } from './music.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CODE_FILES = ['engines/gsap/demo-canvas.html', 'engines/gsap/lib/demoScene.js', 'engines/gsap/lib/gl.js', 'engines/gsap/lib/textSprite.js', 'engines/gsap/lib/motion.js'];
const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const BITRATE_PER_PIXEL = 3;
// H.264 quantizer for constant-quality encoding: lower is sharper and larger.
const DEFAULT_QUANTIZER = 22;

const seconds = (since) => ((Date.now() - since) / 1000).toFixed(1);

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function forbiddenCopy(copy, forbiddenWords) {
  const hits = [];
  for (const line of copy) {
    for (const word of forbiddenWords) {
      const escaped = normalize(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(normalize(line))) hits.push(`"${line}" contains forbidden "${word}"`);
    }
  }
  return hits;
}

// Static files for the page, plus one upload endpoint that appends encoded video to the clip being written.
function startServer(uploads) {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(request.url.split('?')[0]);
    if (request.method === 'POST' && pathname.startsWith('/clip/')) {
      const target = uploads.get(pathname.slice('/clip/'.length));
      if (!target) return response.writeHead(404).end();
      const parts = [];
      request.on('data', (part) => parts.push(part));
      request.on('end', () => {
        fs.appendFileSync(target, Buffer.concat(parts));
        response.writeHead(200).end();
      });
      return;
    }
    const file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  server.listen(0);
  return server;
}

async function main() {
  const planArg = process.argv[2];
  const qaOnly = process.argv.includes('--qa-only');
  const fresh = process.argv.includes('--fresh');
  if (!planArg) throw new Error('Usage: render-canvas.mjs <plan>.json [--qa-only] [--fresh]');
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, planArg), 'utf8'));
  const brand = plan.brand ? JSON.parse(fs.readFileSync(path.join(ROOT, plan.brand), 'utf8')) : {};
  const style = JSON.parse(fs.readFileSync(path.join(ROOT, `styles/${plan.style}.json`), 'utf8'));
  const outputDir = path.join(ROOT, plan.output);
  const name = path.basename(plan.output);
  const cacheDir = path.join(outputDir, 'clip-cache');
  fs.mkdirSync(path.join(outputDir, 'qa'), { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const uploads = new Map();
  const server = startServer(uploads);
  const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`http://localhost:${server.address().port}/engines/gsap/demo-canvas.html?plan=${encodeURIComponent(planArg)}`);
    await page.waitForFunction(() => window.ready !== undefined, null, { timeout: 60000 });
    await page.evaluate(() => window.ready).catch((error) => {
      throw new Error(`The page failed to load the plan: ${error.message}`);
    });
    const meta = await page.evaluate(() => window.meta);
    fs.writeFileSync(path.join(outputDir, 'meta.json'), JSON.stringify({ ...meta, segments: undefined }, null, 1));

    // ---- QA gates: messaging, text fit, and one still per scene for the contact sheet
    const qaStart = Date.now();
    const problems = [...forbiddenCopy(meta.copy, brand.messaging?.forbidden ?? []).map((hit) => `MESSAGING: ${hit}`), ...(await page.evaluate(() => window.qaIssues()))];
    const sheetArgs = [];
    for (const [index, time] of meta.qaTimes.entries()) {
      await page.evaluate((moment) => window.still(moment), time);
      const file = path.join(outputDir, 'qa', `scene-${index + 1}-${meta.scenes[index]}.png`);
      await page.locator('#frame').screenshot({ path: file });
      sheetArgs.push(file, `${index + 1} ${meta.scenes[index]} t=${time.toFixed(2)}s`);
    }
    execFileSync(PY, [path.join(ROOT, 'engines/gsap/tools/sheet.py'), path.join(outputDir, 'contact-sheet.png'), ...sheetArgs]);
    console.log(`STAGE qa: ${seconds(qaStart)}s, ${meta.qaTimes.length} stills`);
    if (problems.length > 0) {
      for (const problem of problems) console.log(`   - ${problem}`);
      throw new Error('QA failed: fix the plan before rendering.');
    }
    if (qaOnly) return;

    // ---- Clips: only the scenes whose inputs changed are rendered
    const renderStart = Date.now();
    const bitrate = plan.videoBitrate ?? Math.round(meta.W * meta.H * BITRATE_PER_PIXEL);
    const quantizer = plan.videoQuantizer ?? DEFAULT_QUANTIZER;
    const fingerprint = inputFingerprint({ root: ROOT, plan, brand, style, codeFiles: CODE_FILES, settings: { W: meta.W, H: meta.H, fps: meta.fps, outFps: meta.outFps, shutter: meta.shutter ?? null, bitrate, quantizer } });
    const clips = meta.segments.map((segment) => ({ segment, file: path.join(cacheDir, `${segmentKey(fingerprint, segment)}.h264`) }));
    const stale = clips.filter((clip) => fresh || !fs.existsSync(clip.file));
    let frames = 0;
    for (const clip of stale) {
      const key = path.basename(clip.file);
      const partial = `${clip.file}.partial`;
      fs.rmSync(partial, { force: true });
      uploads.set(key, partial);
      const index = meta.segments.indexOf(clip.segment);
      const result = await page.evaluate((options) => window.renderSegment(options), { index, uploadUrl: `/clip/${key}`, bitrate, quantizer, hardware: plan.hardwareEncoding ?? 'no-preference' });
      uploads.delete(key);
      if (pageErrors.length > 0) throw new Error(`Page error while rendering ${clip.segment.name}: ${pageErrors[0]}`);
      fs.renameSync(partial, clip.file);
      frames += result.frames;
    }
    const kept = new Set(clips.map((clip) => path.basename(clip.file)));
    for (const old of fs.readdirSync(cacheDir)) if (!kept.has(old)) fs.rmSync(path.join(cacheDir, old), { force: true });
    console.log(`STAGE clips: rendered ${stale.length} of ${clips.length} scenes (${frames} frames) in ${seconds(renderStart)}s`);

    // ---- Join: H.264 streams that each start on a keyframe concatenate byte for byte
    const joinStart = Date.now();
    const stream = path.join(outputDir, `${name}.h264`);
    fs.writeFileSync(stream, Buffer.alloc(0));
    for (const clip of clips) fs.appendFileSync(stream, fs.readFileSync(clip.file));
    const silent = (meta.audio ?? '') === 'none';
    const video = ['-f', 'h264', '-framerate', String(meta.outFps), '-i', stream];
    const audio = silent ? [] : ['-i', prepareMusic({ root: ROOT, plan, meta, outputDir })];
    const maps = silent ? ['-an'] : ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'];
    const target = path.join(outputDir, `${name}.mp4`);
    // Written under another name and renamed at the end, so a half-written file is never opened by mistake.
    const partialTarget = target.replace(/\.mp4$/, '.partial.mp4');
    execFileSync(FF, ['-y', '-loglevel', 'error', ...video, ...audio, ...maps, '-c:v', 'copy', '-movflags', '+faststart', partialTarget], { stdio: 'inherit' });
    fs.renameSync(partialTarget, target);
    fs.rmSync(stream);
    console.log(`STAGE join: ${seconds(joinStart)}s`);
    console.log('Rendered', target);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
