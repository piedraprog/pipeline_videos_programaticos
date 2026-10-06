import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { ManifestSchema } from '../src/schema';
import { AgnosticReel, getReelDuration, type AgnosticReelProps } from './AgnosticReel';

const defaultProps: AgnosticReelProps = {
  manifest: { projectName: 'demo', title: 'Product demo', subtitle: 'A closer look at the experience', visual: { accentColor: '#67e8c1', backgroundStyle: 'aurora', motionStyle: 'classic' }, fps: 30, width: 1080, height: 1920, scenes: [{ id: 'scene', asset: 'projects/demo/assets/scene.png', durationFrames: 30 }] },
};

const calculateMetadata: CalculateMetadataFunction<AgnosticReelProps> = ({ props }) => {
  const manifest = ManifestSchema.parse(props.manifest);
  return {
    durationInFrames: getReelDuration(manifest),
    fps: manifest.fps,
    width: 1080,
    height: 1920,
    props: { manifest },
  };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AgnosticReel"
    component={AgnosticReel}
    durationInFrames={30}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
    calculateMetadata={calculateMetadata}
  />
);
