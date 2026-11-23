// Frame planning for the renderer: which frames must be captured again, and how many samples each needs.
// A render is split into the template's scenes; a scene whose inputs did not change keeps its captured
// frames in <output>/frame-cache/, so editing one scene does not re-capture the whole piece.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Plan fields that never change a pixel: editing them must not invalidate captured frames.
const NON_VISUAL_PLAN_FIELDS = ['story', 'voice', 'music', 'musicFile', 'audio', 'bpm', 'crf', 'output'];

function sha(text) {
  return createHash('sha256').update(text).digest('hex');
}

// Sub-frames per output frame, and how many of them fall inside the open shutter.
export function shutterPlan(meta) {
  const perFrame = Math.round(meta.fps / meta.outFps);
  const open = meta.shutter ? Math.max(1, Math.round((perFrame * meta.shutter) / 360)) : perFrame;
  return { perFrame, open };
}

function collectFiles(value, root, found) {
  if (typeof value === 'string') {
    const candidate = path.join(root, value);
    if (value.length < 260 && /\.[a-z0-9]{2,5}$/i.test(value) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) found.add(value);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectFiles(child, root, found);
  }
  return found;
}

// Everything outside the story that decides how a frame looks: template code, style, brand,
// the files they point at, and the capture settings.
export function inputFingerprint({ root, plan, brand, style, codeFiles, settings }) {
  const visualPlan = Object.fromEntries(Object.entries(plan).filter(([key]) => !NON_VISUAL_PLAN_FIELDS.includes(key)));
  const assets = [...collectFiles([plan, brand, style], root, new Set())].sort().map((file) => {
    const stat = fs.statSync(path.join(root, file));
    return `${file}:${stat.size}:${Math.round(stat.mtimeMs)}`;
  });
  const code = codeFiles.filter((file) => fs.existsSync(path.join(root, file))).map((file) => `${file}:${sha(fs.readFileSync(path.join(root, file), 'utf8'))}`);
  return sha(JSON.stringify({ visualPlan, brand, style, assets, code, settings }));
}

export function segmentKey(fingerprint, segment) {
  return sha(`${fingerprint}\n${segment.start.toFixed(4)}\n${segment.end.toFixed(4)}\n${segment.source}`).slice(0, 16);
}

// Output-frame ranges per segment: contiguous, and the last one always reaches the end of the piece.
export function segmentRanges(segments, outFps, totalFrames) {
  return segments.map((segment, index) => ({
    segment,
    first: Math.min(totalFrames, Math.round(segment.start * outFps)),
    end: index === segments.length - 1 ? totalFrames : Math.min(totalFrames, Math.round(segment.end * outFps)),
  }));
}

// A moving frame is sampled `open` times and averaged into motion blur. A still frame is captured once;
// its other samples are links to that capture, so the encoder sees the same layout either way.
export function captureJobs({ dir, extension, frames, moving, perFrame, open, fps }) {
  const jobs = [];
  frames.forEach((frame, index) => {
    const file = (sample) => sampleFile(dir, extension, frame, sample);
    const samples = moving[index] ? open : 1;
    for (let sample = 0; sample < samples; sample++) {
      const copies = samples === 1 ? Array.from({ length: open - 1 }, (_, extra) => file(extra + 1)) : [];
      jobs.push({ time: (frame * perFrame + sample) / fps, file: file(sample), copies });
    }
  });
  return jobs;
}

export function linkOrCopy(source, target) {
  try {
    fs.linkSync(source, target);
  } catch {
    fs.copyFileSync(source, target);
  }
}

export function sampleFile(dir, extension, frame, sample) {
  return path.join(dir, `o${String(frame).padStart(6, '0')}_${sample}.${extension}`);
}
