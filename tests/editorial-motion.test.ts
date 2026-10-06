import {expect, test} from 'bun:test';
import {ManifestSchema, VideoPlanSchema} from '../src/schema';
import {getTransitionFrames, getSceneStarts, getReelDuration} from '../templates/AgnosticReel';

test('editorial visual settings survive schema parsing', () => {
  const plan = VideoPlanSchema.parse({projectName:'test', baseUrl:'https://example.com', visual:{motionStyle:'editorial'}, scenes:[{id:'one',durationFrames:120,actions:[{type:'screenshot'}]}]});
  expect(plan.visual.motionStyle).toBe('editorial');
});

test('transition duration scales with fps rather than halving real-time motion', () => {
  expect(getTransitionFrames(180,180,60)).toBe(36);
});

test('editorial scenes share precise 0.35 second overlaps at 60fps', () => {
  const manifest = ManifestSchema.parse({projectName:'test',fps:60,width:1080,height:1920,visual:{motionStyle:'editorial'},scenes:[180,180,180].map((durationFrames,i)=>({id:`scene-${i}`,asset:'a.png',durationFrames}))});
  expect(getSceneStarts(manifest)).toEqual([0,159,318]);
  expect(getReelDuration(manifest)).toBe(498);
});

test('local store demo plan is portable and contains checkout confirmation', async () => {
  const source = await Bun.file('plans/studio-store.json').json().catch(()=>({fps:0,scenes:[]}));
  expect(source.fps).toBe(60);
  expect(source.baseUrl).toBe('../demos/studio-store/index.html');
  expect(source.scenes.at(-1).actions).toContainEqual({type:'waitFor',selector:'#confirmation',text:'Order confirmed'});
});

test('plans accept explicit relative local HTML paths', () => {
  expect(VideoPlanSchema.safeParse({projectName:'test',baseUrl:'../demos/store.html',scenes:[{id:'one',durationFrames:120,actions:[{type:'screenshot'}]}]}).success).toBe(true);
});
