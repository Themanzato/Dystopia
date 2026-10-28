/** Screen-space hit feedback, driven by the paused simulation's damage timer. */
export function damageFeedback(invulnerableMs: number, invulnerabilityDurationMs = 1100) {
  'worklet';
  if (invulnerableMs <= 0) return { x: 0, y: 0, tint: 0 };
  const elapsed = Math.max(0, invulnerabilityDurationMs - invulnerableMs);
  const t = Math.min(1, elapsed / 280);
  const envelope = (1 - t) * (1 - t);
  return { x: Math.sin(elapsed * 0.095) * 8 * envelope,
    y: Math.sin(elapsed * 0.13 + 1) * 5 * envelope,
    tint: envelope * 0.14 };
}