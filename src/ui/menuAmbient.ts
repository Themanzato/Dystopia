import { NPC_ANIMATIONS, NPC_CELL } from '../game/npc';

export type MenuTilt = { x: number; y: number };
export type MenuRotation = { x: number; y: number };

// Expo reports angular velocity in rad/s, not orientation. Integrate briefly,
// damp toward neutral and cap travel so sensor drift cannot reveal canvas edges.
export function advanceMenuTilt(previous: MenuTilt, rotation: MenuRotation, elapsedMs: number): MenuTilt {
  'worklet';
  const dt = Math.min(0.064, Math.max(0, elapsedMs / 1000));
  const decay = Math.exp(-0.85 * dt);
  const x = Number.isFinite(rotation.x) ? Math.max(-3, Math.min(3, rotation.x)) : 0;
  const y = Number.isFinite(rotation.y) ? Math.max(-3, Math.min(3, rotation.y)) : 0;
  // The app is landscape: device X becomes screen horizontal tilt, device Y
  // becomes vertical tilt. This deliberately produces only a subtle response.
  return {
    x: Math.max(-18, Math.min(18, previous.x * decay - x * 78 * dt)),
    y: Math.max(-12, Math.min(12, previous.y * decay + y * 63 * dt)),
  };
}

export type MenuGyroscope = {
  isAvailableAsync: () => Promise<boolean>;
  setUpdateInterval: (intervalMs: number) => void;
  addListener: (callback: (rotation: MenuRotation) => void) => { remove: () => void };
};
// Returns cleanup immediately, even when the asynchronous availability check is
// still pending. Never requests permissions or removes another screen's listener.
export function startMenuGyroscope(sensor: MenuGyroscope, receive: (rotation: MenuRotation) => void): () => void {
  let disposed = false;
  let subscription: { remove: () => void } | undefined;
  void sensor.isAvailableAsync().then(available => {
    if (!available || disposed) return;
    sensor.setUpdateInterval(34);
    subscription = sensor.addListener(rotation => { if (!disposed) receive(rotation); });
  }).catch(() => { /* Unsupported/denied sensor: ambient drift remains available. */ });
  return () => { disposed = true; subscription?.remove(); };
}

// Four fixed, clear street locations: purely decorative actors, no encounter.
export const MENU_NPC_SPOTS = [
  { x: 1090, y: 454, facing: -1, delay: 850 },
  { x: 790, y: 462, facing: 1, delay: 0 },
  { x: 953, y: 486, facing: -1, delay: 2400 },
  { x: 867, y: 520, facing: 1, delay: 3750 },
];
export const MENU_NPC_SCALE = 2.35;

export function menuNpcAt(timeMs: number, index: number) {
  'worklet';
  const spot = MENU_NPC_SPOTS[index];
  const spawnMs = NPC_ANIMATIONS.spawn.frames * 1000 / NPC_ANIMATIONS.spawn.fps;
  const wakeMs = NPC_ANIMATIONS.wake.frames * 1000 / NPC_ANIMATIONS.wake.fps;
  const walkMs = 2200 + index * 190;
  const deathMs = NPC_ANIMATIONS.death.frames * 1000 / NPC_ANIMATIONS.death.fps;
  const liveMs = spawnMs + wakeMs + walkMs + deathMs;
  const cycleMs = liveMs + 1250;
  const age = timeMs - spot.delay;
  const t = age < 0 ? -1 : age % cycleMs;
  let action: keyof typeof NPC_ANIMATIONS = 'spawn';
  let actionMs = Math.max(0, t);
  if (t >= spawnMs + wakeMs + walkMs) { action = 'death'; actionMs = t - spawnMs - wakeMs - walkMs; }
  else if (t >= spawnMs + wakeMs) { action = 'move'; actionMs = t - spawnMs - wakeMs; }
  else if (t >= spawnMs) { action = 'wake'; actionMs = t - spawnMs; }
  const animation = NPC_ANIMATIONS[action];
  const frameIndex = Math.floor(actionMs * animation.fps / 1000);
  const frame = action === 'move' ? frameIndex % animation.frames : Math.min(animation.frames - 1, frameIndex);
  const travel = Math.max(0, Math.min(1, (t - spawnMs - wakeMs) / walkMs));
  return {
    visible: t >= 0 && t < liveMs,
    action,
    source: { x: frame * NPC_CELL.width, y: animation.row * NPC_CELL.height, width: NPC_CELL.width, height: NPC_CELL.height },
    x: spot.x + spot.facing * travel * 30,
    y: spot.y + travel * 7,
    facing: spot.facing,
  };
}
