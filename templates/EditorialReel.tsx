import React, {useEffect, useState} from 'react';
import {useGsapTimeline} from '@remotion/gsap';
import {Easing, Img, Sequence, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import type {VideoManifest} from '../src/schema';
import {getReelDuration, getSceneStarts, getTransitionFrames} from './timing';

const palettes = {aurora:'#092c28', midnight:'#121b36', warm:'#34241d'};
const ease = Easing.bezier(0.76, 0, 0.24, 1);

const Header: React.FC<{manifest:VideoManifest; index:number; duration:number}> = ({manifest,index,duration}) => {
  const scene = manifest.scenes[index]!;
  const words = (scene.title ?? scene.id.replaceAll('-', ' ')).split(' ');
  const titleSize = Math.max(40,64-Math.max(0,words.join(' ').length-32)*0.75);
  const scope = useGsapTimeline<HTMLDivElement>(({timeline,selector}) => {
    timeline.fromTo(selector('[data-word]'), {y:54, rotation:3, opacity:0.25},
      {y:0,rotation:0,opacity:1,duration:0.34,stagger:Math.min(0.045,0.2 / words.length),ease:'power3.out'},0);
    timeline.fromTo(selector('[data-caption]'),{y:16,opacity:0.3},{y:0,opacity:1,duration:0.25,ease:'power2.out'},0.12);
    timeline.fromTo(selector('[data-line]'),{scaleX:0.08},{scaleX:1,duration:0.35,ease:'power3.out'},0.04);
    // The next header starts at the screen overlap; finish this one beforehand.
    if (duration > 0.8) timeline.to(selector('[data-copy]'),{y:-14,opacity:0,duration:0.14,ease:'power2.in'},duration-0.14);
  }, {dependencies:[scene.id,duration,words.length]});
  return <div ref={scope} style={{position:'absolute',left:92,right:92,top:105}}>
    <div style={{display:'flex',alignItems:'center',gap:16,color:manifest.visual.accentColor,fontSize:23,fontWeight:700,letterSpacing:4,textTransform:'uppercase'}}>
      <span>{manifest.title}</span><span style={{height:1,flex:1,background:'currentColor',opacity:0.35}}/><span>{String(index+1).padStart(2,'0')}</span>
    </div>
    <div data-copy>
      <div style={{fontSize:titleSize,lineHeight:1.06,fontWeight:800,letterSpacing:-2.5,marginTop:23,maxWidth:880}}>
        {words.map((word,i)=><span key={i} style={{display:'inline-block',overflow:'hidden',verticalAlign:'bottom',paddingRight:14,paddingBottom:5}}><span data-word style={{display:'inline-block'}}>{word}</span></span>)}
      </div>
      <div data-line style={{height:5,width:96,background:manifest.visual.accentColor,transformOrigin:'left center',marginTop:21}}/>
      <div data-caption style={{fontSize:26,lineHeight:1.3,opacity:0.8,marginTop:18,maxWidth:850}}>{scene.caption ?? manifest.subtitle}</div>
    </div>
  </div>;
};

/** A scene-beat choreography, not a looping background or a simulated UI recording. */
export const EditorialReel: React.FC<{manifest:VideoManifest}> = ({manifest}) => {
  const [fontHandle] = useState(()=>delayRender('Loading bundled editorial font'));
  useEffect(()=>{
    document.fonts.load('800 64px "Demo Sans"').then(()=>continueRender(fontHandle)).catch(cancelRender);
  },[fontHandle]);
  const frame = useCurrentFrame();
  const starts = getSceneStarts(manifest);
  const duration = getReelDuration(manifest);
  const active = starts.reduce((result,start,index)=>frame>=start?index:result,0);
  const scope = useGsapTimeline<HTMLDivElement>(({timeline,selector})=>{
    timeline.fromTo(selector('[data-device]'),{y:84,scale:0.93,rotation:-2},
      {y:0,scale:1,rotation:0,duration:0.55,ease:'back.out(1.15)'},0);
    timeline.fromTo(selector('[data-disc]'),{x:220,scale:0.8,rotation:-30},
      {x:0,scale:1,rotation:0,duration:0.5,ease:'power3.out'},0);
    starts.slice(1).forEach((start,i)=>{
      const time = start / manifest.fps;
      const direction = i % 2 === 0 ? 1 : -1;
      timeline.to(selector('[data-device]'),{x:direction*16,rotation:direction*0.65,scale:i===starts.length-2?1.025:1,duration:0.42,ease:'power3.inOut'},time);
      timeline.to(selector('[data-disc]'),{x:direction*130,y:direction*75,rotation:(i+1)*45,duration:0.45,ease:'power3.inOut'},time);
      timeline.to(selector('[data-slash]'),{x:direction*85,y:-i*26,duration:0.4,ease:'power3.inOut'},time);
    });
  },{dependencies:[manifest.fps,starts.join(',')]});
  const finalOpacity = interpolate(frame,[Math.max(0,duration-manifest.fps*0.25),duration-1],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return <div ref={scope} style={{width:1080,height:1920,position:'relative',overflow:'hidden',background:palettes[manifest.visual.backgroundStyle],color:'#faf8ef',fontFamily:'"Demo Sans", sans-serif'}}>
    <style>{`@font-face {font-family:"Demo Sans";src:url("${staticFile('demos/studio-store/fonts/manrope.ttf')}") format("truetype");font-weight:200 800;font-display:block;}`}</style>
    <svg aria-hidden="true" viewBox="0 0 1080 1920" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs><pattern id="editorial-grid" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M90 0H0V90" fill="none" stroke="#faf8ef" strokeOpacity="0.055"/></pattern></defs>
      <rect width="1080" height="1920" fill="url(#editorial-grid)"/>
      <g data-disc style={{transformOrigin:'820px 880px'}}><circle cx="820" cy="880" r="475" fill={manifest.visual.accentColor} opacity="0.11"/><circle cx="820" cy="880" r="430" stroke={manifest.visual.accentColor} strokeWidth="2" fill="none" opacity="0.38"/><path d="M820 395V450M820 1310V1365M335 880H390M1250 880H1305" stroke={manifest.visual.accentColor} strokeWidth="8"/></g>
      <g data-slash fill={manifest.visual.accentColor} opacity="0.8"><path d="M-100 1500L160 1330L160 1398L-100 1568Z"/><path d="M940 570L1200 400V425L940 595Z"/></g>
    </svg>
    {manifest.scenes.map((scene,index)=>{
      const length=(starts[index+1]??duration)-starts[index]!;
      return <Sequence key={scene.id} from={starts[index]} durationInFrames={length}><Header manifest={manifest} index={index} duration={index===manifest.scenes.length-1?0:length/manifest.fps}/></Sequence>;
    })}
    <div data-device style={{position:'absolute',top:450,left:235,width:610,height:1300,padding:12,border:'12px solid #18211f',boxSizing:'border-box',borderRadius:60,background:'#18211f',boxShadow:'0 40px 80px #0006, inset 0 0 0 2px #65736d',transformOrigin:'50% 60%'}}>
      <div style={{width:'100%',height:'100%',position:'relative',borderRadius:36,overflow:'hidden',background:'#f5f1e7'}}>
        <TransitionSeries>{manifest.scenes.flatMap((scene,index)=>{
          const sequence=<TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationFrames}><Img src={staticFile(scene.asset)} alt={scene.title??scene.id} style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',background:'#f5f1e7'}}/></TransitionSeries.Sequence>;
          if(index===0)return [sequence];
          const overlap=getTransitionFrames(manifest.scenes[index-1]!.durationFrames,scene.durationFrames,manifest.fps,0.35);
          return overlap>0?[<TransitionSeries.Transition key={`transition-${scene.id}`} presentation={slide({direction:index%2?'from-right':'from-bottom'})} timing={linearTiming({durationInFrames:overlap,easing:ease})}/>,sequence]:[sequence];
        })}</TransitionSeries>
      </div>
    </div>
    <div style={{position:'absolute',left:92,right:92,bottom:72,display:'flex',gap:16,alignItems:'center'}}>
      <span style={{fontSize:20,letterSpacing:3,fontWeight:700}}>THE EXPERIENCE</span>
      <div style={{display:'flex',flex:1,gap:8}}>{starts.map((start,index)=><div key={start} style={{height:5,flex:1,background:'#ffffff26',overflow:'hidden'}}><div style={{height:'100%',background:manifest.visual.accentColor,width:`${interpolate(frame,[start,(starts[index+1]??duration)-1],[0,100],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}%`}}/></div>)}</div>
      <span style={{fontSize:20,fontVariantNumeric:'tabular-nums'}}>{String(active+1).padStart(2,'0')} / {String(starts.length).padStart(2,'0')}</span>
    </div>
    <div aria-hidden="true" style={{position:'absolute',inset:0,boxShadow:`inset 0 0 0 ${4*finalOpacity}px ${manifest.visual.accentColor}`}}/>
  </div>;
};
