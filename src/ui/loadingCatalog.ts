import { PLAGUE_PORTRAITS } from './plaguePortraits';

/**
 * Original PNGs audited visually as complete images and enlarged individual cells.
 * Cadences below are presentation choices: the PNGs contain no timing metadata.
 * bounds is the union of non-transparent pixels within one cell across all frames;
 * it removes only transparent margins, keeping each animation at a stable scale.
 */
export type LoadingEntity = {
  id: string;
  name: string;
  category: 'Enemigos' | 'Mini boss' | 'Boss';
  description: string;
  source: number;
  cell: { width: number; height: number };
  frames: number;
  /** Frames per sheet row. Omit for a horizontal strip; use 1 for vertical strips. */
  columns?: number;
  // Optional body anchor in source-cell pixels for asymmetrical held props.
  focusX?: number;
  fps: number;
  row: number;
  bounds: { x: number; y: number; width: number; height: number };
};

export const LOADING_ENTITIES: readonly LoadingEntity[] = [
  {
    id: 'ghoul', name: 'Ghoul', category: 'Enemigos',
    description: 'Enemigo de las oleadas actuales. Un tajo que lo alcance lo elimina.',
    source: require('../../assets/assets/enemies/npc/Ghoul/Walk.png'),
    cell: { width: 62, height: 33 }, frames: 9, fps: 12, row: 0,
    bounds: { x: 25, y: 9, width: 13, height: 23 },
  },
  {
    id: 'spitter', name: 'Spitter', category: 'Enemigos',
    description: 'Figura oscura de silueta encorvada y detalles rojos.',
    source: require('../../assets/assets/enemies/npc/spitter/Spitter/idle.png'),
    cell: { width: 57, height: 39 }, frames: 6, fps: 8, row: 0,
    bounds: { x: 29, y: 11, width: 18, height: 27 },
  },
  {
    id: 'summoner', name: 'Summoner', category: 'Enemigos',
    description: 'Silueta oscura rodeada de puntos rojos.',
    source: require('../../assets/assets/enemies/npc/summoner/idle.png'),
    cell: { width: 46, height: 44 }, frames: 6, fps: 8, row: 0,
    bounds: { x: 20, y: 1, width: 21, height: 42 },
  },
  {
    id: 'shielder', name: 'Shielder', category: 'Mini boss',
    description: 'Figura con escudo y detalles luminosos azulados.',
    source: require('../../assets/assets/enemies/mini bosses/Shielder/walk.png'),
    cell: { width: 129, height: 46 }, frames: 6, fps: 9, row: 0,
    bounds: { x: 48, y: 11, width: 34, height: 35 },
  },
  {
    id: 'evil-sage', name: 'The Evil Sage', category: 'Mini boss',
    description: 'Figura con sombrero y detalles rojos.',
    source: require('../../assets/assets/enemies/mini bosses/Evil sage/The Evil Sage 52x21.png'),
    cell: { width: 52, height: 21 }, frames: 9, fps: 9, row: 0,
    bounds: { x: 9, y: 3, width: 14, height: 16 },
  },
  {
    id: 'guardian', name: 'Guardian', category: 'Boss',
    description: 'Estructura oscura con fragmentos suspendidos y luz azulada.',
    source: require('../../assets/assets/bosses/ancient guard/Guardian-Idle.png'),
    cell: { width: 166, height: 96 }, frames: 24, fps: 12, row: 0,
    bounds: { x: 49, y: 58, width: 30, height: 33 },
  },
  {
    id: 'skeleton-summoner', name: 'Skeleton Summoner', category: 'Boss',
    description: 'Figura esquelética con bastón y adornos dorados.',
    source: require('../../assets/assets/bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner-Idle.png'),
    cell: { width: 132, height: 83 }, frames: 12, fps: 10, row: 0,
    bounds: { x: 34, y: 19, width: 43, height: 63 },
  },
  {
    id: 'dagger-bandit', name: 'Dagger Bandit', category: 'Boss',
    description: 'Figura encapuchada en tonos verdes.',
    source: require('../../assets/assets/bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Idle.png'),
    cell: { width: 128, height: 78 }, frames: 8, fps: 8, row: 0,
    bounds: { x: 32, y: 55, width: 17, height: 18 },
  },
  {
    id: 'archer', name: 'Archer', category: 'Mini boss',
    description: 'Figura encapuchada con arco y detalles azulados.',
    source: require('../../assets/assets/enemies/mini bosses/Archer/idle.png'),
    cell: { width: 174, height: 25 }, frames: 20, columns: 1, fps: 10, row: 0,
    bounds: { x: 63, y: 1, width: 23, height: 24 },
  },
  {
    id: 'bomb-droid', name: 'Bomb Droid', category: 'Mini boss',
    description: 'Pequeño dron oscuro con luces y una estela clara.',
    source: require('../../assets/assets/enemies/mini bosses/Bomb Droid/Idle.png'),
    cell: { width: 32, height: 32 }, frames: 6, columns: 1, fps: 8, row: 0,
    bounds: { x: 2, y: 6, width: 15, height: 22 },
  },
  {
    id: 'dagger-mush', name: 'Dagger Mush', category: 'Mini boss',
    description: 'Figura encapuchada con detalles azulados.',
    source: require('../../assets/assets/enemies/mini bosses/Dagger Mush/idle.png'),
    cell: { width: 144, height: 80 }, frames: 5, columns: 1, fps: 8, row: 0,
    bounds: { x: 7, y: 55, width: 24, height: 25 },
  },
  {
    id: 'shock-sweeper', name: 'Shock Sweeper', category: 'Mini boss',
    description: 'Figura oscura que sostiene una hoja larga.',
    source: require('../../assets/assets/enemies/mini bosses/Shock Sweeper/shuffe(move).png'),
    cell: { width: 88, height: 30 }, frames: 8, columns: 1, fps: 10, row: 0,
    bounds: { x: 2, y: 10, width: 32, height: 20 }, focusX: 28,
  },
  {
    id: 'archer-bandit', name: 'Archer Bandit', category: 'Boss',
    description: 'Figura encapuchada en tonos violetas que sostiene un arco.',
    source: require('../../assets/assets/bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Idle.png'),
    cell: { width: 85, height: 112 }, frames: 8, fps: 8, row: 0,
    bounds: { x: 21, y: 93, width: 22, height: 18 },
  },
  {
    id: 'dust-jumper', name: 'Dust Jumper', category: 'Boss',
    description: 'Figura oscura con detalles claros y anaranjados.',
    source: require('../../assets/assets/bosses/Dust Jumper/Dust Jumper/Dust Jumper Sprite Sheet 42x91.png'),
    cell: { width: 42, height: 91 }, frames: 12, fps: 10, row: 0,
    bounds: { x: 9, y: 52, width: 25, height: 31 },
  },
  {
    id: 'rock-boss', name: 'Rock boss', category: 'Boss',
    description: 'Cuerpo rocoso con fragmentos separados y luces azuladas.',
    source: require('../../assets/assets/bosses/rock boss/idle.png'),
    cell: { width: 201, height: 94 }, frames: 24, fps: 12, row: 0,
    bounds: { x: 30, y: 16, width: 69, height: 53 },
  },
  {
    id: 'tarnished-widow', name: 'The Tarnished Widow', category: 'Boss',
    description: 'Criatura oscura de varias patas con detalles rojos.',
    source: require('../../assets/assets/bosses/The Tarnished Widow 188x90/The Tarnished Widow 188x90.png'),
    cell: { width: 188, height: 90 }, frames: 9, fps: 9, row: 0,
    bounds: { x: 53, y: 44, width: 62, height: 46 },
  },
  {id:'electrocutioner',name:'Electrocutioner',category:'Boss',description:'Figura encapuchada con destellos de electricidad cian.',source:require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Idle.png'),cell:{width:157,height:107},frames:12,fps:12,row:0,bounds:{x:63,y:54,width:21,height:44}},
  { ...PLAGUE_PORTRAITS[2], id:'the-plague', name:'THE PLAGUE' },
];

// These messages describe the current controls, scenery and common-enemy encounter.
// The gallery includes special entities without introducing them into gameplay.
export const LOADING_TIPS: readonly string[] = [
  'Muévete en ocho direcciones.',
  'Joystick al borde: corre.',
  'Dash: joystick o última dirección.',
  'Espera un instante entre dashes.',
  'Pulsa ataque y encadena los tajos.',
  'La espada conserva tu orientación lateral.',
  'Un tajo basta para eliminar a un Ghoul.',
  'Cada oleada deja una breve pausa.',
  'Explora las calles entre edificios.',
  'El pasto y las piedras no bloquean el paso.',
  'La cámara sigue a Swordmaster.',
  'Pausa también detiene las oleadas.',
  'Los mini bosses llegan en las oleadas 5, 15, 25...',
  'Los bosses aparecen en las oleadas 10, 20, 30...',
];

export type LoadingSelection = {
  entity: LoadingEntity;
  tip: string;
  tipIndex: number;
};

function nextIndex(count: number, previous: number, random: () => number): number {
  const excluded = previous >= 0 && previous < count && Number.isInteger(previous) ? previous : -1;
  const choices = count - (excluded >= 0 && count > 1 ? 1 : 0);
  const value = random();
  const normalized = Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
  const index = Math.floor(normalized * choices);
  return count > 1 && excluded >= 0 && index >= excluded ? index + 1 : index;
}

/** Call once per actual load, never during a frame or render animation. */
export function chooseLoading(
  previous?: { entityId: string; tipIndex: number },
  random: () => number = Math.random,
): LoadingSelection {
  const entityIndex = nextIndex(LOADING_ENTITIES.length,
    LOADING_ENTITIES.findIndex(entity => entity.id === previous?.entityId), random);
  const tipIndex = nextIndex(LOADING_TIPS.length, previous?.tipIndex ?? -1, random);
  return { entity: LOADING_ENTITIES[entityIndex], tip: LOADING_TIPS[tipIndex], tipIndex };
}
