import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export const RESUME_STEP_MS=1000;
/** Wall-clock UI timers; no simulation time is advanced to run this countdown. */
export function useResumeCountdown(blocked: SharedValue<boolean>, canCount: boolean, request: number, stopControls:()=>void) {
  const [number,setNumber]=useState<number|null>(null);
  const running=useRef(false),lastRequest=useRef(request),timer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),available=useRef(false);
  const clear=useCallback(()=>{generation.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);
  const cancel=useCallback(()=>{clear();running.current=false;blocked.set(false);setNumber(null);},[blocked,clear]);
  const start=useCallback(()=>{
    if(!available.current||running.current)return;
    running.current=true;clear();blocked.set(true);stopControls();setNumber(3);
  },[blocked,clear,stopControls]);
  // A worklet can enqueue start before pause/background and deliver it later.
  // Consult this commit's availability instead of the enqueued closure's props.
  // Layout cleanup also rejects delayed callbacks after the scene unmounts.
  useLayoutEffect(()=>{available.current=canCount;return()=>{available.current=false;};},[canCount]);
  // Gate the shared simulation synchronously before a resumed scene can paint.
  // Router can deliver the resume request one commit before /game becomes active.
  // Keep it pending until this scene is eligible instead of losing that request.
  useLayoutEffect(()=>{if(request!==lastRequest.current&&canCount){lastRequest.current=request;start();}},[request,canCount,start]);
  // Pause/background cancellation must clear the visible countdown in this commit.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(()=>{if(!canCount)cancel();},[canCount,cancel]);
  useEffect(()=>{
    if(number===null||!canCount)return;
    const own=++generation.current;
    timer.current=setTimeout(()=>{if(generation.current!==own)return;timer.current=null;if(number===1){running.current=false;blocked.set(false);setNumber(null);}else setNumber(number-1);},RESUME_STEP_MS);
    return()=>{clear();};
  },[number,canCount,blocked,clear]);
  useEffect(()=>()=>{clear();running.current=false;blocked.set(false);},[blocked,clear]);
  return {number,start,cancel};
}
