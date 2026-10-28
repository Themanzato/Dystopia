import { isWalkable } from './collision';
import { WORLD, type Point } from './map';

export const NAV_CELL_SIZE = 32;
export const NAV_COLUMNS = Math.ceil(WORLD.width / NAV_CELL_SIZE);
export const NAV_ROWS = Math.ceil(WORLD.height / NAV_CELL_SIZE);
export const NAV_REFRESH_MS = 350;
const CELL_COUNT = NAV_COLUMNS * NAV_ROWS;
const SEGMENT_STEP = 4;
const DIRECT_DISTANCE = 128;
const OFFSETS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

export type FlowField = {
  target: Point;
  targetCell: number;
  rootCell: number;
  distances: number[];
  next: number[];
};

export function navigationCell(position: Point): number {
  'worklet';
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.y < 0 || position.x >= WORLD.width || position.y >= WORLD.height) return -1;
  return Math.floor(position.y / NAV_CELL_SIZE) * NAV_COLUMNS + Math.floor(position.x / NAV_CELL_SIZE);
}

function cellCenter(cell: number): Point {
  'worklet';
  return { x: (cell % NAV_COLUMNS + 0.5) * NAV_CELL_SIZE, y: (Math.floor(cell / NAV_COLUMNS) + 0.5) * NAV_CELL_SIZE };
}

function clearSegment(from: Point, to: Point): boolean {
  'worklet';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / SEGMENT_STEP));
  for (let i = 0; i <= steps; i++) {
    if (!isWalkable(from.x + dx * i / steps, from.y + dy * i / steps)) return false;
  }
  return true;
}

// Geometry is immutable. Construct this graph once on the JS thread, rather than
// repeating collision probes during BFS or for every enemy on every frame.
const WALKABLE = Array.from({ length: CELL_COUNT }, (_, cell) => {
  const center = cellCenter(cell);
  return isWalkable(center.x, center.y);
});
const EDGES: number[][] = Array.from({ length: CELL_COUNT }, () => []);
for (let cell = 0; cell < CELL_COUNT; cell++) {
  if (!WALKABLE[cell]) continue;
  const x = cell % NAV_COLUMNS;
  const y = Math.floor(cell / NAV_COLUMNS);
  const from = cellCenter(cell);
  for (const [dx, dy] of OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= NAV_COLUMNS || ny >= NAV_ROWS) continue;
    const neighbor = ny * NAV_COLUMNS + nx;
    if (!WALKABLE[neighbor]) continue;
    // A diagonal cannot cut through the corner of two occupied cells.
    if (dx !== 0 && dy !== 0 && (!WALKABLE[y * NAV_COLUMNS + nx] || !WALKABLE[ny * NAV_COLUMNS + x])) continue;
    if (clearSegment(from, cellCenter(neighbor))) EDGES[cell].push(neighbor);
  }
}

function closestConnectedCell(position: Point, distances?: number[], radius = 1): number {
  'worklet';
  const cell = navigationCell(position);
  if (cell < 0 || !isWalkable(position.x, position.y)) return -1;
  const cx = cell % NAV_COLUMNS;
  const cy = Math.floor(cell / NAV_COLUMNS);
  let best = -1;
  let bestDistance = Infinity;
  for (let y = Math.max(0, cy - radius); y <= Math.min(NAV_ROWS - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(NAV_COLUMNS - 1, cx + radius); x++) {
      const candidate = y * NAV_COLUMNS + x;
      if (!WALKABLE[candidate] || (distances !== undefined && distances[candidate] < 0)) continue;
      const center = cellCenter(candidate);
      const dx = center.x - position.x;
      const dy = center.y - position.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance && clearSegment(position, center)) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best;
}

export function buildFlowField(target: Point): FlowField {
  'worklet';
  const distances = Array<number>(CELL_COUNT).fill(-1);
  const next = Array<number>(CELL_COUNT).fill(-1);
  // A player can stand in the walkable edge of an otherwise occupied grid cell.
  // Connect its exact feet to the nearest visible graph node, without snapping it.
  const rootCell = closestConnectedCell(target, undefined, 4);
  const field = { target: { x: target.x, y: target.y }, targetCell: navigationCell(target), rootCell, distances, next };
  if (rootCell < 0) return field;
  const queue = Array<number>(CELL_COUNT);
  queue[0] = rootCell;
  distances[rootCell] = 0;
  next[rootCell] = rootCell;
  let start = 0;
  let end = 1;
  while (start < end) {
    const current = queue[start++];
    const neighbors = EDGES[current];
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (distances[neighbor] >= 0) continue;
      distances[neighbor] = distances[current] + 1;
      next[neighbor] = current;
      queue[end++] = neighbor;
    }
  }
  return field;
}

export function isReachable(position: Point, field: FlowField): boolean {
  'worklet';
  const cell = navigationCell(position);
  if (cell < 0 || !isWalkable(position.x, position.y)) return false;
  if (field.distances[cell] >= 0 && clearSegment(position, cellCenter(cell))) return true;
  return closestConnectedCell(position, field.distances) >= 0;
}

function directionTo(position: Point, goal: Point): Point {
  'worklet';
  const dx = goal.x - position.x;
  const dy = goal.y - position.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 0.001) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

export function navigationDirection(position: Point, target: Point, field: FlowField): Point {
  'worklet';
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  // Only short rays are tested per enemy. Long routes reuse the shared BFS.
  if (dx * dx + dy * dy <= DIRECT_DISTANCE * DIRECT_DISTANCE && clearSegment(position, target)) return directionTo(position, target);
  let cell = navigationCell(position);
  if (cell < 0 || !isWalkable(position.x, position.y)) return { x: 0, y: 0 };
  if (field.distances[cell] < 0) cell = closestConnectedCell(position, field.distances);
  if (cell < 0) return { x: 0, y: 0 };
  const successor = field.next[cell];
  if (successor >= 0) {
    const goal = cellCenter(successor);
    if (clearSegment(position, goal)) return directionTo(position, goal);
  }
  const center = cellCenter(cell);
  if (clearSegment(position, center)) return directionTo(position, center);
  // The exact feet can be on the opposite side of a thin obstacle from their
  // cell center. Attach to a visible neighboring node instead of walking into it.
  cell = closestConnectedCell(position, field.distances);
  return cell < 0 ? { x: 0, y: 0 } : directionTo(position, cellCenter(cell));
}
