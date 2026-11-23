import { expect, test } from 'bun:test';
import { applyPronunciation, cacheName, collectLines, findForbidden, findOverflows } from '../engines/gsap/tools/voice.mjs';
import { copiesNeeded, loopGraph } from '../engines/gsap/tools/music.mjs';

const plan = {
  story: {
    intro: { say: 'Hola.' },
    beats: [{ screen: 'a' }, { screen: 'b', say: 'Segunda pantalla.' }],
    outro: { say: 'Cierre.' },
  },
};
const meta = { cuts: [0, 3, 8, 12], scenes: ['intro', 'a-1', 'b-2', 'outro'], duration: 15 };

test('each narration line starts shortly after its scene begins and may run until the next narrated scene', () => {
  expect(collectLines(plan, meta)).toEqual([
    { scene: 'intro', text: 'Hola.', at: 0.4, sceneEnd: 8 },
    { scene: 'b-2', text: 'Segunda pantalla.', at: 8.4, sceneEnd: 12 },
    { scene: 'outro', text: 'Cierre.', at: 12.4, sceneEnd: 12.5 },
  ]);
});

test('a plan that no longer matches the rendered meta is rejected', () => {
  expect(() => collectLines(plan, { ...meta, cuts: [0, 3] })).toThrow('--qa-only');
});

test('a line that would still be talking when its scene ends is reported', () => {
  const lines = [
    { scene: 'intro', at: 0.4, duration: 2.0, sceneEnd: 3 },
    { scene: 'b-2', at: 8.4, duration: 3.5, sceneEnd: 12 },
  ];
  expect(findOverflows(lines).map((line: { scene: string }) => line.scene)).toEqual(['b-2']);
});

test('the audio cache changes with the text, the voice and the instructions', () => {
  const voice = { provider: 'openai', model: 'gpt-4o-mini-tts', voiceId: 'cedar', instructions: 'calm' };
  const name = cacheName(voice, 'Hola.');
  expect(name).toMatch(/^[0-9a-f]{16}\.mp3$/);
  expect(cacheName(voice, 'Hola.')).toBe(name);
  expect(cacheName(voice, 'Adiós.')).not.toBe(name);
  expect(cacheName({ ...voice, voiceId: 'marin' }, 'Hola.')).not.toBe(name);
  expect(cacheName({ ...voice, instructions: 'urgent' }, 'Hola.')).not.toBe(name);
  expect(cacheName({ ...voice, settings: { speed: 1.1 } }, 'Hola.')).not.toBe(name);
});

test('narration is held to the same forbidden-messaging list as on-screen copy', () => {
  expect(findForbidden([{ text: 'Prueba GRÁTIS hoy' }], ['gratis'])).toHaveLength(1);
  expect(findForbidden([{ text: 'Prueba hoy' }], ['gratis'])).toEqual([]);
});

test('a pronunciation override replaces whole words only and leaves the rest of the line alone', () => {
  expect(applyPronunciation('No se escribe en SAP.', { SAP: 'sap' })).toBe('No se escribe en sap.');
  expect(applyPronunciation('SAPIENS usa SAP', { SAP: 'sap' })).toBe('SAPIENS usa sap');
  expect(applyPronunciation('Sin cambios.', undefined)).toBe('Sin cambios.');
});

test('a track shorter than the piece is repeated just enough times, and a longer one is used once', () => {
  expect(copiesNeeded(45, 60)).toBe(1);
  expect(copiesNeeded(45, 30)).toBe(2);
  expect(copiesNeeded(90, 30)).toBe(4);
  expect(loopGraph(1, 60)).toEqual({ graph: [], last: '[0:a]' });
  expect(loopGraph(2, 30).last).toBe('[loop1]');
});

test('the last line must leave air before the piece ends, and sayAt delays a line inside its scene', () => {
  const closing = { story: { intro: {}, beats: [], outro: { say: 'Hasta aquí.', sayAt: 1.2 } } };
  const [line] = collectLines(closing, { cuts: [0, 10], scenes: ['intro', 'outro'], duration: 18 });
  expect(line).toMatchObject({ at: 11.2, sceneEnd: 15.5 });
  expect(findOverflows([{ ...line, duration: 4 }])).toEqual([]);
  expect(findOverflows([{ ...line, duration: 4.5 }])).toHaveLength(1);
});
