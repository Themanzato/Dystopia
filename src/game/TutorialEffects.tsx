import React, { useEffect } from 'react';
import { Atlas, FilterMode, Group, MipmapMode, Path, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useSharedImage } from '../ui/sharedImages';
import { DUMMY_CELL, TUTORIAL_DUMMY_SOURCES, tutorialDummyFrame, type TutorialRenderState } from './tutorialAssets';

const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

function DummyAtlas<T extends TutorialRenderState | null>({ tutorial, image, index }: {
  tutorial: SharedValue<T>; image: SkImage; index: number;
}) {
  const frameIndex = useDerivedValue(() => {
    const dummy = tutorial.value?.dummy;
    if (!dummy) return -1;
    const frame = tutorialDummyFrame(dummy.action, dummy.elapsedMs);
    return frame.visible && frame.image === index ? frame.frame : -1;
  });
  const sprites = useDerivedValue(() => frameIndex.value < 0 ? []
    : [rect(frameIndex.value * DUMMY_CELL.width, 0, DUMMY_CELL.width, DUMMY_CELL.height)]);
  const transforms = useDerivedValue(() => {
    const dummy = tutorial.value?.dummy;
    return frameIndex.value < 0 || !dummy ? [] : [Skia.RSXform(DUMMY_CELL.scale, 0,
      dummy.x - DUMMY_CELL.pivotX * DUMMY_CELL.scale, dummy.y - DUMMY_CELL.pivotY * DUMMY_CELL.scale)];
  });
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={sampling} />;
}

/** World-space overlay, placed under the same camera group as the city/player.
 * All animation ages come from tutorial simulation state: no JS timers, private
 * clock or React per-frame updates can continue while the tutorial is paused. */
export default function TutorialEffects<T extends TutorialRenderState | null>({ tutorial, onReady, onError, renderDummy = true }: {
  tutorial: SharedValue<T>; onReady?: () => void; onError?: (error: Error) => void; renderDummy?: boolean;
}) {
  const idle = useSharedImage(TUTORIAL_DUMMY_SOURCES[0], onError);
  const hit = useSharedImage(TUTORIAL_DUMMY_SOURCES[1], onError);
  const breaking = useSharedImage(TUTORIAL_DUMMY_SOURCES[2], onError);
  useEffect(() => { if (idle && hit && breaking) onReady?.(); }, [idle, hit, breaking, onReady]);
  const marker = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make(), target = tutorial.value?.target;
    if (target) {
      // A small pixel-stepped destination beacon, not an attack hitbox. The
      // center remains transparent so feet and nearby enemies stay readable.
      const x = Math.round(target.x), y = Math.round(target.y);
      for (const [dx,dy,w,h] of [[-18,-12,8,2],[-18,-12,2,8],[10,-12,8,2],[16,-12,2,8],
        [-18,10,8,2],[-18,4,2,8],[10,10,8,2],[16,4,2,8],[-4,-22,8,2],[-2,-20,4,2],[0,-18,2,2]]) {
        path.addRect(rect(x+dx,y+dy,w,h));
      }
    }
    return path.detach();
  });
  return <Group>
    <Path path={marker} color="#b9e3d3" antiAlias={false} opacity={0.85} />
    {renderDummy && idle && <DummyAtlas tutorial={tutorial} image={idle} index={0} />}
    {renderDummy && hit && <DummyAtlas tutorial={tutorial} image={hit} index={1} />}
    {renderDummy && breaking && <DummyAtlas tutorial={tutorial} image={breaking} index={2} />}
  </Group>;
}
