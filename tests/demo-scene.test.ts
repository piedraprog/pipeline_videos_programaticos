import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildDemoScene } from '../engines/gsap/lib/demoScene.js';

const readJson = (file: string) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const plan = readJson('plans/form-product-demo.json');
const screens = Object.fromEntries(
  plan.story.screens.map((screen: { id: string; boxes: string }) => [screen.id, { boxes: readJson(screen.boxes), pageWidth: 1440, pageHeight: 900 }]),
);
const scene = buildDemoScene(plan.story, screens);
function span(index: number): { name: string; start: number; end: number } {
  const found = scene.scenes.at(index);
  if (!found) throw new Error(`No scene ${index}`);
  return found;
}
function introAt(time: number): { wordOffsets: number[] } {
  const state = scene.at(time).intro;
  if (!state) throw new Error(`The intro is over at ${time}`);
  return state;
}

test('the scenes cover the whole piece back to back: intro, one per beat, outro', () => {
  expect(scene.scenes.map((item: { name: string }) => item.name)).toEqual(['intro', 'catalog-1', 'product-2', 'added-3', 'cart-4', 'confirmed-5', 'outro']);
  expect(span(0).start).toBe(0);
  for (let index = 1; index < scene.scenes.length; index++) expect(span(index).start).toBe(span(index - 1).end);
  expect(span(-1).end).toBeCloseTo(scene.duration);
});

test('the window is off stage during the intro and settled once the first beat is under way', () => {
  expect(scene.at(1).window.opacity).toBe(0);
  const settled = scene.at(plan.story.intro.duration + 2).window;
  expect(settled.opacity).toBeCloseTo(1);
  expect(settled.y).toBeCloseTo(0);
  expect(settled.rotateX).toBeCloseTo(0);
});

test('a new screen fades in over the previous one right after its beat starts, then stands alone', () => {
  const secondBeat = span(2).start;
  expect(scene.at(secondBeat - 0.1).screens).toMatchObject({ current: 'catalog', previous: null, mix: 1 });
  const during = scene.at(secondBeat + 0.1).screens;
  expect(during).toMatchObject({ current: 'product', previous: 'catalog' });
  expect(during.mix).toBeGreaterThan(0);
  expect(during.mix).toBeLessThan(1);
  expect(scene.at(secondBeat + 1).screens).toMatchObject({ current: 'product', previous: null, mix: 1 });
});

test('title words rise one after another and all rest in place once revealed', () => {
  const early = introAt(0.7).wordOffsets;
  expect(early[0]).toBeLessThan(early.at(-1) ?? 0);
  expect(introAt(2).wordOffsets.every((offset) => offset === 0)).toBe(true);
});

test('holds are reported as still and moves as moving, so blur is only sampled where it shows', () => {
  const firstBeat = span(1).start;
  expect(scene.isMoving(firstBeat + 0.5)).toBe(true);
  expect(scene.isMoving(firstBeat + 2.1)).toBe(false);
  expect(scene.isMoving(scene.duration - 0.2)).toBe(false);
});

test('any moment gives the same answer no matter what was asked before', () => {
  const direct = JSON.stringify(scene.at(12.3));
  scene.at(25);
  scene.at(3);
  expect(JSON.stringify(scene.at(12.3))).toBe(direct);
});

test('every on-screen text is listed for the messaging gate', () => {
  expect(scene.copy).toContain('Everyday objects, considered.');
  expect(scene.copy).toContain('Live availability');
  expect(scene.copy).toContain('Less, but better.');
});
