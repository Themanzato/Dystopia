/** The readiness fence watches native player status, never an estimated delay. */
export const OPTIONAL_AUDIO_TIMEOUT_MS = 8000;
export type PreparationStatus = { isLoaded: boolean; error?: string | null };
export type PreparedAudioPlayer = {
  isLoaded: boolean;
  currentStatus?: PreparationStatus;
  addListener(event: 'playbackStatusUpdate', callback: (status: PreparationStatus) => void): { remove(): void };
};
export function watchAudioPreparation(
  players: Record<string, PreparedAudioPlayer>,
  progress: (completed: number, total: number) => void,
  complete: () => void,
  fail: (key: string, reason: string) => void,
  timeoutMs = OPTIONAL_AUDIO_TIMEOUT_MS,
): () => void {
  const entries=Object.entries(players), settled=new Set<string>();
  const listeners:{remove():void}[]=[];
  let disposed=false, installing=true, finished=false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup=()=>{if(timer!==undefined)clearTimeout(timer);listeners.splice(0).forEach(listener=>listener.remove());};
  const finish=()=>{
    if(!disposed&&!installing&&!finished&&settled.size===entries.length){finished=true;cleanup();complete();}
  };
  const resolve=(key:string,reason?:string)=>{
    if(disposed||settled.has(key))return;
    settled.add(key);
    if(reason)fail(key,reason);
    progress(settled.size,entries.length);
    finish();
  };
  progress(0,entries.length);
  for(const [key,player]of entries){
    const inspect=(status?:PreparationStatus)=>{
      if(status?.error)resolve(key,status.error);
      else if(status?.isLoaded||player.isLoaded)resolve(key);
    };
    try{
      inspect(player.currentStatus);
      if(!settled.has(key)){
        listeners.push(player.addListener('playbackStatusUpdate',inspect));
        // The native load may finish between initial read and subscription.
        inspect(player.currentStatus);
      }
    }catch(cause){resolve(key,cause instanceof Error?cause.message:String(cause));}
  }
  installing=false;finish();
  if(!finished)timer=setTimeout(()=>{
    for(const [key]of entries)if(!settled.has(key))resolve(key,'Tiempo de carga agotado; sonido desactivado para esta partida.');
  },timeoutMs);
  return()=>{disposed=true;cleanup();};
}


export const AUDIO_PREPARATION_CONCURRENCY = 3;
/** Source transfer and native readiness are different stages. Queued resources
 * never spend a shared eight-second budget waiting behind other resources.
 * An idle deadline releases the scene with safe fallbacks, but keeps observing
 * delayed resources so they become usable without restarting the run. */
export function prepareAudioQueue<P extends PreparedAudioPlayer>(
  players: Record<string, P>,
  load: (player: P, live: () => boolean) => Promise<void>,
  progress: (completed: number, total: number) => void,
  complete: () => void,
  fail: (key: string, reason: string) => void,
  recovered: (key: string) => void,
  deferred: (keys: string[]) => void,
): () => void {
  const entries = Object.entries(players);
  const settled = new Set<string>(), delayed = new Set<string>();
  const pending = entries.filter(([,p]) => !p.isLoaded || p.currentStatus?.error);
  const listeners = new Map<string, {remove(): void}>();
  const decodeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false, finished = false, installing = true, active = 0, index = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const clearDecode = (key: string) => {
    const timer = decodeTimers.get(key); if (timer !== undefined) clearTimeout(timer);
    decodeTimers.delete(key);
  };
  const finish = () => {
    if (!disposed && !installing && !finished && settled.size === entries.length) {
      finished = true; if (idleTimer !== undefined) clearTimeout(idleTimer);
      complete();
    }
  };
  const settle = (key: string) => {
    if (settled.has(key)) return;
    settled.add(key); progress(settled.size, entries.length); finish();
  };
  const idle = () => {
    if (finished || disposed) return;
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const keys = entries.filter(([key]) => !settled.has(key)).map(([key]) => key);
      for (const key of keys) delayed.add(key);
      deferred(keys);
      for (const key of keys) settle(key);
    }, OPTIONAL_AUDIO_TIMEOUT_MS);
  };
  const pump = () => {
    if (disposed) return;
    while (active < AUDIO_PREPARATION_CONCURRENCY && index < pending.length) {
      const [key, player] = pending[index++]; active++;
      let released = false, ended = false;
      const release = () => {
        if (released) return; released = true; active--; clearDecode(key); pump();
      };
      const inspect = (status?: PreparationStatus) => {
        if (disposed || ended) return;
        if (status?.error) {
          ended = true; listeners.get(key)?.remove(); listeners.delete(key);
          delayed.delete(key); fail(key, status.error); settle(key); idle(); release();
        // SDK57 web currentStatus reports isLoaded:true even on an empty
        // media element. The player's actual loaded getter is authoritative.
        } else if (player.isLoaded) {
          ended = true; listeners.get(key)?.remove(); listeners.delete(key);
          if (delayed.delete(key)) recovered(key);
          settle(key); idle(); release();
        }
      };
      try {
        const subscription = player.addListener('playbackStatusUpdate', inspect);
        // Do not retain a listener after synchronous native readiness.
        if (ended) subscription.remove(); else listeners.set(key, subscription);
        inspect(player.currentStatus);
        if (!ended) void Promise.resolve().then(() => {
          if (!disposed) return load(player, () => !disposed && !ended);
        }).then(() => {
          if (disposed || ended) return;
          // Only the native preparation gets a per-player decode timeout.
          // File downloads waiting in the queue never use this budget.
          idle(); inspect(player.currentStatus);
          if (!ended) decodeTimers.set(key, setTimeout(() => {
            delayed.add(key); deferred([key]); settle(key); release();
            // Keep this listener: a delayed STATE_READY recovers the cue.
          }, OPTIONAL_AUDIO_TIMEOUT_MS));
        }).catch(cause => {
          if (disposed || ended) return;
          ended = true; listeners.get(key)?.remove(); listeners.delete(key);
          delayed.delete(key); fail(key, cause instanceof Error ? cause.message : String(cause));
          settle(key); idle(); release();
        });
      } catch (cause) {
        ended = true; listeners.get(key)?.remove(); listeners.delete(key);
        fail(key, cause instanceof Error ? cause.message : String(cause)); settle(key); idle(); release();
      }
    }
  };
  progress(0, entries.length);
  for (const [key, player] of entries) if (player.isLoaded && !player.currentStatus?.error) settle(key);
  installing = false; finish(); idle(); pump();
  return () => {
    disposed = true; if (idleTimer !== undefined) clearTimeout(idleTimer);
    for (const key of decodeTimers.keys()) clearDecode(key);
    for (const listener of listeners.values()) listener.remove(); listeners.clear();
  };
}
