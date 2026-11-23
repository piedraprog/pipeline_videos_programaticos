// Shared motion kit for the GSAP templates.
// Camera and cursor are pure functions of time (no tween state), so any frame can be
// rendered in any order by parallel workers. Element-level tweens still use GSAP.

export function cubicBezier(x1, y1, x2, y2) {
  const sample = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u ** 2 * (1 - u) + u ** 3;
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (sample(x1, x2, mid) < progress) low = mid;
      else high = mid;
    }
    return sample(y1, y2, (low + high) / 2);
  };
}

// Damped spring normalized to land exactly on 1. `decay` is how fast it settles,
// `bounces` how many overshoots fit in the duration.
export function spring(decay, bounces) {
  const omega = 2 * Math.PI * bounces;
  const raw = (p) => 1 - Math.exp(-decay * p) * (Math.cos(omega * p) + (decay / omega) * Math.sin(omega * p));
  const end = raw(1);
  return (progress) => (progress <= 0 ? 0 : progress >= 1 ? 1 : raw(progress) / end);
}

export const EASES = {
  linear: (p) => p,
  glide: cubicBezier(0.65, 0, 0.35, 1),
  settle: cubicBezier(0.22, 1, 0.36, 1),
  swift: cubicBezier(0.3, 0, 0, 1),
  hand: cubicBezier(0.5, 0, 0.15, 1),
  exit: cubicBezier(0.4, 0, 1, 1),
  spring: spring(6.5, 1.15),
  springSoft: spring(7.5, 0.6),
};

export function registerEases(gsap) {
  for (const [name, fn] of Object.entries(EASES)) gsap.registerEase(name, fn);
}

function resolveEase(ease) {
  if (typeof ease === 'function') return ease;
  const known = EASES[ease];
  if (!known) throw new Error(`Unknown ease "${ease}". Use one of: ${Object.keys(EASES).join(', ')}`);
  return known;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

// Keyframe track evaluated at any time. Segments that animate the same property must not overlap.
export function createTrack(initial) {
  const segments = [];
  return {
    to(values, at, duration = 0, ease = 'glide') {
      segments.push({ values, at, duration, ease: resolveEase(ease) });
      segments.sort((a, b) => a.at - b.at);
      return this;
    },
    // True while a segment is in progress: the renderer uses it to tell moving frames from holds.
    active(time) {
      return segments.some((segment) => segment.duration > 0 && time >= segment.at && time <= segment.at + segment.duration);
    },
    at(time) {
      const state = { ...initial };
      for (const segment of segments) {
        if (time < segment.at) break;
        const progress = segment.duration <= 0 ? 1 : clamp01((time - segment.at) / segment.duration);
        const eased = segment.ease(progress);
        for (const [key, target] of Object.entries(segment.values)) {
          state[key] += (target - state[key]) * eased;
        }
      }
      return state;
    },
  };
}

const DEFAULT_DRIFT = { pan: 5, tilt: 0.3 };

// Camera pose over time, with no rendering attached: a renderer asks `at(time)` and draws.
export function createCameraPath({ width, height, drift = DEFAULT_DRIFT }) {
  const track = createTrack({ x: width / 2, y: height / 2, zoom: 1, tiltX: 0, tiltY: 0, roll: 0 });
  return {
    track,
    // Camera pose that fits `rect` (world px) inside `fill` of the frame.
    frame(rect, fill = 0.8, maxZoom = 2.2) {
      const zoom = Math.min((width * fill) / rect.width, (height * fill) / rect.height, maxZoom);
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, zoom };
    },
    // `dip` pulls the zoom back mid-move so a long pan reads as an arc, not a slide.
    moveTo(pose, at, duration = 1.2, { ease = 'glide', dip = 0 } = {}) {
      const { zoom, ...rest } = pose;
      track.to(rest, at, duration, ease);
      if (zoom === undefined) return this;
      if (dip <= 0) {
        track.to({ zoom }, at, duration, ease);
        return this;
      }
      const lowest = Math.min(track.at(at).zoom, zoom) * (1 - dip);
      track.to({ zoom: lowest }, at, duration / 2, 'glide');
      track.to({ zoom }, at + duration / 2, duration / 2, 'glide');
      return this;
    },
    at(time) {
      const state = track.at(time);
      // Handheld-style float so a hold never looks frozen; scaled down as the camera zooms in.
      return {
        ...state,
        x: state.x + (Math.sin(time * 0.55) * drift.pan) / state.zoom,
        y: state.y + (Math.cos(time * 0.43) * drift.pan * 0.6) / state.zoom,
        tiltX: state.tiltX + Math.sin(time * 0.31 + 1.3) * drift.tilt,
        tiltY: state.tiltY + Math.sin(time * 0.37) * drift.tilt,
      };
    },
  };
}

// Virtual camera over a `world` element laid out in stage pixels. The stage needs CSS `perspective`.
export function createCamera({ world, width, height, drift = DEFAULT_DRIFT }) {
  const path = createCameraPath({ width, height, drift });
  world.style.transformOrigin = '0 0';
  return {
    track: path.track,
    frame: path.frame,
    moveTo(...args) {
      path.moveTo(...args);
      return this;
    },
    apply(time) {
      const pose = path.at(time);
      world.style.transform =
        `translate(${width / 2}px,${height / 2}px) rotateX(${pose.tiltX.toFixed(3)}deg) rotateY(${pose.tiltY.toFixed(3)}deg) ` +
        `rotate(${pose.roll.toFixed(3)}deg) scale(${pose.zoom.toFixed(5)}) translate(${(-pose.x).toFixed(2)}px,${(-pose.y).toFixed(2)}px)`;
      return pose;
    },
  };
}

