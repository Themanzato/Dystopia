import type { EnemyId } from './enemyCatalog';
// Alpha union across every authored idle frame (move for static Shock idle).
// Presentation only; all animation cells remain complete and proportional.
export const ENEMY_PRESENTATION_BOUNDS: Record<EnemyId, { x: number; y: number; width: number; height: number }> = {
  "shielder": {
    "x": 48,
    "y": 11,
    "width": 34,
    "height": 35
  },
  "rock-boss": {
    "x": 30,
    "y": 16,
    "width": 69,
    "height": 53
  },
  "evil-sage": {
    "x": 9,
    "y": 3,
    "width": 14,
    "height": 16
  },
  "archer": {
    "x": 63,
    "y": 1,
    "width": 23,
    "height": 24
  },
  "bomb-droid": {
    "x": 2,
    "y": 6,
    "width": 15,
    "height": 22
  },
  "dagger-mush": {
    "x": 7,
    "y": 55,
    "width": 24,
    "height": 25
  },
  "shock-sweeper": {
    "x": 2,
    "y": 10,
    "width": 32,
    "height": 20
  },
  "guardian": {
    "x": 49,
    "y": 58,
    "width": 30,
    "height": 33
  },
  "skeleton-summoner": {
    "x": 34,
    "y": 19,
    "width": 43,
    "height": 63
  },
  "dagger-bandit": {
    "x": 32,
    "y": 55,
    "width": 17,
    "height": 18
  },
  "archer-bandit": {
    "x": 21,
    "y": 93,
    "width": 22,
    "height": 18
  },
  "dust-jumper": {
    "x": 9,
    "y": 52,
    "width": 25,
    "height": 31
  },
  "tarnished-widow": {
    "x": 53,
    "y": 44,
    "width": 62,
    "height": 46
  },
  "skeleton-unarmed": {
    "x": 17,
    "y": 6,
    "width": 10,
    "height": 16
  },
  "skeleton-archer": {
    "x": 11,
    "y": 3,
    "width": 17,
    "height": 19
  },
  "skeleton-swordsman": {
    "x": 15,
    "y": 6,
    "width": 19,
    "height": 18
  },
  electrocutioner:{x:63,y:54,width:21,height:44},
  'the-plague':{x:23,y:9,width:17,height:26},
};
