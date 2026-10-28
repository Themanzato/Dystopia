import type { LoadingEntity } from './loadingCatalog';

// Layout uses the union of opaque pixels across the verified frames, rather
// than the often much wider animation cell. The same integer scale is used on
// both axes; nearest sampling is applied by the renderer.
export function loadingLayout(width: number, height: number, entity: LoadingEntity) {
  const { bounds } = entity;
  // Leave more breathing room around bosses while retaining whole source pixels.
  const boss = entity.category !== 'Enemigos';
  const size = boss ? 0.30 : 1;
  const fit = Math.min(height * 0.94 / bounds.height, width * 0.62 / bounds.width) * size;
  const scale = Math.max(1, boss ? Math.round(fit) : Math.floor(fit));
  const bodyWidth = bounds.width * scale;
  const bodyHeight = bounds.height * scale;
  // Frame the body rather than its long blade when an audited anchor exists.
  const anchor = entity.focusX === undefined ? bodyWidth / 2 : (entity.focusX - bounds.x) * scale;
  const nameY = height * 0.57;
  // Match the center of the name column, leaving clearance for the 3px bob.
  const gap = Math.max(14, Math.round(height * 0.035));
  return {
    scale, x: Math.round(width * (boss ? 0.75 : 0.83) - anchor),
    y: Math.round(boss ? nameY - gap - bodyHeight : height * 0.83 - bodyHeight),
    titleWidth: Math.min(450, width * 0.43),
    infoLeft: width * 0.55, infoWidth: width * 0.40,
    tipTop: height - Math.min(98, height * 0.25),
    bannerWidth: Math.min(width * 0.98, 1250),
    nameY,
  };
}

export function loadingFrame(entity: LoadingEntity, elapsedMs: number) {
  'worklet';
  const frame = entity.frames > 1 && entity.fps > 0
    ? Math.floor(Math.max(0, elapsedMs) * entity.fps / 1000) % entity.frames : 0;
  const columns = entity.columns ?? entity.frames;
  return { x: (frame % columns) * entity.cell.width + entity.bounds.x,
    y: (entity.row + Math.floor(frame / columns)) * entity.cell.height + entity.bounds.y,
    width: entity.bounds.width, height: entity.bounds.height };
}
export function loadingEntrance(width: number, restingX: number, elapsedMs: number) {
  'worklet';
  // Start with every pixel beyond the right edge, including wide weapons.
  const p = Math.min(1, Math.max(0, elapsedMs / 400));
  const ease = 1 - (1 - p) ** 3;
  return { x: (1 - ease) * Math.max(0, width + 28 - restingX),
    y: Math.sin(Math.max(0, elapsedMs) / 3400) * 3 };
}