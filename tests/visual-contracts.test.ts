import {test, expect} from 'bun:test';
import {VideoPlanSchema} from '../src/schema';
import {getSceneStarts, getReelDuration, getTransitionFrames, getTransitionTiming} from '../templates/AgnosticReel';
import {ManifestSchema} from '../src/schema';

test('exactly one screenshot is required', () => {
  const plan = { projectName: 'test', baseUrl: 'https://example.com', scenes: [{id: 'one', durationFrames: 30, actions: [{type: 'screenshot'}, {type: 'screenshot'}]}] };
  expect(VideoPlanSchema.safeParse(plan).success).toBe(false);
});
test('mobile viewport and explicit readiness/dialog contracts', () => {
  const plan = VideoPlanSchema.parse({ projectName: 'test', baseUrl: 'https://example.com', scenes: [{id: 'one', durationFrames: 30, actions: [{type: 'waitFor', selector: '#item', text: 'Loaded'}, {type: 'click', selector: '#add', dialog: {message: 'Added'}}, {type: 'screenshot'}]}] });
  expect(plan.viewport).toEqual({width: 390, height: 844});
});
test('short scenes never have overlapping transitions or zero durations', () => {
  const manifest = ManifestSchema.parse({projectName: 'test', fps:30, width:1080, height:1920, scenes: [1,2,3,30].map((durationFrames, index) => ({id: `scene-${index}`, asset: 'test.png', durationFrames}))});
  expect(getTransitionFrames(1, 30)).toBe(0);
  expect(getSceneStarts(manifest)).toEqual([0,1,3,5]);
  expect(getReelDuration(manifest)).toBe(35);
});
test('normal scene duration subtracts precisely the screen transition overlaps', () => {
  const manifest = ManifestSchema.parse({projectName: 'test', fps:30, width:1080, height:1920, scenes: [90,90,90].map((durationFrames,index) => ({id:`scene-${index}`, asset:'test.png', durationFrames}))});
  expect(getSceneStarts(manifest)).toEqual([0,72,144]);
  expect(getReelDuration(manifest)).toBe(234);
});

test('screen slides ease in and out without changing the shared overlap duration', () => {
  const timing = getTransitionTiming(90, 90);
  expect(timing.getDurationInFrames({fps: 30})).toBe(getTransitionFrames(90, 90));
  expect(timing.getProgress({frame: 0, fps: 30})).toBe(0);
  expect(timing.getProgress({frame: 9, fps: 30})).toBeCloseTo(0.5);
  expect(timing.getProgress({frame: 18, fps: 30})).toBe(1);
  expect(timing.getProgress({frame: 3, fps: 30})).toBeLessThan(3 / 18);
  expect(timing.getProgress({frame: 15, fps: 30})).toBeGreaterThan(15 / 18);
});
