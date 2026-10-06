import React from 'react';
import { useGsapTimeline } from '@remotion/gsap';
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import type { VideoManifest } from '../src/schema';

export type AgnosticReelProps = { manifest: VideoManifest };
const TRANSITION_FRAMES = 12;
const colors = {
  aurora: { base: '#071014', glow: '#174a4b', secondary: '#102e43' },
  midnight: { base: '#090b16', glow: '#243467', secondary: '#311d48' },
  warm: { base: '#17100e', glow: '#573526', secondary: '#35213b' },
} as const;

const PhoneMockup: React.FC<{ src: string; label: string }> = ({ src, label }) => (
  <div data-phone style={{
    width: 590, height: 1240, boxSizing: 'border-box', border: '18px solid #17191d',
    borderRadius: 76, backgroundColor: '#090a0c', padding: '32px 18px',
    boxShadow: '0 36px 100px rgba(0,0,0,0.48), inset 0 0 0 2px #44474d',
    position: 'relative', overflow: 'hidden',
  }}>
    <div aria-hidden="true" style={{ position: 'absolute', zIndex: 2, top: 16, left: '50%', transform: 'translateX(-50%)', width: 130, height: 28, borderRadius: 20, background: '#090a0c' }} />
    <div style={{ width: '100%', height: '100%', borderRadius: 42, overflow: 'hidden', background: '#fff' }}>
      <Img src={staticFile(src)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  </div>
);

const AnimatedBackground: React.FC<{ sceneIndex: number; manifest: VideoManifest }> = ({ sceneIndex, manifest }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = colors[manifest.visual.backgroundStyle];
  const cycle = (frame / (fps * 9)) * Math.PI * 2;
  const driftX = Math.sin(cycle + sceneIndex * 0.71) * 76;
  const driftY = Math.cos(cycle * 0.72 + sceneIndex * 0.43) * 92;
  const pulse = interpolate(Math.sin(cycle * 0.55 + sceneIndex), [-1, 1], [0.12, 0.24]);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: palette.base }}>
      <div style={{ position: 'absolute', inset: -180, background: `radial-gradient(ellipse at 50% 42%, ${palette.glow} 0%, ${palette.base} 58%, #050609 100%)`, transform: `translate(${driftX * 0.2}px, ${driftY * 0.2}px) scale(1.08)` }} />
      <div style={{ position: 'absolute', width: 740, height: 740, borderRadius: '50%', left: `calc(50% - 370px + ${driftX}px)`, top: `calc(12% + ${driftY}px)`, background: `radial-gradient(circle, ${manifest.visual.accentColor} 0%, transparent 70%)`, opacity: pulse, filter: 'blur(42px)' }} />
      <div style={{ position: 'absolute', width: 940, height: 940, borderRadius: '50%', left: `calc(50% - 470px - ${driftX * 0.55}px)`, bottom: -500 - driftY * 0.35, background: `radial-gradient(circle, ${palette.secondary} 0%, transparent 68%)`, opacity: 0.4, filter: 'blur(52px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12), transparent 32%, rgba(0,0,0,0.28))' }} />
    </div>
  );
};

const Scene: React.FC<{ scene: VideoManifest['scenes'][number]; index: number; manifest: VideoManifest }> = ({ scene, index, manifest }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const floatY = Math.sin((frame / (fps * 3)) * Math.PI * 2) * 6;
  const title = scene.title ?? scene.id.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    // The Remotion GSAP adapter owns playback and seeks this paused timeline per frame.
    timeline.fromTo(selector('[data-scene-title]'), { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.72, ease: 'power3.out' }, 0);
    timeline.fromTo(selector('[data-scene-rule]'), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.56, ease: 'power2.out' }, 0.18);
    timeline.fromTo(selector('[data-phone]'), { y: 54, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'power3.out' }, 0.08);
  }, { dependencies: [scene.id, title] });

  return (
    <div ref={scope} style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', color: '#f6f8fa', fontFamily: 'Arial, sans-serif' }}>
      <AnimatedBackground sceneIndex={index} manifest={manifest} />
      <div style={{ position: 'absolute', zIndex: 2, top: 142, left: 100, right: 100, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: manifest.visual.accentColor, marginBottom: 20 }}>{manifest.title}</div>
        <div data-scene-title style={{ fontSize: 54, lineHeight: 1.12, fontWeight: 700, letterSpacing: -1.5 }}>{title}</div>
        <div data-scene-rule style={{ width: 84, height: 4, margin: '24px auto 0', borderRadius: 4, background: manifest.visual.accentColor, transformOrigin: 'center' }} />
        {scene.caption || (index === 0 ? manifest.subtitle : null) ? <div style={{ margin: '20px auto 0', maxWidth: 740, fontSize: 24, lineHeight: 1.4, color: 'rgba(246,248,250,0.74)' }}>{scene.caption ?? (index === 0 ? manifest.subtitle : '')}</div> : null}
      </div>
      <div style={{ position: 'relative', zIndex: 1, marginTop: 285, transform: `translateY(${floatY}px)` }}>
        <PhoneMockup src={scene.asset} label={`Captured web scene ${scene.id}`} />
      </div>
      <div style={{ position: 'absolute', zIndex: 2, bottom: 86, left: 100, right: 100, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ height: 3, flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}><div style={{ height: '100%', width: `${((index + 1) / manifest.scenes.length) * 100}%`, borderRadius: 4, background: manifest.visual.accentColor }} /></div>
        <div style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums', letterSpacing: 2, color: 'rgba(255,255,255,0.75)' }}>{String(index + 1).padStart(2, '0')} / {String(manifest.scenes.length).padStart(2, '0')}</div>
      </div>
    </div>
  );
};

export const getReelDuration = (manifest: VideoManifest) => manifest.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0)
  - manifest.scenes.slice(1).reduce((sum, scene, index) => sum + Math.min(TRANSITION_FRAMES, manifest.scenes[index]!.durationFrames, scene.durationFrames), 0);

export const AgnosticReel: React.FC<AgnosticReelProps> = ({ manifest }) => (
  <TransitionSeries>
    {manifest.scenes.flatMap((scene, index) => {
      const sequence = <TransitionSeries.Sequence key={`scene-${scene.id}`} durationInFrames={scene.durationFrames}>
        <Scene scene={scene} index={index} manifest={manifest} />
      </TransitionSeries.Sequence>;
      if (index === 0) return [sequence];
      return [
        <TransitionSeries.Transition key={`transition-${manifest.scenes[index - 1]!.id}-${scene.id}`} presentation={index % 2 === 0 ? fade() : slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: Math.min(TRANSITION_FRAMES, manifest.scenes[index - 1]!.durationFrames, scene.durationFrames) })} />,
        sequence,
      ];
    })}
  </TransitionSeries>
);
