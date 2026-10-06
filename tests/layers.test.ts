import {expect,test} from 'bun:test';
import {VideoPlanSchema,ManifestSchema} from '../src/schema';
const layers={durationSeconds:4,screenStartSeconds:1,tracks:[{id:'background',type:'background',start:0,duration:4,color:'#092c28'},{id:'phone',type:'subject',start:0.7,duration:3.3,keyframes:[{time:0,scale:0.5,opacity:0,z:-600},{time:0.5,scale:1,opacity:1,z:0}]}]};
const input=()=>({projectName:'test',baseUrl:'https://example.com',fps:60,visual:{motionStyle:'editorial',layers},scenes:[{id:'one',durationFrames:120,actions:[{type:'screenshot'}]}]});
test('independent layer timeline survives plan and manifest parsing',()=>{
 const plan=VideoPlanSchema.parse(input());
 expect(plan.visual.layers).toEqual(expect.objectContaining({screenStartSeconds:1}));
 const manifest=ManifestSchema.parse({projectName:'test',fps:60,width:1080,height:1920,visual:plan.visual,scenes:[{id:'one',asset:'a.png',durationFrames:120}]});
 expect(manifest.visual.layers!.tracks[1]!.start).toBe(0.7);
});
test('strict layers reject duplicate IDs, invalid clock ranges and incompatible classic mode',()=>{
 for(const change of [ {tracks:[...layers.tracks,layers.tracks[0]]}, {durationSeconds:1}, {screenStartSeconds:-1}, {tracks:[{...layers.tracks[0],start:3,duration:2},layers.tracks[1]]}, {tracks:[{...layers.tracks[0],typo:true},layers.tracks[1]]}, {tracks:[layers.tracks[0],{...layers.tracks[1],keyframes:[{time:1},{time:0}]}]}, {tracks:[layers.tracks[0],{...layers.tracks[1],scale:Infinity}]} ]) {
  const raw={...input(),visual:{...input().visual,layers:{...layers,...change}}}; expect(VideoPlanSchema.safeParse(raw).success).toBe(false);
 }
 const raw=input();raw.visual.motionStyle='classic';expect(VideoPlanSchema.safeParse(raw).success).toBe(false);
});
import * as motion from '../templates/timing';
import {LayerSchema} from '../src/schema';
test('layer evaluator provides independent start clocks and explicit stacking',()=>{
 expect(typeof motion.evaluateLayer).toBe('function');
 const phone=LayerSchema.parse(layers.tracks[1]);
 const evaluate=motion.evaluateLayer;
 expect(evaluate(phone,0.5*60,60).visible).toBe(false);
 expect(evaluate(phone,0.7*60,60).scale).toBe(0.5);
 expect(evaluate(phone,1.2*60,60).scale).toBe(1);
 expect(evaluate(phone,1.2*30,30)).toEqual(evaluate(phone,1.2*60,60));
 const stationary=LayerSchema.parse({id:'bg',type:'background',start:0,duration:4,color:'#092c28',zIndex:-2});
 expect(evaluate(stationary,60,60).x).toBe(0);
 expect(motion.getLayerOrder([phone,stationary]).map(t=>t.id)).toEqual(['bg','phone']);
});
test('layer composition duration includes intro and delayed screen without changing old manifests',()=>{
 const manifest=ManifestSchema.parse({projectName:'test',fps:60,width:1080,height:1920,visual:{motionStyle:'editorial',layers},scenes:[{id:'one',asset:'a.png',durationFrames:120}]});
 expect(motion.getReelDuration(manifest)).toBe(240);
 expect(motion.getSceneStarts(manifest)).toEqual([60]);
 const old=ManifestSchema.parse({...manifest,visual:{motionStyle:'editorial'}});
 expect(motion.getReelDuration(old)).toBe(120);
 expect(motion.getSceneStarts(old)).toEqual([0]);
});
test('clock validation rejects hidden screen playback and sub-frame composition duration',()=>{
 const raw={...input(),visual:{...input().visual,layers:{...layers,tracks:[layers.tracks[0],{...layers.tracks[1],start:1.5,duration:2.5}]}}};
 expect(VideoPlanSchema.safeParse(raw).success).toBe(false);
 const short={projectName:'tiny',baseUrl:'https://example.com',fps:60,visual:{motionStyle:'editorial',layers:{durationSeconds:0.001,screenStartSeconds:0,tracks:[{id:'phone',type:'subject',start:0,duration:0.001}]}},scenes:[{id:'one',durationFrames:1,actions:[{type:'screenshot'}]}]};
 expect(VideoPlanSchema.safeParse(short).success).toBe(false);
});
test('layer seeking holds static backgrounds and keeps text timing independent of screen changes',()=>{
 const text=LayerSchema.parse({id:'title',type:'text',text:'A later thought',color:'#faf8ef',start:1.8,duration:1.2,x:92,y:155,keyframes:[{time:0,opacity:0,y:195},{time:0.3,opacity:1,y:155,ease:'snappy'}]});
 expect(motion.evaluateLayer(text,90,60).visible).toBe(false);
 expect(motion.evaluateLayer(text,126,60).opacity).toBeCloseTo(1);
 expect(motion.evaluateLayer(text,180,60).visible).toBe(false);
 expect(motion.evaluateLayer(text,117,60).y).toBeCloseTo(157.5);
});
import * as layered from '../templates/LayeredReel';
test('small docked logo and captions keep readable tracking instead of oversized-logo compression',()=>{
 expect(typeof layered.getLayerLetterSpacing).toBe('function');
 const dock=LayerSchema.parse({id:'dock',type:'logo',text:'FORM / EVERYDAY OBJECTS',color:'#d7fb56',fontSize:23,start:0,duration:1});
 const caption=LayerSchema.parse({id:'caption',type:'text',text:'Readable caption',color:'#faf8ef',fontSize:27,start:0,duration:1});
 if(dock.type!=='logo'||caption.type!=='text')throw new Error('Unexpected copy layer type');
 expect(layered.getLayerLetterSpacing(dock)).toBe(2);
 expect(layered.getLayerLetterSpacing(caption)).toBe(0);
});
test('added confirmation caption has a concise message and at least 0.8 seconds fully readable',async()=>{
 const plan=VideoPlanSchema.parse(await Bun.file('plans/studio-store.json').json());
 const caption=plan.visual.layers!.tracks.find(track=>track.id==='added-caption')!;
 expect(caption.type==='text' ? caption.text : '').toBe('Bag updated.');
 const full=caption.keyframes.filter(key=>key.opacity===1);
 expect(full.at(-1)!.time-full[0]!.time).toBeGreaterThanOrEqual(0.8);
 const next=plan.visual.layers!.tracks.find(track=>track.id==='cart-heading')!;
 expect(caption.start+caption.duration).toBeLessThanOrEqual(next.start);
});
