// Produces <output>/music.wav for a plan: the plan's own track (plan.musicFile) or the synthesized bed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FF, PY } from './bin.mjs';

const FADE_IN_SECONDS = 0.4;
const FADE_OUT_SECONDS = 1.5;

export function prepareMusic({ root, plan, meta, outputDir }) {
  const target = path.join(outputDir, 'music.wav');
  if (plan.musicFile) {
    const source = path.join(root, plan.musicFile);
    if (!fs.existsSync(source)) throw new Error(`plan.musicFile not found: ${plan.musicFile}`);
    const fadeOutAt = Math.max(0, meta.duration - FADE_OUT_SECONDS);
    const fades = `afade=t=in:d=${FADE_IN_SECONDS},afade=t=out:st=${fadeOutAt}:d=${FADE_OUT_SECONDS}`;
    // -stream_loop covers tracks shorter than the piece; -t cuts longer ones.
    execFileSync(FF, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', source, '-t', String(meta.duration), '-af', fades, '-ar', '48000', '-ac', '2', target], { stdio: 'inherit' });
    return target;
  }
  const musicMeta = path.join(outputDir, 'music-meta.json');
  fs.writeFileSync(musicMeta, JSON.stringify({ ...meta, music: plan.music ?? meta.music, bpm: plan.bpm ?? meta.bpm }));
  execFileSync(PY, [path.join(root, 'engines/gsap/tools/music.py'), musicMeta, target], { stdio: 'inherit' });
  return target;
}
