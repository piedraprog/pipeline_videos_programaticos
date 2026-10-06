import { z } from 'zod';

const safeName = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens.');
// Explicit local paths are resolved relative to the input plan, never the process cwd.
const pageLocation = z.union([z.string().url(), z.string().regex(/^\.{1,2}\//, 'Use a URL or an explicit ./ or ../ local path.')]);

export const CaptureActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('navigate'), url: pageLocation }),
  z.object({ type: z.literal('click'), selector: z.string().min(1), dialog: z.object({ message: z.string().min(1) }).optional() }),
  z.object({ type: z.literal('waitFor'), selector: z.string().min(1), text: z.string().min(1).optional() }),
  z.object({ type: z.literal('scroll'), selector: z.string().min(1) }),
  z.object({ type: z.literal('screenshot'), selector: z.string().min(1).optional() }),
]);

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const finite = z.number().finite();
const pose = {
  x: finite.min(-2160).max(2160).optional(), y: finite.min(-3840).max(3840).optional(),
  z: finite.min(-2000).max(500).optional(), scale: finite.min(0.01).max(4).optional(),
  opacity: finite.min(0).max(1).optional(), rotation: finite.min(-360).max(360).optional(),
  rotateX: finite.min(-80).max(80).optional(),
};
const keyframe = z.object({time: finite.min(0), ...pose, ease: z.enum(['linear','smooth','snappy','settle']).default('smooth')}).strict();
const layerBase = {
  id: safeName, start: finite.min(0), duration: finite.positive(),
  zIndex: z.number().int().min(-100).max(100).default(0), ...pose,
  width: finite.positive().max(2160).optional(), height: finite.positive().max(3840).optional(),
  keyframes: z.array(keyframe).max(32).default([]),
};
export const LayerSchema = z.discriminatedUnion('type', [
  z.object({...layerBase, type:z.literal('background'), color, pattern:z.enum(['none','grid']).default('none')}).strict(),
  z.object({...layerBase, type:z.literal('graphic'), shape:z.enum(['disc','ring','slash']), color}).strict(),
  z.object({...layerBase, type:z.literal('foreground'), shape:z.enum(['disc','ring','slash']), color}).strict(),
  z.object({...layerBase, type:z.literal('subject')}).strict(),
  z.object({...layerBase, type:z.literal('text'), text:z.string().trim().min(1).max(160), color,
    fontSize:finite.min(16).max(160).default(60), align:z.enum(['left','center','right']).default('left')}).strict(),
  z.object({...layerBase, type:z.literal('logo'), text:z.string().trim().min(1).max(40), color,
    fontSize:finite.min(16).max(240).default(120), align:z.enum(['left','center','right']).default('center')}).strict(),
]);
export const LayersSchema = z.object({
  durationSeconds:finite.positive().max(600), screenStartSeconds:finite.min(0),
  tracks:z.array(LayerSchema).min(1).max(64),
}).strict().superRefine((layers,ctx)=>{
  const ids=new Set<string>();
  layers.tracks.forEach((track,index)=>{
    const path=['tracks',index];
    if(ids.has(track.id))ctx.addIssue({code:'custom',path:[...path,'id'],message:`Duplicate layer id "${track.id}".`});
    ids.add(track.id);
    if(track.start+track.duration>layers.durationSeconds+1e-8)ctx.addIssue({code:'custom',path,message:'Layer ends outside composition durationSeconds.'});
    let previous=-1;
    for(const [i,key] of track.keyframes.entries()){
      if(key.time<=previous || key.time>track.duration)ctx.addIssue({code:'custom',path:[...path,'keyframes',i],message:'Keyframe times must strictly increase and fit within layer duration.'});
      previous=key.time;
    }
  });
  if(layers.tracks.filter(t=>t.type==='subject').length!==1)ctx.addIssue({code:'custom',path:['tracks'],message:'Layers require exactly one subject (phone and screen group).'});
});
export const VisualSchema = z.object({
  accentColor:color.default('#67e8c1'), backgroundStyle:z.enum(['aurora','midnight','warm']).default('aurora'),
  motionStyle:z.enum(['classic','editorial']).default('classic'), layers:LayersSchema.optional(),
}).strict().superRefine((visual,ctx)=>{
  if(visual.layers && visual.motionStyle!=='editorial')ctx.addIssue({code:'custom',path:['layers'],message:'Layers require motionStyle "editorial"; classic does not support layers.'});
});
const visualDefault={accentColor:'#67e8c1',backgroundStyle:'aurora' as const,motionStyle:'classic' as const};
// Kept schema-local to avoid importing React/render code into the Node capture runtime.
const validateLayerClock=(data:{visual:z.infer<typeof VisualSchema>;fps:number;scenes:{durationFrames:number}[]},ctx:z.RefinementCtx)=>{
  const layers=data.visual.layers;
  if(!layers)return;
  let frames=data.scenes.reduce((sum,scene)=>sum+scene.durationFrames,0);
  for(let i=1;i<data.scenes.length;i++)frames-=Math.min(Math.round(0.35*data.fps),Math.floor((data.scenes[i-1]!.durationFrames-1)/2),Math.floor((data.scenes[i]!.durationFrames-1)/2));
  const screenStart=Math.round(layers.screenStartSeconds*data.fps);
  const subject=layers.tracks.find(track=>track.type==='subject');
  if(subject && (Math.round(subject.start*data.fps)>screenStart || Math.round((subject.start+subject.duration)*data.fps)<screenStart+frames))ctx.addIssue({code:'custom',path:['visual','layers','tracks'],message:'Subject must cover the complete delayed screen timeline.'});
  if(Math.round(layers.durationSeconds*data.fps)<1)ctx.addIssue({code:'custom',path:['visual','layers','durationSeconds'],message:'Composition duration must be at least one frame.'});
  if(Math.round(layers.screenStartSeconds*data.fps)+frames>Math.round(layers.durationSeconds*data.fps))ctx.addIssue({code:'custom',path:['visual','layers','durationSeconds'],message:'Composition must contain the complete screen timeline after screenStartSeconds.'});
};

