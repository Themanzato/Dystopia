import { WORLD } from './map';

export type Viewport = { width: number; height: number };
export type Camera = { x: number; y: number };
export type CameraBounds = { scale: number; minX: number; maxX: number; minY: number; maxY: number };

// This scale depends only on viewport geometry. Gestures can never modify it.
export function cameraScale(viewport: Viewport): number {
  'worklet';
  return Math.max(0.001, viewport.width / WORLD.width, viewport.height / WORLD.height, Math.min(viewport.width / 960, viewport.height / 480));
}

export function getCameraBounds(viewport: Viewport): CameraBounds {
  'worklet';
  const scale = cameraScale(viewport);
  const halfWidth = Math.min(WORLD.width / 2, viewport.width / (2 * scale));
  const halfHeight = Math.min(WORLD.height / 2, viewport.height / (2 * scale));
  return { scale, minX: halfWidth, maxX: WORLD.width - halfWidth, minY: halfHeight, maxY: WORLD.height - halfHeight };
}

export function clampCamera(camera: Camera, bounds: CameraBounds): Camera {
  'worklet';
  return { x: Math.max(bounds.minX, Math.min(bounds.maxX, camera.x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, camera.y)) };
}

export function constrainCamera(camera: Camera, viewport: Viewport): Camera {
  'worklet';
  return clampCamera(camera, getCameraBounds(viewport));
}
