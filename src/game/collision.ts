import { ANIMATED_PROPS, ARENA, PROPS, WORLD, type Box, type Point } from './map';

// The character collides at the feet, rather than with its sword or transparent cell.
export const PLAYER_RADIUS = 9;
const CELL_SIZE = 128;
const CELL_COLUMNS = Math.ceil(WORLD.width / CELL_SIZE);
const CELL_ROWS = Math.ceil(WORLD.height / CELL_SIZE);
const MAX_STEP = 4;
const LIMIT_RADIUS = ARENA.radius - PLAYER_RADIUS;
const LIMIT_RADIUS_SQUARED = LIMIT_RADIUS * LIMIT_RADIUS;
const RADIUS_SQUARED = PLAYER_RADIUS * PLAYER_RADIUS;
const TOLERANCE = 0.000001;

const SOLIDS: Box[] = [...PROPS, ...ANIMATED_PROPS]
  .filter(prop => prop.footprint !== undefined)
  .map(prop => prop.footprint!);

// Build once on module load. Expanding the indexed bounds by the player's radius
// means each query only needs the cell containing the player's feet.
const SOLID_CELLS: number[][] = Array.from({ length: CELL_COLUMNS * CELL_ROWS }, () => []);
SOLIDS.forEach((solid, index) => {
  const minX = Math.max(0, Math.floor((solid.x - PLAYER_RADIUS) / CELL_SIZE));
  const maxX = Math.min(CELL_COLUMNS - 1, Math.floor((solid.x + solid.width + PLAYER_RADIUS) / CELL_SIZE));
  const minY = Math.max(0, Math.floor((solid.y - PLAYER_RADIUS) / CELL_SIZE));
  const maxY = Math.min(CELL_ROWS - 1, Math.floor((solid.y + solid.height + PLAYER_RADIUS) / CELL_SIZE));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) SOLID_CELLS[y * CELL_COLUMNS + x].push(index);
  }
});

export function isWalkable(x: number, y: number): boolean {
  'worklet';
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < PLAYER_RADIUS || y < PLAYER_RADIUS || x > WORLD.width - PLAYER_RADIUS || y > WORLD.height - PLAYER_RADIUS) return false;
  const offsetX = x - ARENA.x;
  const offsetY = y - ARENA.y;
  if (offsetX * offsetX + offsetY * offsetY > LIMIT_RADIUS_SQUARED + TOLERANCE) return false;

  const candidates = SOLID_CELLS[Math.floor(y / CELL_SIZE) * CELL_COLUMNS + Math.floor(x / CELL_SIZE)];
  for (let i = 0; i < candidates.length; i++) {
    const solid = SOLIDS[candidates[i]];
    const nearestX = Math.max(solid.x, Math.min(x, solid.x + solid.width));
    const nearestY = Math.max(solid.y, Math.min(y, solid.y + solid.height));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < RADIUS_SQUARED - TOLERANCE) return false;
  }
  return true;
}

function constrainToArena(x: number, y: number): Point {
  'worklet';
  const dx = x - ARENA.x;
  const dy = y - ARENA.y;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared <= LIMIT_RADIUS_SQUARED) return { x, y };
  const scale = LIMIT_RADIUS / Math.sqrt(distanceSquared);
  return { x: ARENA.x + dx * scale, y: ARENA.y + dy * scale };
}

export function moveWithCollisions(position: Point, dx: number, dy: number): Point {
  'worklet';
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !isWalkable(position.x, position.y)) return position;
  const steps = Math.ceil(Math.sqrt(dx * dx + dy * dy) / MAX_STEP);
  if (steps === 0) return position;
  const stepX = dx / steps;
  const stepY = dy / steps;
  let x = position.x;
  let y = position.y;
  for (let i = 0; i < steps; i++) {
    // Project onto the circular wall first, allowing natural sliding around it.
    const next = constrainToArena(x + stepX, y + stepY);
    if (isWalkable(next.x, next.y)) {
      x = next.x;
      y = next.y;
    } else {
      // Separate axes let a blocked diagonal continue along the obstacle's face.
      if (isWalkable(next.x, y)) x = next.x;
      if (isWalkable(x, next.y)) y = next.y;
    }
  }
  return { x, y };
}
