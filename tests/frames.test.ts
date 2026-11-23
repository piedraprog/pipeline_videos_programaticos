import { expect, test } from 'bun:test';
import { captureJobs, segmentKey, segmentRanges, shutterPlan } from '../engines/gsap/tools/frames.mjs';
import { createCursor, createTrack } from '../engines/gsap/lib/motion.js';

test('a 180 degree shutter keeps half of the sub-frames, and no shutter keeps them all', () => {
  expect(shutterPlan({ fps: 240, outFps: 30, shutter: 180 })).toEqual({ perFrame: 8, open: 4 });
  expect(shutterPlan({ fps: 60, outFps: 30 })).toEqual({ perFrame: 2, open: 2 });
});

test('scene ranges are contiguous and the last one reaches the end of the piece', () => {
  const segments = [
    { name: 'intro', start: 0, end: 3.4, source: 'a' },
    { name: 'beat', start: 3.4, end: 8.6, source: 'b' },
    { name: 'outro', start: 8.6, end: 12.19, source: 'c' },
  ];
  const ranges = segmentRanges(segments, 30, 366);
  expect(ranges.map((range: { first: number; end: number }) => [range.first, range.end])).toEqual([[0, 102], [102, 258], [258, 366]]);
});

test('a scene keeps its captured frames until its own inputs or its timing change', () => {
  const segment = { name: 'beat', start: 3.4, end: 8.6, source: 'camera to kpis' };
  const key = segmentKey('inputs-v1', segment);
  expect(segmentKey('inputs-v1', { ...segment })).toBe(key);
  expect(segmentKey('inputs-v1', { ...segment, source: 'camera to table' })).not.toBe(key);
  expect(segmentKey('inputs-v1', { ...segment, start: 3.9 })).not.toBe(key);
  expect(segmentKey('inputs-v2', segment)).not.toBe(key);
});

test('a moving frame is captured once per sample and a still frame once in total', () => {
  const jobs = captureJobs({ dir: 'cache', extension: 'jpg', frames: [10, 11], moving: [true, false], perFrame: 8, open: 4, fps: 240 });
  expect(jobs.map((job) => job.time)).toEqual([80 / 240, 81 / 240, 82 / 240, 83 / 240, 88 / 240]);
  expect(jobs.slice(0, 4).every((job) => job.copies.length === 0)).toBe(true);
  expect(jobs[4]?.copies).toHaveLength(3);
});

test('a track and a cursor report motion only while something is in progress', () => {
  const track = createTrack({ x: 0 }).to({ x: 10 }, 2, 1);
  expect([track.active(1.9), track.active(2.5), track.active(3.1)]).toEqual([false, true, false]);
  const element = { style: {}, append() {}, querySelector: () => ({ style: {} }) };
  globalThis.document = { createElement: () => element } as never;
  const cursor = createCursor({ parent: { append() {} }, color: '#000', start: { x: 0, y: 0 } });
  cursor.show(1).moveTo({ x: 50, y: 50 }, 4, 1).click(5.05);
  expect([cursor.isBusy(0.5), cursor.isBusy(1.1), cursor.isBusy(3), cursor.isBusy(4.5), cursor.isBusy(5.3), cursor.isBusy(6)]).toEqual([false, true, false, true, true, false]);
});
