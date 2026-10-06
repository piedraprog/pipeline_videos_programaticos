import {Easing} from 'remotion';
import {linearTiming} from '@remotion/transitions';
import type {VideoManifest, VisualLayer} from '../src/schema';

export const getTransitionFrames = (previous:number,next:number,fps=30,seconds=0.6) => Math.min(Math.round(seconds*fps),Math.floor((previous-1)/2),Math.floor((next-1)/2));
export const getTransitionTiming = (previous:number,next:number,fps=30,seconds=0.6) => linearTiming({durationInFrames:getTransitionFrames(previous,next,fps,seconds),easing:Easing.inOut(Easing.cubic)});
export const getSceneStarts = (manifest:VideoManifest) => {
  let start=Math.round((manifest.visual.layers?.screenStartSeconds??0)*manifest.fps);
  return manifest.scenes.map((scene,index)=>{
    if(index>0)start-=getTransitionFrames(manifest.scenes[index-1]!.durationFrames,scene.durationFrames,manifest.fps,manifest.visual.motionStyle==='editorial'?0.35:0.6);
    const result=start;start+=scene.durationFrames;return result;
  });
};
export const getReelDuration = (manifest:VideoManifest) => manifest.visual.layers ? Math.round(manifest.visual.layers.durationSeconds*manifest.fps) : getSceneStarts(manifest).at(-1)!+manifest.scenes.at(-1)!.durationFrames;

const poseFields = ['x','y','z','scale','opacity','rotation','rotateX'] as const;
/** Seconds-based pure evaluation: seeking any frame produces the same independent pose. */
export const evaluateLayer = (layer:VisualLayer,frame:number,fps:number) => {
  const time=frame/fps-layer.start;
  const pose={x:layer.x??0,y:layer.y??0,z:layer.z??0,scale:layer.scale??1,opacity:layer.opacity??1,rotation:layer.rotation??0,rotateX:layer.rotateX??0};
  let previousTime=0;
  for(const key of layer.keyframes){
    const target={...pose};
    for(const field of poseFields)if(key[field]!==undefined)target[field]=key[field]!;
    if(time<key.time && key.time>previousTime){
      const t=Math.max(0,Math.min(1,(time-previousTime)/(key.time-previousTime)));
      const progress=key.ease==='linear'?t:key.ease==='snappy'?1-Math.pow(1-t,4):key.ease==='settle'?1+2.2*Math.pow(t-1,3)+1.2*Math.pow(t-1,2):t*t*(3-2*t);
      for(const field of poseFields)pose[field]+=(target[field]-pose[field])*progress;
      break;
    }
    Object.assign(pose,target);previousTime=key.time;
  }
  pose.opacity=Math.max(0,Math.min(1,pose.opacity));
  return {...pose,visible:time>=0 && frame<Math.round((layer.start+layer.duration)*fps)};
};
/** Stable array order breaks equal zIndex ties; every layer gets its own stacking context. */
export const getLayerOrder = (layers:VisualLayer[]) => [...layers].sort((a,b)=>a.zIndex-b.zIndex);
