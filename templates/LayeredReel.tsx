import React, {useEffect, useState} from 'react';
import {Easing,Img,Sequence,cancelRender,continueRender,delayRender,staticFile,useCurrentFrame} from 'remotion';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import type {VideoManifest,VisualLayer} from '../src/schema';
import {evaluateLayer,getLayerOrder,getSceneStarts,getTransitionFrames} from './timing';

const Screen:React.FC<{manifest:VideoManifest}>=({manifest})=><TransitionSeries>
  {manifest.scenes.flatMap((scene,index)=>{
    const image=<TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationFrames}><Img src={staticFile(scene.asset)} alt={scene.title??scene.id} style={{width:'100%',height:'100%',objectFit:'contain',background:'#f5f1e7'}}/></TransitionSeries.Sequence>;
    if(index===0)return [image];
    const overlap=getTransitionFrames(manifest.scenes[index-1]!.durationFrames,scene.durationFrames,manifest.fps,0.35);
    return overlap>0?[<TransitionSeries.Transition key={`slide-${scene.id}`} presentation={slide({direction:index%2?'from-right':'from-bottom'})} timing={linearTiming({durationInFrames:overlap,easing:Easing.bezier(0.76,0,0.24,1)})}/>,image]:[image];
  })}
</TransitionSeries>;

export const getLayerLetterSpacing=(layer:Extract<VisualLayer,{type:'text'|'logo'}>)=>layer.type==='logo'?(layer.fontSize>=80?-6:2):layer.fontSize>=40?-1.5:0;

const Content:React.FC<{layer:VisualLayer;manifest:VideoManifest;frame:number}>=({layer,manifest,frame})=>{
  if(layer.type==='background')return <div style={{width:'100%',height:'100%',backgroundColor:layer.color,backgroundImage:layer.pattern==='grid'?'linear-gradient(#faf8ef0a 1px,transparent 1px),linear-gradient(90deg,#faf8ef0a 1px,transparent 1px)':undefined,backgroundSize:'90px 90px'}}/>;
  if(layer.type==='graphic'||layer.type==='foreground')return <div style={{width:'100%',height:'100%',boxSizing:'border-box',background:layer.shape==='ring'?'transparent':layer.color,border:layer.shape==='ring'?`2px solid ${layer.color}`:undefined,borderRadius:layer.shape==='slash'?0:'50%',clipPath:layer.shape==='slash'?'polygon(0 60%,100% 0,100% 25%,0 85%)':undefined}}/>;
  if(layer.type==='text'||layer.type==='logo')return <div style={{color:layer.color,fontSize:layer.fontSize,fontWeight:layer.type==='logo'?800:700,lineHeight:1.08,letterSpacing:getLayerLetterSpacing(layer),textAlign:layer.align,whiteSpace:'pre-line',overflowWrap:'anywhere'}}>{layer.text}</div>;
  const from=Math.round(manifest.visual.layers!.screenStartSeconds*manifest.fps);
  const starts=getSceneStarts(manifest);
  const length=starts.at(-1)!+manifest.scenes.at(-1)!.durationFrames-from;
  return <div style={{width:'100%',height:'100%',padding:12,border:'12px solid #18211f',boxSizing:'border-box',borderRadius:60,background:'#18211f',boxShadow:'0 40px 80px #0006,inset 0 0 0 2px #65736d'}}>
    <div style={{width:'100%',height:'100%',position:'relative',borderRadius:36,overflow:'hidden',isolation:'isolate',background:'#f5f1e7'}}>
      {frame<from && <Img src={staticFile(manifest.scenes[0]!.asset)} alt={manifest.scenes[0]!.title??'Catalog'} style={{width:'100%',height:'100%',objectFit:'contain'}}/>}
      <Sequence from={from} durationInFrames={length} premountFor={manifest.fps}><Screen manifest={manifest}/></Sequence>
      {frame>=from+length && <Img src={staticFile(manifest.scenes.at(-1)!.asset)} alt="Final browser state" style={{width:'100%',height:'100%',objectFit:'contain'}}/>}
    </div>
  </div>;
};

/** Each track has a private local clock. Screen changes never trigger another layer. */
export const LayeredReel:React.FC<{manifest:VideoManifest}>=({manifest})=>{
  const frame=useCurrentFrame();
  const [fontHandle]=useState(()=>delayRender('Loading bundled layer typography'));
  useEffect(()=>{document.fonts.load('800 64px "Demo Sans"').then(()=>continueRender(fontHandle)).catch(cancelRender);},[fontHandle]);
  return <div style={{position:'relative',width:1080,height:1920,overflow:'hidden',isolation:'isolate',perspective:1400,background:'#092c28',fontFamily:'"Demo Sans",sans-serif'}}>
    <style>{`@font-face{font-family:"Demo Sans";src:url("${staticFile('demos/studio-store/fonts/manrope.ttf')}") format("truetype");font-weight:200 800;font-display:block;}`}</style>
    {getLayerOrder(manifest.visual.layers!.tracks).map(layer=>{
      const pose=evaluateLayer(layer,frame,manifest.fps);
      const width=layer.width??(layer.type==='subject'?610:layer.type==='background'?1080:896);
      const height=layer.height??(layer.type==='subject'?1300:layer.type==='background'?1920:undefined);
      return <div key={layer.id} data-layer={layer.id} style={{position:'absolute',left:0,top:0,width,height,zIndex:layer.zIndex,isolation:'isolate',opacity:pose.visible?pose.opacity:0,visibility:pose.visible?'visible':'hidden',transform:`translate3d(${pose.x}px,${pose.y}px,${pose.z}px) rotateX(${pose.rotateX}deg) rotate(${pose.rotation}deg) scale(${pose.scale})`,transformOrigin:'50% 50%',pointerEvents:'none'}}><Content layer={layer} manifest={manifest} frame={frame}/></div>;
    })}
  </div>;
};
