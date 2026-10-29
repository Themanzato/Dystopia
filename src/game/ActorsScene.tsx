import FrenesisEffects from './FrenesisEffects';
import { bossHitOpacity } from './bossHitFeedback';
import { MERCHANT_SOURCES, MERCHANT_ART, merchantVisual } from './merchantAssets';
import { useBossEffectImages } from './BossCombatEffects';
import { ENEMY_DEFS } from './enemyCatalog';
import { FRENESIS_SOURCES, FRENESIS_CELL, frenesisFrame } from './frenesisAssets';
import { frenesisVisualPosition } from './frenesis';
import React, { useEffect, useMemo } from 'react';
import { type SkImage } from '@shopify/react-native-skia';
import { useSharedImage as useImage, useSharedImageState } from '../ui/sharedImages';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { WorldEventGround } from './WorldEventEffects';
import { OptionalEventGround } from './OptionalEventEffects';
import { Scene } from './Scene';
import { NPC_ASSETS } from './npcAssets';
import { NPC_POOL_SIZE, npcCell, npcFrame } from './npc';
import { PLAYER_CELL, PLAYER_SCALE, playerFrame, type PlayerState } from './player';
import { bossFrame } from './survivalAssets';
import { plagueWarningOpacity } from './plagueAssets';
import { useEnemyImages } from './enemyVisuals';
import type { SurvivalState } from './survival';
import type { Encounter } from './encounter';
import type { RenderActor } from './renderTypes';
import { DUMMY_CELL, TUTORIAL_DUMMY_SOURCES, tutorialDummyFrame, type TutorialRenderState } from './tutorialAssets';

const PLAYER_ASSET = require('../../assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png');
type Props = { player: SharedValue<PlayerState>; encounter: SharedValue<Encounter>; survival?: SharedValue<SurvivalState>; active: boolean;
  onError: (error: Error) => void; onReady: () => void; onActorsReady: () => void; onImages?: (images: SkImage[]) => void; previewTimeMs?: number; training?: boolean };
