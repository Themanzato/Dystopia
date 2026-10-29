import type { LoadingEntity } from './loadingCatalog';

/** Original idle strips, shared between gallery preloading and identified cards. */
export const PLAGUE_PORTRAITS: readonly (LoadingEntity & { sheetSize: { width: number; height: number } })[] = [
  { id:'plague-small', name:'The Plague', category:'Mini boss', description:'Enjambre de insectos de distintos tamaños.',
    source:require('../../assets/assets/enemies/mini bosses/The plague/Small Bug/Small insect - idle move.png'),
    cell:{width:20,height:28}, frames:4, fps:1000/65, row:0, bounds:{x:3,y:8,width:10,height:10}, sheetSize:{width:80,height:28} },
  { id:'plague-medium', name:'The Plague', category:'Mini boss', description:'Enjambre de insectos de distintos tamaños.',
    source:require('../../assets/assets/enemies/mini bosses/The plague/Medium Bug/Medium Insect-idleMove.png'),
    cell:{width:34,height:37}, frames:8, fps:1000/65, row:0, bounds:{x:7,y:8,width:16,height:17}, sheetSize:{width:272,height:37} },
  { id:'plague-medium2', name:'The Plague', category:'Mini boss', description:'Enjambre de insectos de distintos tamaños.',
    source:require('../../assets/assets/enemies/mini bosses/The plague/Medium bug 2/Medium2 bug-Idle Move.png'),
    cell:{width:88,height:37}, frames:8, fps:1000/70, row:0, bounds:{x:23,y:9,width:17,height:26}, sheetSize:{width:704,height:37} },
  { id:'plague-big', name:'The Plague', category:'Mini boss', description:'Enjambre de insectos de distintos tamaños.',
    source:require('../../assets/assets/enemies/mini bosses/The plague/Big Bug/Big Insect-moveidle.png'),
    cell:{width:72,height:44}, frames:8, fps:1000/65, row:0, bounds:{x:17,y:7,width:25,height:30}, sheetSize:{width:576,height:44} },
];
