import type { TutorialStep } from './tutorialInstructions';
import type { TutorialRenderState, TutorialDummyVisual } from './tutorialAssets';
export type TutorialState = TutorialRenderState & {
  step: TutorialStep; elapsedMs: number; stepMs: number;
  origin: {x:number;y:number}; dashDone: boolean; transformSeen: boolean; teleported: boolean;
  spinMs: number; spawned: number; planned: number; spawnMs: number; lastDash: number;
  dummy: TutorialDummyVisual & {hp:number;lastHitSerial:number;queuedHits:number};
};
