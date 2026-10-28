import { useQueuedAudioPlayer as useAudioPlayer } from './useQueuedAudioPlayer';
import { useMemo } from 'react';

const OPTIONS = { updateInterval: 1000, keepAudioSessionActive: true, downloadFirst: false };
/** Fixed hook/player count. Prepared once with the existing battle audio barrier. */
export function useActionSoundPlayers() {
  const archerShot = useAudioPlayer(require('../../assets/sounds/mixed/archer-shot.wav'), OPTIONS);
  const sageCharge = useAudioPlayer(require('../../assets/sounds/mixed/charge-explosion-evil-sage.wav'), OPTIONS);
  const sageExplosion = useAudioPlayer(require('../../assets/sounds/mixed/explosiones-evil-sage.wav'), OPTIONS);
  const daggerSlash = useAudioPlayer(require('../../assets/sounds/mixed/dagger-attack1.wav'), OPTIONS);
  const electroStorm = useAudioPlayer(require('../../assets/sounds/mixed/electrocutioner-explosion.wav'), OPTIONS);
  const guardianSquare = useAudioPlayer(require('../../assets/sounds/mixed/laser-guardian-cuadrado.wav'), OPTIONS);
  const guardianLaser = useAudioPlayer(require('../../assets/sounds/mixed/laser-guardian.wav'), OPTIONS);
  const electroProjectile = useAudioPlayer(require('../../assets/sounds/mixed/proyectil-electrocutioner.wav'), OPTIONS);
  const widowVoice1 = useAudioPlayer(require('../../assets/sounds/mixed/tarnished-widow-voice1.wav'), OPTIONS);
  const widowVoice2 = useAudioPlayer(require('../../assets/sounds/mixed/tarnished-widow-voice2.wav'), OPTIONS);
  const electroTeleport = useAudioPlayer(require('../../assets/sounds/mixed/teleport-electrocutioner.wav'), OPTIONS);
  const guardianTeleport = useAudioPlayer(require('../../assets/sounds/mixed/teleport-guardian.wav'), OPTIONS);
  const guardianLasers = useAudioPlayer(require('../../assets/sounds/mixed/varios-laseres-guardian.wav'), OPTIONS);
  const dustBeepFast = useAudioPlayer(require('../../assets/sounds/mixed/beepbeepcount-corto.wav'), OPTIONS);
  const dustBeepTrack = useAudioPlayer(require('../../assets/sounds/mixed/beepbeepcount.wav'), OPTIONS);
  const dustBomb = useAudioPlayer(require('../../assets/sounds/mixed/bomba-jump-duster.wav'), OPTIONS);
  const dustSlam = useAudioPlayer(require('../../assets/sounds/mixed/slam-jump-duster.wav'), OPTIONS);
  return useMemo(() => ({ archerShot, sageCharge, sageExplosion, daggerSlash, electroStorm, guardianSquare, guardianLaser, electroProjectile, widowVoice1, widowVoice2, electroTeleport, guardianTeleport, guardianLasers, dustBeepFast, dustBeepTrack, dustBomb, dustSlam }), [archerShot, sageCharge, sageExplosion, daggerSlash, electroStorm, guardianSquare, guardianLaser, electroProjectile, widowVoice1, widowVoice2, electroTeleport, guardianTeleport, guardianLasers, dustBeepFast, dustBeepTrack, dustBomb, dustSlam]);
}
