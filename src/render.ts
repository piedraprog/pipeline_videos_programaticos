import { spawnSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestSchema } from './schema';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  // Unified entry: `render -- <project>` = Remotion engine (manifest from capture);
  // `render -- plans/<plan>.json [--qa-only|--motion-check]` dispatches on plan.engine ("gsap" | "remotion").
  const arg = process.argv[2];
  if (arg?.endsWith('.json')) {
    const plan = JSON.parse(await readFile(path.resolve(rootDir, arg), 'utf8')) as { engine?: string; projectName?: string };
    if (plan.engine === 'gsap') return runNode(['engines/gsap/tools/render.mjs', arg, ...process.argv.slice(3)]);
    if (!plan.projectName) throw new Error(`${arg}: plan has neither engine "gsap" nor a projectName.`);
    process.argv[2] = plan.projectName;
  }
  const projectName = process.argv[2];
  if (!projectName || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(projectName)) {
    throw new Error('Usage: bun run render -- <project-name> (lowercase letters, numbers, and hyphens)');
  }
  const projectDir = path.join(rootDir, 'projects', projectName);
  const manifestPath = path.join(projectDir, 'manifest.json');
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${manifestPath}. Run capture first. ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = ManifestSchema.safeParse(raw);
  if (!result.success) throw new Error(`Invalid manifest:\n${result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n')}`);
  const manifest = result.data;
  if (manifest.projectName !== projectName) throw new Error(`Manifest projectName "${manifest.projectName}" does not match requested project "${projectName}".`);
  for (const scene of manifest.scenes) {
    const assetPath = path.resolve(rootDir, scene.asset);
    if (!assetPath.startsWith(`${rootDir}${path.sep}`)) throw new Error(`Scene "${scene.id}" asset path escapes the project root.`);
    try {
      await access(assetPath);
    } catch {
      throw new Error(`Scene "${scene.id}" is missing asset: ${scene.asset}`);
    }
  }

  const entryPoint = path.join(rootDir, 'templates', 'index.tsx');
  console.log('Bundling Remotion composition...');
  const serveUrl = await bundle({ entryPoint, publicDir: rootDir });
  const inputProps = { manifest };
  const composition = await selectComposition({ serveUrl, id: 'AgnosticReel', inputProps });
  const outputLocation = path.join(projectDir, 'output.mp4');
  console.log(`Rendering ${manifest.scenes.length} scenes to ${path.relative(rootDir, outputLocation)}...`);
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps,
    pixelFormat: 'yuv420p',
  });
  console.log(`Render complete: ${outputLocation}`);
}

function runNode(args: string[]) {
  // GSAP engine runs under Node (Playwright launch is unreliable under Bun on Windows, see capture).
  const r = spawnSync('node', args, { cwd: rootDir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`gsap engine exited with ${r.status ?? r.error}`);
}

main().catch((error: unknown) => {
  console.error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
