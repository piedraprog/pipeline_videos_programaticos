// Draft narration for a rendered demo plan.
// Usage: bun run voice -- <plan>.json [--provider=elevenlabs|openai] [--list-voices]
// Reads the `say` lines of the plan, synthesizes each one, checks it fits its scene, and muxes
// voice + ducked music onto the existing render as <name>-voz.mp4. Keys come from .env.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FF } from './bin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const LEAD_IN_SECONDS = 0.4;
const TAIL_SECONDS = 0.2;

const PROVIDERS = {
  elevenlabs: { keyName: 'ELEVENLABS_API_KEY', defaultModel: 'eleven_multilingual_v2', synthesize: synthesizeElevenLabs },
  openai: { keyName: 'OPENAI_API_KEY', defaultModel: 'gpt-4o-mini-tts', synthesize: synthesizeOpenAi },
};

// One narration line per scene, in the order the template lays them out: intro, beats, outro.
export function collectLines(plan, meta) {
  const story = plan.story;
  const scenes = [story.intro, ...story.beats, story.outro];
  if (scenes.length !== meta.cuts.length) throw new Error('meta.json does not match the plan; run the render with --qa-only first');
  const lines = [];
  scenes.forEach((scene, index) => {
    if (!scene.say) return;
    const sceneEnd = meta.cuts[index + 1] ?? meta.duration;
    lines.push({ scene: meta.scenes[index], text: scene.say, at: meta.cuts[index] + LEAD_IN_SECONDS, sceneEnd });
  });
  return lines;
}

export function findOverflows(lines) {
  return lines.filter((line) => line.at + line.duration + TAIL_SECONDS > line.sceneEnd);
}

export function cacheName(voice, text) {
  const identity = JSON.stringify([voice.provider, voice.model, voice.voiceId, voice.instructions ?? '', voice.settings ?? null, text]);
  return `${createHash('sha256').update(identity).digest('hex').slice(0, 16)}.mp3`;
}

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function findForbidden(lines, forbiddenWords) {
  const hits = [];
  for (const line of lines) {
    for (const word of forbiddenWords) {
      if (normalize(line.text).includes(normalize(word))) hits.push(`"${line.text}" contains forbidden "${word}"`);
    }
  }
  return hits;
}

async function failFromResponse(provider, response) {
  const body = (await response.text()).slice(0, 400);
  throw new Error(`${provider} answered ${response.status}: ${body}`);
}

async function synthesizeElevenLabs(text, voice, key) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: voice.model, ...(voice.settings ? { voice_settings: voice.settings } : {}) }),
  });
  if (!response.ok) await failFromResponse('ElevenLabs', response);
  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeOpenAi(text, voice, key) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: voice.model, voice: voice.voiceId, input: text, response_format: 'mp3', ...(voice.instructions ? { instructions: voice.instructions } : {}) }),
  });
  if (!response.ok) await failFromResponse('OpenAI', response);
  return Buffer.from(await response.arrayBuffer());
}

async function listElevenLabsVoices(key) {
  const response = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', { headers: { 'xi-api-key': key } });
  if (!response.ok) await failFromResponse('ElevenLabs', response);
  const { voices } = await response.json();
  for (const voice of voices) {
    const labels = voice.labels ?? {};
    console.log(`${voice.voice_id}  ${voice.name}  [${[voice.category, labels.language, labels.accent, labels.gender, labels.use_case].filter(Boolean).join(', ')}]`);
  }
}

