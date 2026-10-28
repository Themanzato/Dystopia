import type { Box } from './map';

// Asset-independent draw data. Coordinates and depth use the same world units
// as the actor's feet; the source cell keeps its original transparent margins.
export type RenderActor = {
  id: number;
  image: number;
  source: Box;
  x: number;
  y: number;
  depth: number;
  scale: number;
  pivotX: number;
  pivotY: number;
  facingX: number;
  visible: boolean;
  opacity?: number;
};
