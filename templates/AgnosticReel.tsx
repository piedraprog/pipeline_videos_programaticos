import React from 'react';
import { useGsapTimeline } from '@remotion/gsap';
import { Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import type { VideoManifest } from '../src/schema';

export type AgnosticReelProps = { manifest: VideoManifest };
const TRANSITION_FRAMES = 12;
const colors = {
  aurora: { base: '#071014', glow: '#174a4b', secondary: '#102e43' },
  midnight: { base: '#090b16', glow: '#243467', secondary: '#311d48' },
  warm: { base: '#17100e', glow: '#573526', secondary: '#35213b' },
} as const;

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

const SceneHeader: React.FC<{ scene: VideoManifest['scenes'][number]; manifest: VideoManifest }> = ({ scene, manifest }) => {
  const title = scene.title ?? scene.id.replaceAll('-', ' ');
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    timeline.fromTo(selector('[data-title]'), { y: 12 }, { y: 0, duration: 0.45, ease: 'power3.out' }, 0);
    timeline.fromTo(selector('[data-rule]'), { scaleX: 0.5 }, { scaleX: 1, duration: 0.45, ease: 'power2.out' }, 0);
  }, { dependencies: [scene.id] });
  return <div ref={scope} style={{ position: 'absolute', top: 120, left: 100, right: 100, textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: manifest.visual.accentColor, marginBottom: 24 }}>{manifest.title}</div>
    <div data-title style={{ fontSize: 52, lineHeight: 1.12, fontWeight: 700, letterSpacing: -1, overflowWrap: 'anywhere' }}>{title}</div>
    <div data-rule style={{ width: 84, height: 4, margin: '22px auto', background: manifest.visual.accentColor }} />
    <div style={{ maxWidth: 780, margin: 'auto', fontSize: 26, lineHeight: 1.4, color: 'rgba(246,248,250,0.78)' }}>{scene.caption ?? manifest.subtitle}</div>
  </div>;
};

export const getTransitionFrames = (previous: number, next: number) => Math.min(TRANSITION_FRAMES, Math.floor((previous - 1) / 2), Math.floor((next - 1) / 2));
export const getSceneStarts = (manifest: VideoManifest) => {
  let start = 0;
  return manifest.scenes.map((scene, index) => {
    if (index > 0) start -= getTransitionFrames(manifest.scenes[index - 1]!.durationFrames, scene.durationFrames);
    const result = start;
    start += scene.durationFrames;
    return result;
  });
};
export const getReelDuration = (manifest: VideoManifest) => getSceneStarts(manifest).at(-1)! + manifest.scenes.at(-1)!.durationFrames;

export const AgnosticReel: React.FC<AgnosticReelProps> = ({ manifest }) => {
  const frame = useCurrentFrame();
  const starts = getSceneStarts(manifest);
  const active = starts.reduce((result, start, index) => frame >= start ? index : result, 0);
  const progress = (frame + 1) / getReelDuration(manifest);
  return <div style={{ width: 1080, height: 1920, position: 'relative', overflow: 'hidden', color: '#f6f8fa', fontFamily: 'Arial, sans-serif' }}>
    <AnimatedBackground sceneIndex={0} manifest={manifest} />
    {manifest.scenes.map((scene, index) => <Sequence key={scene.id} from={starts[index]} durationInFrames={(starts[index + 1] ?? getReelDuration(manifest)) - starts[index]!}>
      <SceneHeader scene={scene} manifest={manifest} />
    </Sequence>)}
    <div style={{ position: 'absolute', top: 420, left: 230, width: 620, height: 1320, padding: 12, border: '14px solid #17191d', boxSizing: 'border-box', borderRadius: 64, background: '#090a0c', boxShadow: '0 36px 100px rgba(0,0,0,0.48), inset 0 0 0 2px #44474d' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: '#fff' }}>
        <TransitionSeries>
          {manifest.scenes.flatMap((scene, index) => {
            const sequence = <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationFrames}>
              <Img src={staticFile(scene.asset)} alt={scene.title ?? scene.id} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center top', background: '#fff' }} />
            </TransitionSeries.Sequence>;
            if (index === 0) return [sequence];
            const overlap = getTransitionFrames(manifest.scenes[index - 1]!.durationFrames, scene.durationFrames);
            return overlap > 0 ? [<TransitionSeries.Transition key={`transition-${scene.id}`} presentation={slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: overlap })} />, sequence] : [sequence];
          })}
        </TransitionSeries>
      </div>
    </div>
    <div style={{ position: 'absolute', bottom: 86, left: 100, right: 100, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ height: 4, flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}><div style={{ height: '100%', width: `${progress * 100}%`, background: manifest.visual.accentColor, borderRadius: 4 }} /></div>
      <div style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.75)' }}>{String(active + 1).padStart(2, '0')} / {String(manifest.scenes.length).padStart(2, '0')}</div>
    </div>
  </div>;
};
