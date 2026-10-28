export function menuButtonPose(timeMs: number, index: number) {
  'worklet';
  const local = (Math.max(0, timeMs) + index * 1900) % 14000;
  const burst = local > 9200 && local < 9700 ? Math.sin((local - 9200) / 500 * Math.PI) : 0;
  const shake = burst * Math.sin(local * 0.13);
  return {
    x: Math.sin(timeMs / 3100 + index) * 0.65 + shake * 1.1,
    y: Math.sin(timeMs / 2300 + index * 1.7) * 1.35 + shake * 0.55,
    angle: Math.sin(timeMs / 4200 + index) * 0.08 + shake * 0.15,
  };
}
