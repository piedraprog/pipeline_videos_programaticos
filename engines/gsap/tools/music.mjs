// Produces <output>/music.wav for a plan: the plan's own track (plan.musicFile) or the synthesized bed.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FF, PY } from './bin.mjs';

const FADE_IN_SECONDS = 0.4;
const FADE_OUT_SECONDS = 1.5;
const LOOP_CROSSFADE_SECONDS = 4;
// Most tracks end on a fade to silence; that tail is dropped before the next pass comes in.
const LOOP_TAIL_TRIM_SECONDS = 2;

function trackDuration(file) {
  const banner = spawnSync(FF, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(banner);
  if (!match) throw new Error(`Cannot read the duration of ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

// A track shorter than the piece repeats with a crossfade, so its own ending does not leave a gap.
export function loopGraph(copies, trackSeconds) {
  if (copies === 1) return { graph: [], last: '[0:a]' };
  const bodySeconds = trackSeconds - LOOP_TAIL_TRIM_SECONDS;
  const graph = Array.from({ length: copies - 1 }, (_, index) => `[${index}:a]atrim=end=${bodySeconds},asetpts=PTS-STARTPTS[body${index}]`);
  let last = '[body0]';
  for (let index = 1; index < copies; index++) {
    const next = index === copies - 1 ? `[${index}:a]` : `[body${index}]`;
    graph.push(`${last}${next}acrossfade=d=${LOOP_CROSSFADE_SECONDS}:c1=tri:c2=tri[loop${index}]`);
    last = `[loop${index}]`;
  }
  return { graph, last };
}

export function copiesNeeded(pieceSeconds, trackSeconds) {
  if (trackSeconds >= pieceSeconds) return 1;
  const gainedPerCopy = trackSeconds - LOOP_TAIL_TRIM_SECONDS - LOOP_CROSSFADE_SECONDS;
  return 1 + Math.ceil((pieceSeconds - trackSeconds) / gainedPerCopy);
}

export function prepareMusic({ root, plan, meta, outputDir }) {
  const target = path.join(outputDir, 'music.wav');
  if (plan.musicFile) {
    const source = path.join(root, plan.musicFile);
    if (!fs.existsSync(source)) throw new Error(`plan.musicFile not found: ${plan.musicFile}`);
    const trackSeconds = trackDuration(source);
    const copies = copiesNeeded(meta.duration, trackSeconds);
    const { graph, last } = loopGraph(copies, trackSeconds);
    const fadeOutAt = Math.max(0, meta.duration - FADE_OUT_SECONDS);
    graph.push(`${last}afade=t=in:d=${FADE_IN_SECONDS},afade=t=out:st=${fadeOutAt}:d=${FADE_OUT_SECONDS}[music]`);
    const inputs = Array.from({ length: copies }, () => ['-i', source]).flat();
    execFileSync(FF, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph.join(';'), '-map', '[music]', '-t', String(meta.duration), '-ar', '48000', '-ac', '2', target], { stdio: 'inherit' });
    return target;
  }
  const musicMeta = path.join(outputDir, 'music-meta.json');
  fs.writeFileSync(musicMeta, JSON.stringify({ ...meta, music: plan.music ?? meta.music, bpm: plan.bpm ?? meta.bpm }));
  execFileSync(PY, [path.join(root, 'engines/gsap/tools/music.py'), musicMeta, target], { stdio: 'inherit' });
  return target;
}
