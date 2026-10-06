import React from 'react';
import { Img, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import type { VideoManifest } from '../src/schema';

export type AgnosticReelProps = { manifest: VideoManifest };
const TRANSITION_FRAMES = 12;

const PhoneMockup: React.FC<{ src: string; label: string }> = ({ src, label }) => (
  <div style={{
    width: 590,
    height: 1240,
    boxSizing: 'border-box',
    border: '18px solid #17191d',
    borderRadius: 76,
    backgroundColor: '#090a0c',
    padding: '32px 18px',
    boxShadow: '0 36px 100px rgba(0,0,0,0.48), inset 0 0 0 2px #44474d',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', zIndex: 2, top: 16, left: '50%', transform: 'translateX(-50%)', width: 130, height: 28, borderRadius: 20, background: '#090a0c' }} />
    <div style={{ width: '100%', height: '100%', borderRadius: 42, overflow: 'hidden', background: '#fff' }}>
      <Img src={staticFile(src)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  </div>
);

const Scene: React.FC<{ asset: string; id: string }> = ({ asset, id }) => {
  const { width, height } = useVideoConfig();
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 44%, #273342 0%, #111820 48%, #080b10 100%)' }}>
      <PhoneMockup src={asset} label={`Captured web scene ${id}`} />
    </div>
  );
};

export const getReelDuration = (manifest: VideoManifest) =>
  manifest.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0)
  - manifest.scenes.slice(1).reduce((sum, scene, index) =>
    sum + Math.min(TRANSITION_FRAMES, manifest.scenes[index]!.durationFrames, scene.durationFrames), 0);

export const AgnosticReel: React.FC<AgnosticReelProps> = ({ manifest }) => (
  <TransitionSeries>
    {manifest.scenes.flatMap((scene, index) => {
      const sequence = (
        <TransitionSeries.Sequence key={`scene-${scene.id}`} durationInFrames={scene.durationFrames}>
          <Scene asset={scene.asset} id={scene.id} />
        </TransitionSeries.Sequence>
      );
      if (index === 0) return [sequence];
      return [
        <TransitionSeries.Transition
          key={`transition-${manifest.scenes[index - 1]!.id}-${scene.id}`}
          presentation={index % 2 === 0 ? fade() : slide({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: Math.min(TRANSITION_FRAMES, manifest.scenes[index - 1]!.durationFrames, scene.durationFrames) })}
        />,
        sequence,
      ];
    })}
  </TransitionSeries>
);
