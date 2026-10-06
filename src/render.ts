import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestSchema } from './schema';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
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

main().catch((error: unknown) => {
  console.error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
