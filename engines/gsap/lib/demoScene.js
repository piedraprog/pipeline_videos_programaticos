// The product-demo choreography as pure data: given a story and its screens, `at(time)` says where the
// camera, window, cursor, spotlights and texts are. Nothing here draws, so any renderer can use it and
// any frame can be computed in any order.
import { createCameraPath, createCursorPath, createTrack, EASES } from './motion.js';

export const STAGE = { width: 1920, height: 1080 };
export const CHROME_HEIGHT = 50;
const WINDOW_WIDTH = 1480;
const HERO_TILT = { tiltX: 8, tiltY: -11 };
// Targets sit slightly above center so the caption card rarely covers what the camera is looking at.
const CAPTION_LIFT = 46;
const MAX_ZOOM = 1.85;
// How much backdrop may show past a window edge while the camera is zoomed in (screen px).
const EDGE_MARGIN = 90;
const SCREEN_SWAP_SECONDS = 0.34;
const WORD_TRAVEL_PERCENT = 150;
const WORD_HIDE = { stagger: 0.02, duration: 0.32 };
// Motion is checked a little before and after a frame so its blur samples never miss the start of a move.
const MOTION_PAD_SECONDS = 1 / 24;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const splitWords = (text) => text.trim().split(/\s+/);

function wordOffsets(words, time, reveal, hideAt) {
  return words.map((_, index) => {
    if (hideAt !== undefined && time >= hideAt + index * WORD_HIDE.stagger) {
      return -WORD_TRAVEL_PERCENT * EASES.exit(clamp01((time - hideAt - index * WORD_HIDE.stagger) / WORD_HIDE.duration));
    }
    const shown = EASES.settle(clamp01((time - reveal.at - index * reveal.stagger) / reveal.duration));
    return WORD_TRAVEL_PERCENT * (1 - shown);
  });
}

function wordWindows(words, reveal, hideAt) {
  const windows = [[reveal.at, reveal.at + (words.length - 1) * reveal.stagger + reveal.duration]];
  if (hideAt !== undefined) windows.push([hideAt, hideAt + (words.length - 1) * WORD_HIDE.stagger + WORD_HIDE.duration]);
  return windows;
}