function audioDuration(file) {
  // ffmpeg-static ships no ffprobe; the duration is in the banner ffmpeg prints for any input.
  const banner = spawnSync(FF, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(banner);
  if (!match) throw new Error(`Cannot read the duration of ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function mix({ video, music, lines, output }) {
  const inputs = ['-i', video, ...(music ? ['-i', music] : []), ...lines.flatMap((line) => ['-i', line.file])];
  const firstVoice = music ? 2 : 1;
  const delayed = lines.map((line, index) => `[${firstVoice + index}:a]aresample=48000,adelay=${Math.round(line.at * 1000)}:all=1[v${index}]`);
  const voiceBus = `${lines.map((_, index) => `[v${index}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad`;
  const graph = music
    ? [...delayed, `${voiceBus},asplit[vo][key]`, '[1:a]volume=0.75[bed]', '[bed][key]sidechaincompress=threshold=0.02:ratio=9:attack=40:release=450[duck]', '[duck][vo]amix=inputs=2:normalize=0,alimiter=limit=0.9[a]']
    : [...delayed, `${voiceBus},alimiter=limit=0.9[a]`];
  execFileSync(FF, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', output], { stdio: 'inherit' });
}

function resolveVoice(plan, providerOverride) {
  const provider = providerOverride ?? plan.voice?.provider;
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`Set plan.voice.provider or --provider to one of: ${Object.keys(PROVIDERS).join(', ')}`);
  const settings = plan.voice?.[provider] ?? {};
  const key = process.env[config.keyName];
  if (!key) throw new Error(`${config.keyName} is not set. Copy .env.example to .env and paste the key there.`);
  return { provider, key, synthesize: config.synthesize, model: settings.model ?? config.defaultModel, voiceId: settings.voiceId, instructions: settings.instructions, settings: settings.settings };
}

async function main() {
  const planArg = process.argv[2];
  const providerOverride = process.argv.find((arg) => arg.startsWith('--provider='))?.split('=')[1];
  if (process.argv.includes('--list-voices')) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Copy .env.example to .env and paste the key there.');
    return listElevenLabsVoices(key);
  }
  if (!planArg) throw new Error('Usage: bun run voice -- <plan>.json [--provider=elevenlabs|openai] [--list-voices]');

  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, planArg), 'utf8'));
  const outputDir = path.join(ROOT, plan.output);
  const name = path.basename(plan.output);
  const video = path.join(outputDir, `${name}.mp4`);
  const metaPath = path.join(outputDir, 'meta.json');
  if (!fs.existsSync(video) || !fs.existsSync(metaPath)) throw new Error(`Render the plan first: ${video} or meta.json is missing`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const lines = collectLines(plan, meta);
  if (lines.length === 0) throw new Error('The plan has no "say" lines in story.intro, story.beats[] or story.outro');
  const brand = plan.brand ? JSON.parse(fs.readFileSync(path.join(ROOT, plan.brand), 'utf8')) : {};
  const forbidden = findForbidden(lines, brand.messaging?.forbidden ?? []);
  if (forbidden.length > 0) throw new Error(`Messaging gate:\n${forbidden.join('\n')}`);

  const voice = resolveVoice(plan, providerOverride);
  if (!voice.voiceId) throw new Error(`Set plan.voice.${voice.provider}.voiceId (ElevenLabs: run --list-voices; OpenAI: marin, cedar, ...)`);
  const cacheDir = path.join(outputDir, 'voice');
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const line of lines) {
    line.file = path.join(cacheDir, cacheName(voice, line.text));
    if (!fs.existsSync(line.file)) {
      fs.writeFileSync(line.file, await voice.synthesize(line.text, voice, voice.key));
      console.log(`synthesized ${line.scene}`);
    }
    line.duration = audioDuration(line.file);
  }

  const marks = lines.map((line) => `${line.at.toFixed(1).padStart(5, '0')}s - ${(line.at + line.duration).toFixed(1).padStart(5, '0')}s  [${line.scene}]  ${line.text}`);
  fs.writeFileSync(path.join(outputDir, 'marcas-de-tiempo.txt'), `${marks.join('\n')}\n`);
  console.log(marks.join('\n'));
  const overflows = findOverflows(lines);
  if (overflows.length > 0) {
    throw new Error(`These lines run past their scene; shorten the line or lengthen the beat:\n${overflows.map((line) => `- ${line.scene}: ${(line.at + line.duration + TAIL_SECONDS - line.sceneEnd).toFixed(2)} s over (includes a ${TAIL_SECONDS} s tail)`).join('\n')}`);
  }

  const music = path.join(outputDir, 'music.wav');
  const output = path.join(outputDir, `${name}-voz-${voice.provider}.mp4`);
  mix({ video, music: fs.existsSync(music) ? music : null, lines, output });
  console.log(`Narrated draft: ${output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Voice failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
