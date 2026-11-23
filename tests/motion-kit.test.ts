import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createCamera, createTrack, EASES } from '../engines/gsap/lib/motion.js';

const readJson = (file: string) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));

test('every ease starts at 0 and lands exactly on 1', () => {
  for (const [name, ease] of Object.entries(EASES)) {
    expect([name, ease(0), ease(1)]).toEqual([name, 0, 1]);
  }
});

test('spring overshoots its target before settling, settle never does', () => {
  const samples = Array.from({ length: 99 }, (_, index) => (index + 1) / 100);
  expect(Math.max(...samples.map(EASES.spring))).toBeGreaterThan(1.02);
  expect(Math.max(...samples.map(EASES.settle))).toBeLessThanOrEqual(1);
});

test('a track holds between segments and continues from where the last one ended', () => {
  const track = createTrack({ x: 0, zoom: 1 });
  track.to({ x: 100 }, 1, 2, 'linear').to({ x: 50, zoom: 2 }, 5, 1, 'linear');
  expect(track.at(0.5)).toEqual({ x: 0, zoom: 1 });
  expect(track.at(2).x).toBeCloseTo(50);
  expect(track.at(4)).toEqual({ x: 100, zoom: 1 });
  expect(track.at(5.5).x).toBeCloseTo(75);
  expect(track.at(9)).toEqual({ x: 50, zoom: 2 });
});

test('a track gives the same answer regardless of the order frames are asked for', () => {
  const track = createTrack({ x: 0 }).to({ x: 10 }, 0, 1).to({ x: -4 }, 2, 1, 'spring');
  const forward = [0.2, 0.9, 2.4, 3.5].map((time) => track.at(time).x);
  const backward = [3.5, 2.4, 0.9, 0.2].map((time) => track.at(time).x).reverse();
  expect(backward).toEqual(forward);
});

test('the camera frames a target inside the requested share of the frame and respects the zoom cap', () => {
  const camera = createCamera({ world: { style: {} }, width: 1920, height: 1080 });
  expect(camera.frame({ x: 100, y: 200, width: 960, height: 100 }, 0.5)).toEqual({ x: 580, y: 250, zoom: 1 });
  expect(camera.frame({ x: 0, y: 0, width: 10, height: 10 }, 0.5, 1.8).zoom).toBe(1.8);
});

test('a camera move with a dip pulls back mid-way and still arrives at the target zoom', () => {
  const camera = createCamera({ world: { style: {} }, width: 1920, height: 1080, drift: { pan: 0, tilt: 0 } });
  camera.moveTo({ x: 400, zoom: 1.5 }, 0, 0);
  camera.moveTo({ x: 1500, zoom: 1.5 }, 1, 2, { dip: 0.2 });
  expect(camera.track.at(2).zoom).toBeCloseTo(1.2);
  expect(camera.track.at(3)).toMatchObject({ x: 1500, zoom: 1.5 });
});

test('the example demo plan only points at screens and boxes that exist', () => {
  const plan = readJson('plans/form-product-demo.json');
  const boxesByScreen = new Map<string, string[]>();
  for (const screen of plan.story.screens) boxesByScreen.set(screen.id, Object.keys(readJson(screen.boxes)));
  for (const beat of plan.story.beats) {
    const boxes = boxesByScreen.get(beat.screen);
    expect(boxes).toBeDefined();
    const targets = [
      ...(beat.camera ?? []).map((key: { focus: string }) => key.focus).filter((focus: string) => focus !== 'full'),
      ...(beat.cursor ?? []).map((move: { to: string }) => move.to),
      ...(beat.highlight ?? []).map((highlight: { box: string }) => highlight.box),
    ];
    for (const target of targets) expect(boxes).toContain(target);
  }
});