export function buildDemoScene(story, screens) {
  const viewport = story.viewport ?? { width: 1440, height: 900 };
  const pageScale = WINDOW_WIDTH / viewport.width;
  const viewHeight = viewport.height * pageScale;
  const windowRect = {
    x: (STAGE.width - WINDOW_WIDTH) / 2,
    y: (STAGE.height - viewHeight - CHROME_HEIGHT) / 2,
    width: WINDOW_WIDTH,
    height: viewHeight + CHROME_HEIGHT,
  };
  const tracks = [];
  const motionWindows = [];
  const track = (initial) => {
    const created = createTrack(initial);
    tracks.push(created);
    return created;
  };

  const camera = createCameraPath(STAGE);
  const cursor = createCursorPath({ start: { x: windowRect.x + windowRect.width * 0.72, y: windowRect.y + windowRect.height * 0.8 } });
  const scroll = Object.fromEntries(Object.keys(screens).map((id) => [id, track({ y: 0 })]));
  const fullPose = { ...camera.frame(windowRect, 0.88), tiltX: 0, tiltY: 0 };

  function pageRect(screenId, target) {
    if (typeof target === 'object') return target;
    const box = screens[screenId].boxes[target];
    if (!box) throw new Error(`Screen "${screenId}" has no box "${target}". Available: ${Object.keys(screens[screenId].boxes).join(', ') || 'none'}`);
    return box;
  }
  function worldRect(screenId, target, time) {
    const box = pageRect(screenId, target);
    const scrollY = scroll[screenId].at(time).y;
    return {
      x: windowRect.x + box.x * pageScale,
      y: windowRect.y + CHROME_HEIGHT + (box.y - scrollY) * pageScale,
      width: box.width * pageScale,
      height: box.height * pageScale,
    };
  }
  // A tall or off-center target must not shrink the window or push it to one side of the frame:
  // the camera never pulls back past the overview and never looks beyond the window edges.
  function keepWindowInFrame(pose) {
    const zoom = Math.max(pose.zoom, fullPose.zoom);
    const clampAxis = (value, start, size, frameSize) => {
      const reach = frameSize / (2 * zoom) - EDGE_MARGIN / zoom;
      const min = start + reach;
      const max = start + size - reach;
      return min > max ? start + size / 2 : Math.min(max, Math.max(min, value));
    };
    return { ...pose, zoom, x: clampAxis(pose.x, windowRect.x, windowRect.width, STAGE.width), y: clampAxis(pose.y, windowRect.y, windowRect.height, STAGE.height) };
  }

  const copy = [];
  const say = (text) => {
    if (text) copy.push(text);
    return text;
  };

  // ---- Intro: brand and promise alone, then the product rises into the frame
  const introDuration = story.intro.duration;
  const introExit = introDuration - 0.85;
  const leave = (created, at) => created.to({ opacity: 0, y: -24 }, at, 0.4, 'exit');
  const intro = {
    kicker: say(story.intro.kicker),
    title: say(story.intro.title),
    subtitle: say(story.intro.subtitle),
    words: splitWords(story.intro.title),
    reveal: { at: 0.5, stagger: 0.07, duration: 0.9 },
    mark: leave(track({ opacity: 0, y: 26, scale: 0.9 }).to({ opacity: 1, y: 0, scale: 1 }, 0.15, 0.9, 'springSoft'), introExit),
    kickerTrack: leave(track({ opacity: 0, y: 16 }).to({ opacity: 1, y: 0 }, 0.4, 0.6, 'settle'), introExit + 0.04),
    subTrack: leave(track({ opacity: 0, y: 22 }).to({ opacity: 1, y: 0 }, 1.05, 0.8, 'settle'), introExit + 0.08),
  };
  motionWindows.push(...wordWindows(intro.words, intro.reveal, introExit));

  camera.track.to({ ...fullPose, zoom: fullPose.zoom * 0.9, ...HERO_TILT }, 0, 0);
  const windowTrack = track({ y: 820, rotateX: 46, scale: 0.8, opacity: 0 }).to({ y: 0, rotateX: 0, scale: 1, opacity: 1 }, introDuration - 0.6, 1.6, 'springSoft');

  // ---- Beats: one camera take across the product
  const scenes = [{ name: 'intro', start: 0, end: introDuration }];
  const qaTimes = [Math.min(1.8, introDuration - 1)];
  const swaps = [];
  const highlights = [];
  const cards = [];
  let beatStart = introDuration;
  let cursorShown = false;
  story.beats.forEach((beat, index) => {
    if (!screens[beat.screen]) throw new Error(`Beat ${index + 1} uses unknown screen "${beat.screen}"`);
    scenes.push({ name: `${beat.screen}-${index + 1}`, start: beatStart, end: beatStart + beat.duration });
    qaTimes.push(beatStart + Math.max(1.2, beat.duration - 0.8));

    if (swaps.at(-1)?.screen !== beat.screen) {
      const first = swaps.length === 0;
      swaps.push({ screen: beat.screen, at: first ? -Infinity : beatStart, urlAt: first ? -Infinity : beatStart + 0.15 });
      if (!first) motionWindows.push([beatStart, beatStart + SCREEN_SWAP_SECONDS]);
    }

    for (const step of beat.scroll ?? []) {
      const target = typeof step.to === 'number' ? step.to : pageRect(beat.screen, step.to).y - 140;
      const limit = Math.max(0, screens[beat.screen].pageHeight - viewport.height);
      scroll[beat.screen].to({ y: Math.min(limit, Math.max(0, target)) }, beatStart + step.at, step.duration ?? 1.1, 'glide');
    }

    for (const key of beat.camera ?? []) {
      const at = beatStart + key.at;
      const duration = key.duration ?? 1.3;
      const framed = key.focus === 'full' ? fullPose : camera.frame(worldRect(beat.screen, key.focus, at + duration), key.fill ?? 0.6, MAX_ZOOM);
      const frame = keepWindowInFrame({ ...framed, y: framed.y + CAPTION_LIFT / framed.zoom });
      const [tiltX, tiltY] = key.tilt ?? [0, 0];
      camera.moveTo({ ...frame, tiltX, tiltY, roll: key.roll ?? 0 }, at, duration, { ease: key.ease ?? 'glide', dip: key.dip ?? 0 });
    }

    // A pointer parked over the page reads as a mistake: it leaves during beats that do not use it.
    if (!beat.cursor?.length && cursorShown) {
      cursor.hide(beatStart + 0.25);
      cursorShown = false;
    }
    for (const move of beat.cursor ?? []) {
      const at = beatStart + move.at;
      const duration = move.duration ?? 0.9;
      const rect = worldRect(beat.screen, move.to, at + duration);
      const [anchorX, anchorY] = move.anchor ?? [0.5, 0.5];
      if (!cursorShown) {
        cursor.show(at - 0.15);
        cursorShown = true;
      }
      cursor.moveTo({ x: rect.x + rect.width * anchorX, y: rect.y + rect.height * anchorY }, at, duration);
      if (move.click) cursor.click(at + duration + 0.05);
    }

    for (const highlight of beat.highlight ?? []) {
      const at = beatStart + highlight.at;
      const box = pageRect(beat.screen, highlight.box);
      const pad = highlight.pad ?? 10;
      const top = (box.y - scroll[beat.screen].at(at).y) * pageScale - pad;
      highlights.push({
        label: say(highlight.label),
        labelBelow: top < 70,
        // In view coordinates: the page area under the browser chrome.
        rect: { x: box.x * pageScale - pad, y: top, width: box.width * pageScale + pad * 2, height: box.height * pageScale + pad * 2 },
        spot: track({ opacity: 0, scale: 1.07 }).to({ opacity: 1, scale: 1 }, at, 0.55, 'settle').to({ opacity: 0 }, at + (highlight.duration ?? 2.2), 0.3, 'glide'),
        labelTrack: track({ opacity: 0, y: 10 }).to({ opacity: 1, y: 0 }, at + 0.18, 0.45, 'settle'),
      });
    }

    if (beat.title) {
      const card = {
        title: say(beat.title),
        caption: say(beat.caption),
        words: splitWords(beat.title),
        reveal: { at: beatStart + 0.3, stagger: 0.045, duration: 0.7 },
        box: track({ opacity: 0, y: 34, scale: 0.96 }).to({ opacity: 1, y: 0, scale: 1 }, beatStart + 0.2, 0.7, 'springSoft').to({ opacity: 0, y: -18, scale: 0.98 }, beatStart + beat.duration - 0.25, 0.3, 'exit'),
        captionTrack: track({ opacity: 0, y: 12 }).to({ opacity: 1, y: 0 }, beatStart + 0.6, 0.6, 'settle'),
      };
      motionWindows.push(...wordWindows(card.words, card.reveal));
      cards.push(card);
    }
    beatStart += beat.duration;
  });

  // ---- Outro: the product recedes and the brand closes
  const outroAt = beatStart;
  const duration = outroAt + story.outro.duration;
  scenes.push({ name: 'outro', start: outroAt, end: duration });
  qaTimes.push(duration - 0.1);
  cursor.hide(outroAt - 0.1);
  camera.moveTo({ ...fullPose, zoom: fullPose.zoom * 0.8, tiltX: 12, tiltY: 10 }, outroAt, 1.5, { ease: 'glide' });
  windowTrack.to({ y: 150, opacity: 0 }, outroAt + 0.15, 0.95, 'glide');
  const outro = {
    title: say(story.outro.title),
    subtitle: say(story.outro.subtitle),
    words: splitWords(story.outro.title),
    reveal: { at: outroAt + 0.85, stagger: 0.06, duration: 0.9 },
    visibleFrom: outroAt + 0.5,
    mark: track({ opacity: 0, scale: 0.7, y: 20 }).to({ opacity: 1, scale: 1, y: 0 }, outroAt + 0.6, 1, 'spring'),
    subTrack: track({ opacity: 0, y: 20 }).to({ opacity: 1, y: 0 }, outroAt + 1.3, 0.8, 'settle'),
  };
  motionWindows.push(...wordWindows(outro.words, outro.reveal));

  function screensAt(time) {
    let index = 0;
    for (let i = 0; i < swaps.length; i++) if (time >= swaps[i].at) index = i;
    const current = swaps[index];
    const mix = index === 0 ? 1 : EASES.settle(clamp01((time - current.at) / SCREEN_SWAP_SECONDS));
    let url = swaps[0].screen;
    for (const swap of swaps) if (time >= swap.urlAt) url = swap.screen;
    return { current: current.screen, previous: mix < 1 ? swaps[index - 1].screen : null, mix, url };
  }

  function movingAt(time) {
    return tracks.some((item) => item.active(time)) || camera.track.active(time) || cursor.isBusy(time) || motionWindows.some(([from, to]) => time >= from && time <= to);
  }

  return {
    windowRect,
    viewRect: { x: windowRect.x, y: windowRect.y + CHROME_HEIGHT, width: windowRect.width, height: viewHeight },
    viewport,
    duration,
    scenes,
    qaTimes,
    copy,
    intro: { kicker: intro.kicker, title: intro.title, subtitle: intro.subtitle, words: intro.words },
    outro: { title: outro.title, subtitle: outro.subtitle, words: outro.words },
    cards: cards.map((card) => ({ title: card.title, caption: card.caption, words: card.words })),
    highlights: highlights.map((highlight) => ({ label: highlight.label, labelBelow: highlight.labelBelow, rect: highlight.rect })),
    // Holds outnumber moves in a walkthrough; a renderer can sample a still frame once.
    isMoving: (time) => [time - MOTION_PAD_SECONDS, time, time + MOTION_PAD_SECONDS].some(movingAt),
    at(time) {
      return {
        camera: camera.at(time),
        window: windowTrack.at(time),
        screens: screensAt(time),
        scroll: Object.fromEntries(Object.entries(scroll).map(([id, item]) => [id, item.at(time).y])),
        cursor: cursor.at(time),
        highlights: highlights.map((highlight) => ({ ...highlight.spot.at(time), label: highlight.labelTrack.at(time) })),
        cards: cards.map((card) => ({ ...card.box.at(time), caption: card.captionTrack.at(time), wordOffsets: wordOffsets(card.words, time, card.reveal) })),
        intro: time < introDuration ? { mark: intro.mark.at(time), kicker: intro.kickerTrack.at(time), sub: intro.subTrack.at(time), wordOffsets: wordOffsets(intro.words, time, intro.reveal, introExit) } : null,
        outro: time >= outro.visibleFrom ? { mark: outro.mark.at(time), sub: outro.subTrack.at(time), wordOffsets: wordOffsets(outro.words, time, outro.reveal) } : null,
      };
    },
  };
}