// Pointer position, press and click ring over time, with no rendering attached.
export function createCursorPath({ start }) {
  const moves = [];
  const clicks = [];
  const visibility = createTrack({ opacity: 0 });
  const hand = resolveEase('hand');

  return {
    show(at) {
      visibility.to({ opacity: 1 }, at, 0.3, 'settle');
      return this;
    },
    hide(at) {
      visibility.to({ opacity: 0 }, at, 0.25, 'glide');
      return this;
    },
    moveTo(point, at, duration = 0.9, bend = 0.16) {
      moves.push({ point, at, duration, bend });
      moves.sort((a, b) => a.at - b.at);
      return this;
    },
    click(at) {
      clicks.push(at);
      return this;
    },
    isBusy(time) {
      return (
        visibility.active(time) ||
        moves.some((move) => time >= move.at && time <= move.at + move.duration) ||
        clicks.some((at) => time >= at - 0.08 && time <= at + 0.6)
      );
    },
    at(time) {
      let position = start;
      for (const [index, move] of moves.entries()) {
        if (time < move.at) break;
        const from = position;
        const eased = hand(clamp01((time - move.at) / move.duration));
        // Alternate the bend side so consecutive moves do not trace the same arc.
        const side = index % 2 === 0 ? 1 : -1;
        const control = {
          x: (from.x + move.point.x) / 2 - (move.point.y - from.y) * move.bend * side,
          y: (from.y + move.point.y) / 2 + (move.point.x - from.x) * move.bend * side,
        };
        const inverse = 1 - eased;
        position = {
          x: inverse * inverse * from.x + 2 * inverse * eased * control.x + eased * eased * move.point.x,
          y: inverse * inverse * from.y + 2 * inverse * eased * control.y + eased * eased * move.point.y,
        };
      }
      let press = 1;
      let ringScale = 0;
      let ringOpacity = 0;
      for (const at of clicks) {
        const elapsed = time - at;
        if (elapsed < -0.08 || elapsed > 0.6) continue;
        press = 1 - 0.2 * Math.sin(Math.PI * clamp01((elapsed + 0.08) / 0.3));
        if (elapsed >= 0) {
          const spread = 1 - (1 - clamp01(elapsed / 0.6)) ** 4;
          ringScale = 0.25 + 1.5 * spread;
          ringOpacity = 1 - spread;
        }
      }
      return { x: position.x, y: position.y, opacity: visibility.at(time).opacity, press, ringScale, ringOpacity };
    },
  };
}

const CURSOR_SVG =
  '<svg viewBox="0 0 28 28" width="40" height="40" style="overflow:visible;filter:drop-shadow(0 3px 5px rgba(0,0,0,.28))">' +
  '<path d="M5 3l17 9.2-7.3 1.9L18.9 22l-3.6 1.8-4-7.8L5 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

// Pointer that travels on curved paths and presses on click. Lives in world space, keeps screen size.
export function createCursor({ parent, color, start }) {
  const element = document.createElement('div');
  element.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:50;opacity:0';
  element.innerHTML =
    `<div data-ring style="position:absolute;left:-36px;top:-36px;width:72px;height:72px;border-radius:50%;border:3px solid ${color};background:${color}26;opacity:0"></div>` +
    `<div data-arrow style="position:absolute;left:-6px;top:-4px;transform-origin:6px 4px">${CURSOR_SVG}</div>`;
  parent.append(element);
  const ring = element.querySelector('[data-ring]');
  const arrow = element.querySelector('[data-arrow]');
  const path = createCursorPath({ start });

  return {
    show(at) {
      path.show(at);
      return this;
    },
    hide(at) {
      path.hide(at);
      return this;
    },
    moveTo(...args) {
      path.moveTo(...args);
      return this;
    },
    click(at) {
      path.click(at);
      return this;
    },
    isBusy: path.isBusy,
    apply(time, zoom) {
      const pointer = path.at(time);
      element.style.opacity = pointer.opacity.toFixed(3);
      element.style.transform = `translate(${pointer.x.toFixed(2)}px,${pointer.y.toFixed(2)}px) scale(${(1 / zoom).toFixed(5)})`;
      arrow.style.transform = `scale(${pointer.press.toFixed(4)})`;
      ring.style.opacity = pointer.ringOpacity.toFixed(3);
      ring.style.transform = `scale(${pointer.ringScale.toFixed(4)})`;
    },
  };
}

// Wraps each word in a clipping mask so it can rise into place.
export function splitWords(element) {
  const words = element.textContent.trim().split(/\s+/);
  element.textContent = '';
  return words.map((word, index) => {
    const mask = document.createElement('span');
    // Padding keeps descenders and accents inside the mask.
    mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding:.14em .06em .2em;margin:-.14em -.06em -.2em';
    const inner = document.createElement('span');
    inner.style.cssText = 'display:inline-block;will-change:transform';
    inner.textContent = word;
    mask.append(inner);
    element.append(mask);
    if (index < words.length - 1) element.append(' ');
    return inner;
  });
}

export function revealWords(timeline, words, at, { stagger = 0.05, duration = 0.75 } = {}) {
  timeline.fromTo(
    words,
    { yPercent: 150, rotation: 5 },
    { yPercent: 0, rotation: 0, duration, ease: 'settle', stagger, immediateRender: true },
    at,
  );
}

export function hideWords(timeline, words, at, { stagger = 0.02, duration = 0.32 } = {}) {
  timeline.to(words, { yPercent: -150, duration, ease: 'exit', stagger }, at);
}
