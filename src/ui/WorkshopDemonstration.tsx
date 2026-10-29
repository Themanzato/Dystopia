import React, { lazy, Suspense } from 'react';
import type { Difficulty } from '../game/difficulty';
import type { WorkshopId } from '../game/workshop';

// Expo Router discovers this route before CanvasKit initializes. Keep its eager
// import graph free of Skia/sharedImages; the canvas loads only inside Taller.
const WorkshopDemoCanvas = lazy(() => import('./WorkshopDemoCanvas'));

export default function WorkshopDemonstration(props: {
  id: WorkshopId; difficulty: Difficulty; width: number; height: number; active?: boolean;
}) {
  return <Suspense fallback={null}><WorkshopDemoCanvas {...props}/></Suspense>;
}
