import type { SurvivalState } from './survival';
import { createMissionTelemetry } from './missionTelemetry';
export const MISSION_BALANCE = { rewards: { initiation: 8, mastery: 30, extreme: 90 }, checkpointMs: 400, toastMs: 2800 };
export type MissionMetric = 'npc' | 'mini' | 'boss' | 'waves' | 'wave' | 'captures' | 'nests' | 'reactors' | 'elites' | 'specials' | 'activations' | 'teleports' | 'spin' | 'orbs' | 'level' | 'wins' | 'hardWins' | 'impossibleWins' | 'impossibleWave' | 'flawless' | 'perfectHard' | 'perfectImpossible' | 'perfectCapture';
export type MissionCategory = 'initiation' | 'mastery' | 'extreme';
export type MissionDef = { id: string; name: string; description: string; metric: MissionMetric; target: number; scope: 'total' | 'best'; category: MissionCategory; reward: number; requires?: string };
const m = (id: string, name: string, description: string, metric: MissionMetric, target: number, scope: MissionDef['scope'], category: MissionCategory, rewardFactor = 1, requires?: string): MissionDef =>
  ({ id, name, description, metric, target, scope, category, reward: MISSION_BALANCE.rewards[category] * rewardFactor, requires });
export const MISSIONS: readonly MissionDef[] = [
  m('first-kill','Primera baja','Derrota a 1 enemigo en total.','npc',1,'total','initiation'),
  m('street-cleaner','Limpieza callejera','Derrota a 100 enemigos en total.','npc',100,'total','initiation',2,'first-kill'),
  m('your-city','La ciudad es tuya','Derrota a 1000 enemigos en total.','npc',1000,'total','initiation',4,'street-cleaner'),
  m('first-wave','Primera oleada','Completa una oleada de Supervivencia.','waves',1,'total','initiation'),
  m('survivor','Superviviente','Alcanza la oleada 5 en una partida de Supervivencia.','wave',5,'best','initiation',2),
  m('unstoppable','Imparable','Alcanza la oleada 15 en una partida de Supervivencia.','wave',15,'best','initiation',4,'survivor'),
  m('first-mini','Primer escollo','Derrota a un mini boss en total.','mini',1,'total','initiation',2),
  m('first-boss','Cabeza de la serpiente','Derrota a un boss en total.','boss',1,'total','initiation',3),
  m('boss-hunter','Cazador de bosses','Derrota a 10 bosses en total.','boss',10,'total','initiation',5,'first-boss'),
  m('secured','Zona asegurada','Completa una captura.','captures',1,'total','initiation',2),
  m('supplies-cut','Cortar suministros','Desactiva un nido.','nests',1,'total','initiation',2),
  m('reactivation','Reactivación','Completa un Reactor inestable.','reactors',1,'total','initiation',2),
  m('elite-fell','La élite cayó','Completa una Oleada Élite.','elites',1,'total','initiation',2),
  m('damage-control','Control de daños','Completa 3 eventos de nido, reactor o élite en una partida.','specials',3,'best','initiation',4),
  m('awakening','Despertar','Activa Frenesis una vez en total.','activations',1,'total','initiation'),
  m('overload','Sobrecarga','Activa Frenesis 10 veces en total.','activations',10,'total','mastery',1,'awakening'),
  m('impossible-jump','Salto imposible','Realiza 10 teletransportes de Frenesis en total.','teleports',10,'total','mastery'),
  m('whirlwind','Torbellino','Derrota a 5 enemigos en un mismo giro de Frenesis.','spin',5,'best','mastery',2),
  m('collector','Recolector','Recoge 100 orbes de EXP en total.','orbs',100,'total','mastery'),
  m('rapid-evolution','Evolución acelerada','Alcanza el nivel 10 en una partida.','level',10,'best','mastery',2),
  m('purgatory-win','Victoria en Purgatorio','Supera un encuentro individual de Purgatorio.','wins',1,'total','mastery',2),
  m('greater-hunt','Cacería mayor','Derrota a 3 bosses en una misma partida.','boss',3,'best','mastery',2),
  m('wave-25','Veinticinco oleadas','Alcanza la oleada 25 en una partida de Supervivencia.','wave',25,'best','mastery',3,'unstoppable'),
  m('ten-thousand','Diez mil amenazas','Derrota a 10000 enemigos en total.','npc',10000,'total','mastery',4,'your-city'),
  m('unscathed','Sin un rasguño','Completa 5 oleadas consecutivas sin recibir daño.','flawless',5,'best','mastery',3),
  m('wave-50','Cincuenta oleadas','Alcanza la oleada 50 en una partida de Supervivencia.','wave',50,'best','extreme',2,'wave-25'),
  m('perfect-duel','Duelo perfecto','Derrota a un boss en Difícil sin daño durante todo el encuentro.','perfectHard',1,'total','extreme'),
  m('hard-purgatory','Purgatorio, Difícil','Supera un encuentro individual de Purgatorio en Difícil.','hardWins',1,'total','extreme'),
  m('impossible-purgatory','Purgatorio, Dystopia','Supera Purgatorio individual en Dystopia con vida máxima de 1.','impossibleWins',1,'total','extreme',2),
  m('no-margin','Sin margen de error','Alcanza la oleada 15 de Supervivencia en Dystopia.','impossibleWave',15,'best','extreme'),
  m('last-survivor','Último superviviente','Alcanza la oleada 30 de Supervivencia en Dystopia.','impossibleWave',30,'best','extreme',3,'no-margin'),
  m('ritual','Ritual completo','Completa 5 eventos de nido, reactor o élite en una partida.','specials',5,'best','extreme',2,'damage-control'),
  m('relentless','Cazador incansable','Derrota a 25 bosses en total.','boss',25,'total','extreme',2,'boss-hunter'),
  m('perfect-objective','Objetivo impecable','Completa una captura sin salir después de entrar.','perfectCapture',1,'total','extreme'),
  m('superhuman','Reflejos sobrehumanos','Derrota a un boss en Dystopia sin daño durante todo el encuentro.','perfectImpossible',1,'total','extreme',3),
];
export type MissionValues = Record<MissionMetric, number>;
export type MissionPulse = { runId: string; values: MissionValues; close: boolean };
export function missionPulse(s: SurvivalState, runId: string, close = false): MissionPulse {
  'worklet';
  const t = s.missions ?? createMissionTelemetry(), main = !s.purgatorio, win = s.mode === 'won' && s.purgatorio?.kind === 'single';
  return { runId, close: close || s.mode === 'dead' || s.mode === 'won', values: {
    npc:s.stats.npcKills, mini:s.stats.minibossKills, boss:s.stats.bossKills, waves:s.stats.wavesCleared,
    wave:main?s.encounter.wave:0, captures:t.captures,nests:t.nests,reactors:t.reactors,elites:t.elites,specials:t.nests+t.reactors+t.elites,
    activations:t.activations,teleports:t.teleports,spin:t.bestSpin,orbs:s.events.pickup,level:s.level,
    wins:win?1:0,hardWins:win&&s.difficulty==='hard'?1:0,impossibleWins:win&&s.difficulty==='dystopia'&&s.maxHp===1?1:0,
    impossibleWave:main&&s.difficulty==='dystopia'&&s.maxHp===1?s.encounter.wave:0,flawless:t.bestStreak,
    perfectHard:t.perfectHard,perfectImpossible:t.perfectImpossible,perfectCapture:t.perfectCaptures,
  } };
}
export type MissionProfile = { progress: Record<string, number>; claimed: string[]; runs: Record<string, Partial<MissionValues>>; closed: Record<string, true> };
export function emptyMissions(): MissionProfile { return { progress: Object.create(null), claimed: [], runs: Object.create(null), closed: Object.create(null) }; }
export function missionStatus(profile: MissionProfile, mission: MissionDef) {
  if (profile.claimed.includes(mission.id)) return 'claimed';
  if (mission.requires && !profile.claimed.includes(mission.requires)) return 'locked';
  const progress = profile.progress[mission.id] ?? 0;
  return progress >= mission.target ? 'pending' : progress > 0 ? 'progress' : 'available';
}
export function pendingMissions(profile: MissionProfile): MissionDef[] { return MISSIONS.filter(m => missionStatus(profile,m)==='pending'); }
export function advanceMissions(current: MissionProfile, pulse: MissionPulse): MissionProfile {
  if (!pulse.runId || pulse.runId.length > 128 || Object.hasOwn(current.closed,pulse.runId)) return current;
  const previous = Object.hasOwn(current.runs,pulse.runId) ? current.runs[pulse.runId] : {}, values = { ...previous };
  const progress = { ...current.progress };
  for (const mission of MISSIONS) {
    const value = pulse.values[mission.metric];
    if (!Number.isSafeInteger(value) || value < 0) continue;
    const prior = previous[mission.metric] ?? 0;
    progress[mission.id] = Math.min(mission.target,mission.scope==='total' ? (progress[mission.id]??0)+Math.max(0,value-prior) : Math.max(progress[mission.id]??0,value));
    values[mission.metric] = Math.max(prior,value);
  }
  const runs = { ...current.runs, [pulse.runId]: values }, closed = { ...current.closed };
  if (pulse.close) { delete runs[pulse.runId]; closed[pulse.runId]=true; }
  if (!pulse.close && JSON.stringify(progress)===JSON.stringify(current.progress) && JSON.stringify(values)===JSON.stringify(previous)) return current;
  return { ...current, progress, runs, closed };
}
export function readMissions(raw: unknown): MissionProfile {
  const result = emptyMissions();
  if (!raw || typeof raw!=='object') return result;
  const data=raw as MissionProfile;
  for(const m of MISSIONS){const n=data.progress?.[m.id];if(Number.isSafeInteger(n)&&n>=0)result.progress[m.id]=Math.min(m.target,n);}
  result.claimed=MISSIONS.filter(m=>Array.isArray(data.claimed)&&data.claimed.includes(m.id)).map(m=>m.id);
  if(data.closed&&typeof data.closed==='object')for(const[id,flag]of Object.entries(data.closed))if(flag===true&&id.length<=128)result.closed[id]=true;
  if(data.runs&&typeof data.runs==='object')for(const[id,values]of Object.entries(data.runs)){
    if(id.length>128||!values||typeof values!=='object'||Object.hasOwn(result.closed,id))continue;
    const clean:Partial<MissionValues>={};for(const m of MISSIONS){const n=values[m.metric];if(n!==undefined&&Number.isSafeInteger(n)&&n>=0)clean[m.metric]=n;}
    result.runs[id]=clean;
  }
  return result;
}