export function ActorsScene({ player, encounter, survival, active, onError, onReady, onActorsReady, onImages, previewTimeMs, training = false }: Props) {
  const hero = useImage(PLAYER_ASSET, onError);
  const ghoul = useImage(NPC_ASSETS.sheet, onError);
  const idle = useImage(NPC_ASSETS.idle, onError);
  // Menu previews retain their small three-image set. Battle sheets load once
  // when a playable session mounts, while its real loading screen is visible.
  const spitter = useImage(survival ? NPC_ASSETS.spitter : null, onError);
  const summoner = useImage(survival ? NPC_ASSETS.summoner : null, onError);
  const enemyImages = useEnemyImages(Boolean(survival), onError);
  const effectImages = useBossEffectImages(Boolean(survival), onError);
  const f0 = useImage(survival ? FRENESIS_SOURCES[0] : null, onError), f1 = useImage(survival ? FRENESIS_SOURCES[1] : null, onError);
  const f2 = useImage(survival ? FRENESIS_SOURCES[2] : null, onError), f3 = useImage(survival ? FRENESIS_SOURCES[3] : null, onError);
  const f4 = useImage(survival ? FRENESIS_SOURCES[4] : null, onError), f5 = useImage(survival ? FRENESIS_SOURCES[5] : null, onError);
  const f6 = useImage(survival ? FRENESIS_SOURCES[6] : null, onError), f7 = useImage(survival ? FRENESIS_SOURCES[7] : null, onError);
  const m0=useImage(survival?MERCHANT_SOURCES[0]:null,onError),m1=useImage(survival?MERCHANT_SOURCES[1]:null,onError);
  const m2=useImage(survival?MERCHANT_SOURCES[2]:null,onError),m3=useImage(survival?MERCHANT_SOURCES[3]:null,onError);
  // Tutorial mode is fixed for the lifetime of this session. Normal games and
  // menu previews do not fetch/decode any of the three practice-only sheets.
  const tutorialEnabled = training && Boolean(survival);
  const d0 = useSharedImageState(TUTORIAL_DUMMY_SOURCES[0], tutorialEnabled);
  const d1 = useSharedImageState(TUTORIAL_DUMMY_SOURCES[1], tutorialEnabled);
  const d2 = useSharedImageState(TUTORIAL_DUMMY_SOURCES[2], tutorialEnabled);
  useEffect(() => {
    if (tutorialEnabled && (d0.error || d1.error || d2.error)) onError(new Error('No se pudo cargar el maniquí de entrenamiento.'));
  }, [tutorialEnabled, d0.error, d1.error, d2.error, onError]);
  const frenesisOffset = 5 + (enemyImages?.length ?? 0);
  const dummyOffset = frenesisOffset + 12;
  const images = useMemo(() => {
    if (!hero || !ghoul || !idle) return null;
    if (!survival) return [hero, ghoul, idle];
    if (!spitter || !summoner || !enemyImages || !effectImages || !f0 || !f1 || !f2 || !f3 || !f4 || !f5 || !f6 || !f7 || !m0 || !m1 || !m2 || !m3) return null;
    if (tutorialEnabled && (!d0.image || !d1.image || !d2.image)) return null;
    return [hero, ghoul, idle, spitter, summoner, ...enemyImages, f0, f1, f2, f3, f4, f5, f6, f7,m0,m1,m2,m3,
      ...(tutorialEnabled ? [d0.image!, d1.image!, d2.image!] : [])];
  }, [hero, ghoul, idle, survival, spitter, summoner, enemyImages, effectImages, f0, f1, f2, f3, f4, f5, f6, f7,m0,m1,m2,m3,tutorialEnabled,d0.image,d1.image,d2.image]);
  useEffect(() => { if (images) { onActorsReady(); onImages?.(images); } }, [images, onActorsReady, onImages]);
  const actors = useDerivedValue<RenderActor[]>(() => {
    const p = player.value;
    const state = survival?.value;
    // Blink in place during damage protection, keeping a stable depth anchor.
    const visible = p.action === 'death' || !state || state.invulnerableMs <= 0 || Math.floor(state.invulnerableMs / 85) % 2 === 0;
    const transformed = Boolean(state?.frenesis?.active), frame = frenesisFrame(p, state?.frenesis), visual = frenesisVisualPosition(p, state?.frenesis);
    const result: RenderActor[] = [{ id: 0, image: transformed ? frenesisOffset + frame.image : 0, source: transformed ? frame.source : playerFrame(p), x: visual.x, y: visual.y, depth: visual.y,
      scale: transformed ? FRENESIS_CELL.scale : PLAYER_SCALE, pivotX: transformed ? FRENESIS_CELL.pivotX : PLAYER_CELL.pivotX, pivotY: transformed ? FRENESIS_CELL.pivotY : PLAYER_CELL.pivotY, facingX: p.facingX*(transformed?frame.authoredFacing:1), visible }];
    for (const npc of (state?.encounter ?? encounter.value).enemies) if (npc.active) {
      const frame = npcFrame(npc), cell = npcCell(npc);
      result.push({ id: npc.id, image: frame.image, source: frame.source, x: npc.x, y: npc.y, depth: npc.y,
        scale: cell.scale, pivotX: cell.pivotX, pivotY: cell.pivotY, facingX: npc.facingX, visible: true });
    }
    const bosses = state ? [...(state.boss ? [state.boss] : []), ...(state.partner ? [state.partner] : []), ...state.minibosses] : [];
    for (let index = 0; index < bosses.length; index++) {
      const b = bosses[index];
      if (b.phase === 'death' && b.phaseMs >= ENEMY_DEFS[b.id].deathDurationMs) continue;
      const frame = bossFrame(b);
      result.push({ id: 1000000 + (b.entityId ?? index), image: frame.image, source: frame.source, x: b.x, y: b.y - (b.plague?.height ?? 0), depth: b.y,
        scale: frame.scale, pivotX: frame.pivotX, pivotY: frame.pivotY,
        // Match logical facing with each sheet's actual weapon/body direction.
        facingX: b.facingX * frame.authoredFacing, visible: frame.visible, opacity: bossHitOpacity(b.hitFlashMs??0)*(b.cloneOf?0.5:1)*(b.plague?plagueWarningOpacity(b):1) });
    }
    const merchant=state?.merchants?.active;
    if(merchant){const art=MERCHANT_ART[merchant.kind],visual=merchantVisual(merchant);result.push({id:2000000+merchant.id,image:frenesisOffset+8+art.image,source:visual.source,x:merchant.x,y:merchant.y,depth:merchant.y,scale:art.scale,pivotX:art.pivotX,pivotY:visual.pivotY,facingX:1,visible:true,opacity:visual.opacity});}
    const dummy = (state as (SurvivalState & { tutorial?: TutorialRenderState }) | undefined)?.tutorial?.dummy;
    if (dummy) {
      const frame = tutorialDummyFrame(dummy.action, dummy.elapsedMs);
      if (frame.visible) result.push({ id: 3000000, image: dummyOffset + frame.image, source: frame.source,
        x: dummy.x, y: dummy.y, depth: dummy.y, scale: DUMMY_CELL.scale,
        pivotX: DUMMY_CELL.pivotX, pivotY: DUMMY_CELL.pivotY, facingX: 1, visible: true });
    }
    return result;
  });
  if (!images) return null;
  return <Scene groundOverlay={survival ? <><WorldEventGround survival={survival} /><OptionalEventGround survival={survival}/><FrenesisEffects survival={survival} player={player} images={images} active={active}/></> : undefined} active={active} onError={onError} onReady={onReady} actors={actors} actorImages={images} actorCapacity={NPC_POOL_SIZE + 1 + (survival ? 21 : 0) + Number(tutorialEnabled)} previewTimeMs={previewTimeMs} />;
}
