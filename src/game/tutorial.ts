import { createSurvival, advanceSurvival, spawnTutorialEnemy, type SurvivalState } from './survival';
import { createRunStats } from './scores';
import { createMissionTelemetry } from './missionTelemetry';
import { createPlayer, PLAYER_SPAWN, type PlayerState } from './player';
import { emptyNpc } from './npc';
import { swordHitsNpc } from './combat';
import { isWalkable } from './collision';
import { spawnIsClear, WAVE_CONFIG } from './encounter';
import { type FlowField } from './navigation';
import { FRENESIS, chargeFrenesis, endFrenesis } from './frenesis';
import { DUMMY_HIT_MS, DUMMY_BREAK_MS } from './tutorialAssets';
import type { TutorialState } from './tutorialTypes';
import type { TutorialStep } from './tutorialInstructions';

export const TUTORIAL_CONFIG = { moveDistance:90, dummyHp:3, firstWave:4, secondWave:12,
  beforeSpin:6, maxAlive:8, spawnIntervalMs:650, spinPracticeMs:1100, minimumSpawnDistance:150 };

function trainingOrigin() {
  // One static JS audit of the existing city, never a map rebuild per frame.
  for (let y=1000;y<=2000;y+=32) for(let x=1000;x<=2200;x+=32) {
    let clear=isWalkable(x,y);
    for(let ring=32;clear&&ring<=128;ring+=32)for(let n=0;n<24;n++)
      if(!isWalkable(x+Math.cos(n*Math.PI/12)*ring,y+Math.sin(n*Math.PI/12)*ring)){clear=false;break;}
    if(clear)return {x,y};
  }
  return PLAYER_SPAWN;
}
export const TUTORIAL_SPAWN = trainingOrigin();
export function createTutorialPlayer():PlayerState {
  'worklet';return {...createPlayer(),...TUTORIAL_SPAWN};
}
export function createTutorialSurvival(seed=0x7475746f):SurvivalState {
  'worklet';
  const s=createSurvival(seed,'easy');
  const dummy={x:TUTORIAL_SPAWN.x+95,y:TUTORIAL_SPAWN.y,action:'gone' as const,elapsedMs:0,hp:TUTORIAL_CONFIG.dummyHp,lastHitSerial:-1,queuedHits:0};
  return {...s,tutorial:{step:'move',elapsedMs:0,stepMs:0,origin:{...TUTORIAL_SPAWN},dummy,
    target:{x:TUTORIAL_SPAWN.x+105,y:TUTORIAL_SPAWN.y},dashDone:false,transformSeen:false,teleported:false,
    spinMs:0,spawned:0,planned:0,spawnMs:0,lastDash:0},encounter:{...s.encounter,phase:'clearing',remaining:0,timerMs:0}};
}
function enter(t:TutorialState,step:TutorialStep):TutorialState {
  'worklet';return {...t,step,stepMs:0,target:null};
}
function point(s:SurvivalState,p:PlayerState,field:FlowField,min:number,max:number):{x:number;y:number}|null {
  'worklet';
  const config={...WAVE_CONFIG,spawnMinDistance:min,spawnMaxDistance:max,separationDistance:32};
  for(let i=0;i<64;i++) {
    s.encounter.randomSeed=(Math.imul(s.encounter.randomSeed,1664525)+1013904223)>>>0;
    const angle=s.encounter.randomSeed/4294967296*Math.PI*2,r=min+(i%5)/4*(max-min);
    const pos={x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r};
    if(spawnIsClear(pos,p,s.encounter.enemies,field,config))return pos;
  }
  return null;
}
function wave(s:SurvivalState,t:TutorialState,count:number,index:number):TutorialState {
  'worklet';
  s.encounter={...s.encounter,wave:index,remaining:count,phase:'clearing',enemies:s.encounter.enemies.map(()=>emptyNpc())};
  s.events.wave++;return {...t,planned:count,spawned:0,spawnMs:300};
}
/** Information steps never directly activate an action or silently grant real progress. */
export function continueTutorial(current:SurvivalState):SurvivalState {
  'worklet';
  const t=current.tutorial;if(!t||current.mode!=='playing')return current;
  const s={...current,events:{...current.events},encounter:{...current.encounter}};
  if(t.step==='hud')s.tutorial=enter(t,'charge');
  else if(t.step==='charge'){
    s.frenesis={...endFrenesis(s.frenesis),charge:FRENESIS.capacity};
    s.tutorial=wave(s,enter(t,'activate'),TUTORIAL_CONFIG.secondWave,2);
  }else if(t.step==='transform')s.tutorial={...enter(t,'teleport'),transformSeen:true};
  else return current;
  return s;
}
export function constrainTutorialPlayer(before:PlayerState,after:PlayerState,s:SurvivalState):PlayerState {
  'worklet';const d=s.tutorial?.dummy;
  return d&&d.action!=='gone'&&Math.hypot(after.x-d.x,after.y-d.y)<20?{...after,x:before.x,y:before.y}:after;
}
export function advanceTutorial(current:SurvivalState,before:PlayerState,player:PlayerState,field:FlowField,elapsedMs:number,view?:SurvivalState['combatView'],targets?:readonly{x:number;y:number}[]):SurvivalState {
  'worklet';
  const old=current.tutorial;if(!old||old.step==='finish'||current.mode!=='playing')return current;
  const dt=Math.max(0,Math.min(40,elapsedMs));if(!dt)return current;
  const s=advanceSurvival(current,before,player,field,dt,view);
  let t:TutorialState={...old,elapsedMs:old.elapsedMs+dt,stepMs:old.stepMs+dt,dummy:{...old.dummy}};
  const d=t.dummy;
  if(d.action==='hit'){
    d.elapsedMs+=dt;
    if(d.elapsedMs>=DUMMY_HIT_MS){
      if(d.queuedHits>0){d.queuedHits--;d.elapsedMs-=DUMMY_HIT_MS;}
      else if(d.hp===0){d.action='breaking';d.elapsedMs=0;}
      else{d.action='idle';d.elapsedMs=0;}
    }
  }else if(d.action==='breaking'){
    d.elapsedMs+=dt;
    if(d.elapsedMs>=DUMMY_BREAK_MS){d.action='gone';t=wave(s,enter(t,'wave'),TUTORIAL_CONFIG.firstWave,1);}
  }
  if(t.step==='move'&&Math.hypot(player.x-t.origin.x,player.y-t.origin.y)>=TUTORIAL_CONFIG.moveDistance){
    const pos=point(s,player,field,75,125);
    if(pos){t=enter(t,'dummy');t.dummy={...d,...pos,action:'idle',elapsedMs:0};}
  }
  if(t.step==='dummy'&&d.hp>0&&d.action!=='gone'&&d.action!=='breaking'&&swordHitsNpc(before,player,{...emptyNpc(),...d,id:900000,active:true,action:'idle'})){
    d.hp--;d.lastHitSerial=player.attackSerial;
    s.frenesis=chargeFrenesis(s.frenesis,1,d.hp===0);
    if(d.action==='hit')d.queuedHits++;else{d.action=d.hp===0?'breaking':'hit';d.elapsedMs=0;}
  }
  if(t.step==='wave'&&!t.dashDone&&(s.encounter.defeated>0||t.stepMs>2500))t={...enter(t,'dash'),lastDash:s.events.dash};
  if(t.step==='dash'&&(s.events.dash>t.lastDash||player.action==='dash'))t={...enter(t,'wave'),dashDone:true};
  if(t.step==='wave'&&t.dashDone&&s.encounter.remaining===0&&!s.encounter.enemies.some(n=>n.active))t=enter(t,'hud');
  if(t.step==='activate'&&s.frenesis.active)t=enter(t,t.transformSeen?t.teleported?'spin':'teleport':'transform');
  if(t.step==='teleport'){
    if(s.frenesis.teleport)t.teleported=true;
    if(t.teleported&&!s.frenesis.teleport)t=enter(t,'spin');
    else if(!t.target||Math.hypot(t.target.x-player.x,t.target.y-player.y)>210
      ||view&&(t.target.x<view.left+20||t.target.x>view.right-20||t.target.y<view.top+20||t.target.y>view.bottom-20)
      ||s.encounter.enemies.some(n=>n.active&&n.action!=='death'&&Math.hypot(n.x-t.target!.x,n.y-t.target!.y)<36)){
      // Screen candidates avoid customized controls and the instruction card.
      // Validate them again in world coordinates against city and enemy bodies.
      const options=targets??[];
      t.target=options.find(p=>spawnIsClear(p,player,[],field,{...WAVE_CONFIG,spawnMinDistance:48,spawnMaxDistance:500})
        &&!s.encounter.enemies.some(n=>n.active&&n.action!=='death'&&Math.hypot(n.x-p.x,n.y-p.y)<40))??(targets?null:point(s,player,field,80,140));
    }
  }
  if(t.step==='spin'&&s.frenesis.active&&player.action==='attack'&&player.frenesisAttack==='slices'&&player.attackHeld)t.spinMs+=dt;
  if(t.step==='spin'&&t.spinMs>=TUTORIAL_CONFIG.spinPracticeMs&&s.encounter.remaining===0&&!s.encounter.enemies.some(n=>n.active)){
    t=enter(t,'finish');s.frenesis=endFrenesis(s.frenesis);s.encounter.enemies=s.encounter.enemies.map(()=>emptyNpc());
  }
  if(['transform','teleport','spin'].includes(t.step)&&!s.frenesis.active){
    t=enter(t,'activate');s.frenesis={...endFrenesis(s.frenesis),charge:FRENESIS.capacity};
    s.hp=s.maxHp; // Practice recovery, never a persistent heal or an extended ultimate.
  }
  const alive=s.encounter.enemies.filter(n=>n.active&&n.action!=='death').length;
  const waveStep=['wave','dash','activate','transform','teleport','spin'].includes(t.step);
  const allowed=t.planned===TUTORIAL_CONFIG.secondWave&&t.step!=='spin'?TUTORIAL_CONFIG.beforeSpin:t.planned;
  if(waveStep&&t.spawned<allowed&&alive<TUTORIAL_CONFIG.maxAlive){
    t.spawnMs=Math.max(0,t.spawnMs-dt);
    if(t.spawnMs===0){const pos=point(s,player,field,TUTORIAL_CONFIG.minimumSpawnDistance,240);
      if(pos&&spawnTutorialEnemy(s,player,field,pos)){t.spawned++;s.encounter.remaining=Math.max(0,t.planned-t.spawned);t.spawnMs=TUTORIAL_CONFIG.spawnIntervalMs;}
      else t.spawnMs=250;
    }
  }
  // Defense in depth: practice never creates XP, loot, run scoring or mission telemetry.
  return {...s,tutorial:t,stats:createRunStats(),missions:createMissionTelemetry(),xp:0,level:1,orbs:[],chests:[],
    pendingChests:0,pendingUpgrades:0,choices:[],chestChoices:[],boss:null,partner:null,minibosses:[],hazards:[],projectiles:[]};
}