export const VideoPlanSchema = z.object({
  projectName: safeName,
  title: z.string().trim().min(1).max(80).default('Product demo'),
  subtitle: z.string().trim().max(120).default('A closer look at the experience'),
  visual: VisualSchema.default(visualDefault),
  baseUrl: pageLocation,
  viewport: z.object({ width: z.number().int().positive().default(390), height: z.number().int().positive().default(844) }).default({ width: 390, height: 844 }),
  fps: z.number().int().min(1).max(60).default(30),
  scenes: z.array(z.object({
    id: safeName,
    title: z.string().trim().min(1).max(60).optional(),
    caption: z.string().trim().max(100).optional(),
    durationFrames: z.number().int().positive(),
    actions: z.array(CaptureActionSchema).min(1),
  })).min(1),
}).superRefine((plan, ctx) => {
  validateLayerClock(plan,ctx);
  const ids = new Set<string>();
  for (const [index, scene] of plan.scenes.entries()) {
    if (ids.has(scene.id)) ctx.addIssue({ code: 'custom', path: ['scenes', index, 'id'], message: `Duplicate scene id "${scene.id}".` });
    ids.add(scene.id);
    if (scene.actions.filter((action) => action.type === 'screenshot').length !== 1) {
      ctx.addIssue({ code: 'custom', path: ['scenes', index, 'actions'], message: 'Each scene must include exactly one screenshot action.' });
    }
  }
});

export const ManifestSchema = z.object({
  projectName: safeName,
  title: z.string().trim().min(1).max(80).default('Product demo'),
  subtitle: z.string().trim().max(120).default('A closer look at the experience'),
  visual: VisualSchema.default(visualDefault),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scenes: z.array(z.object({ id: safeName, title: z.string().trim().min(1).max(60).optional(), caption: z.string().trim().max(100).optional(), asset: z.string().min(1), durationFrames: z.number().int().positive() })).min(1),
}).superRefine(validateLayerClock);

export type VideoPlan = z.infer<typeof VideoPlanSchema>;
export type CaptureAction = z.infer<typeof CaptureActionSchema>;
export type VideoManifest = z.infer<typeof ManifestSchema>;

export type VisualLayer = z.infer<typeof LayerSchema>;
