import { useMemo } from 'react';
import { type SkImage } from '@shopify/react-native-skia';
import { useSharedImage as useImage } from '../ui/sharedImages';

// Full original sheets and cell-exact clips, visually audited alongside the
// supplied individual strips. Their order preserves the original actor indices.
export const ENEMY_IMAGE_SOURCES = [
  require('../../assets/assets/enemies/mini bosses/Shielder/Shielder 129x46 Sprite Sheet.png'), // 5 shielder
  require('../../assets/assets/bosses/rock boss/idle.png'), // 6 rockIdle
  require('../../assets/assets/bosses/rock boss/Melee attack.png'), // 7 rockMelee
  require('../../assets/assets/bosses/rock boss/wake.png'), // 8 rockWake
  require('../../assets/assets/bosses/rock boss/move.png'), // 9 rockMove
  require('../../assets/assets/bosses/rock boss/death.png'), // 10 rockDeath
  require('../../assets/assets/enemies/mini bosses/Evil sage/The Evil Sage 52x21.png'), // 11 sage
  require('../../assets/assets/enemies/mini bosses/Archer/All.png'), // 12 archer
  require('../../assets/assets/enemies/mini bosses/Bomb Droid/Idle.png'), // 13 bombIdle
  require('../../assets/assets/enemies/mini bosses/Bomb Droid/move.png'), // 14 bombMove
  require('../../assets/assets/enemies/mini bosses/Bomb Droid/bomb .png'), // 15 bombAttack
  require('../../assets/assets/enemies/mini bosses/Bomb Droid/death.png'), // 16 bombDeath
  require('../../assets/assets/enemies/mini bosses/Dagger Mush/All.png'), // 17 mush
  require('../../assets/assets/enemies/mini bosses/Shock Sweeper/Shock Sweeper All (88x30).png'), // 18 shock
  require('../../assets/assets/bosses/ancient guard/Guardian SpriteSheet 166x96.png'), // 19 guardian
  require('../../assets/assets/bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner 132x83.png'), // 20 skeleton
  require('../../assets/assets/bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit Sprite Sheet 128x78.png'), // 21 dagger
  require('../../assets/assets/bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit Sprite Sheet 85x112.png'), // 22 archerBandit
  require('../../assets/assets/bosses/Dust Jumper/Dust Jumper/Dust Jumper Sprite Sheet 42x91.png'), // 23 dust
  require('../../assets/assets/bosses/The Tarnished Widow 188x90/The Tarnished Widow 188x90.png'), // 24 widow
  require('../../assets/assets/bosses/SKELETON SUMMONER/Skeleton - Unarmed/Skeleton - Unarmed 43x22.png'), // 25 unarmed
  require('../../assets/assets/bosses/SKELETON SUMMONER/Skeleton Archer/Skeleton Archer 46x22.png'), // 26 skeletonArcher
  require('../../assets/assets/bosses/SKELETON SUMMONER/Skeleton Swordsman/Skeleton - Armored Swordsman 44x24.png'), // 27 swordsman
  require('../../assets/assets/bosses/rock boss/Spin charge.png'), // 28
  require('../../assets/assets/bosses/rock boss/Spin charge end.png'), // 29
  require('../../assets/assets/bosses/rock boss/super attack.png'), // 30
  require('../../assets/assets/bosses/rock boss/range attack.png'), // 31
  require('../../assets/assets/bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit Sprite Sheet without Bow 85x32.png'), // 32 independently aimed bow body
  require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Idle.png'), // 33 Electrocutioner Idle
  require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Attack.png'), // 34 Electrocutioner Attack
  require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Range Attack.png'), // 35 Electrocutioner Range Attack
  require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Teleport.png'), // 36 Electrocutioner Teleport
  require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Appear.png'), // 37 Electrocutioner Appear
  require('../../assets/assets/bosses/Electrocutioner/Electricuitioner-Death.png'), // 38 Electrocutioner Death
  require('../../assets/assets/enemies/mini bosses/The plague/Small Bug/Small Insect without shadow 20x28.png'), // 39 plague small
  require('../../assets/assets/enemies/mini bosses/The plague/Medium Bug/Medium Insect without shadow 34x37.png'), // 40 plague medium
  require('../../assets/assets/enemies/mini bosses/The plague/Medium bug 2/Medium2 bug 88x37.png'), // 41 plague medium2
  require('../../assets/assets/enemies/mini bosses/The plague/Big Bug/Big Insect without shadow 72x44 sprite sheet.png'), // 42 plague big
 ] as const;
// Fixed hook count, conditional sources: menu previews never decode battle sheets.
export function useEnemyImages(enabled: boolean, onError: (error: Error) => void): SkImage[] | null {
  const image0 = useImage(enabled ? ENEMY_IMAGE_SOURCES[0] : null, onError);
  const image1 = useImage(enabled ? ENEMY_IMAGE_SOURCES[1] : null, onError);
  const image2 = useImage(enabled ? ENEMY_IMAGE_SOURCES[2] : null, onError);
  const image3 = useImage(enabled ? ENEMY_IMAGE_SOURCES[3] : null, onError);
  const image4 = useImage(enabled ? ENEMY_IMAGE_SOURCES[4] : null, onError);
  const image5 = useImage(enabled ? ENEMY_IMAGE_SOURCES[5] : null, onError);
  const image6 = useImage(enabled ? ENEMY_IMAGE_SOURCES[6] : null, onError);
  const image7 = useImage(enabled ? ENEMY_IMAGE_SOURCES[7] : null, onError);
  const image8 = useImage(enabled ? ENEMY_IMAGE_SOURCES[8] : null, onError);
  const image9 = useImage(enabled ? ENEMY_IMAGE_SOURCES[9] : null, onError);
  const image10 = useImage(enabled ? ENEMY_IMAGE_SOURCES[10] : null, onError);
  const image11 = useImage(enabled ? ENEMY_IMAGE_SOURCES[11] : null, onError);
  const image12 = useImage(enabled ? ENEMY_IMAGE_SOURCES[12] : null, onError);
  const image13 = useImage(enabled ? ENEMY_IMAGE_SOURCES[13] : null, onError);
  const image14 = useImage(enabled ? ENEMY_IMAGE_SOURCES[14] : null, onError);
  const image15 = useImage(enabled ? ENEMY_IMAGE_SOURCES[15] : null, onError);
  const image16 = useImage(enabled ? ENEMY_IMAGE_SOURCES[16] : null, onError);
  const image17 = useImage(enabled ? ENEMY_IMAGE_SOURCES[17] : null, onError);
  const image18 = useImage(enabled ? ENEMY_IMAGE_SOURCES[18] : null, onError);
  const image19 = useImage(enabled ? ENEMY_IMAGE_SOURCES[19] : null, onError);
  const image20 = useImage(enabled ? ENEMY_IMAGE_SOURCES[20] : null, onError);
  const image21 = useImage(enabled ? ENEMY_IMAGE_SOURCES[21] : null, onError);
  const image22 = useImage(enabled ? ENEMY_IMAGE_SOURCES[22] : null, onError);
  const image23 = useImage(enabled ? ENEMY_IMAGE_SOURCES[23] : null, onError);
  const image24 = useImage(enabled ? ENEMY_IMAGE_SOURCES[24] : null, onError);
  const image25 = useImage(enabled ? ENEMY_IMAGE_SOURCES[25] : null, onError);
  const image26 = useImage(enabled ? ENEMY_IMAGE_SOURCES[26] : null, onError);
  const image27 = useImage(enabled ? ENEMY_IMAGE_SOURCES[27] : null, onError);
  const image28 = useImage(enabled ? ENEMY_IMAGE_SOURCES[28] : null, onError);
  const image29 = useImage(enabled ? ENEMY_IMAGE_SOURCES[29] : null, onError);
  const image30 = useImage(enabled ? ENEMY_IMAGE_SOURCES[30] : null, onError);
  const image31 = useImage(enabled ? ENEMY_IMAGE_SOURCES[31] : null, onError);
  const image32 = useImage(enabled ? ENEMY_IMAGE_SOURCES[32] : null, onError);
  const image33 = useImage(enabled ? ENEMY_IMAGE_SOURCES[33] : null, onError);
  const image34 = useImage(enabled ? ENEMY_IMAGE_SOURCES[34] : null, onError);
  const image35 = useImage(enabled ? ENEMY_IMAGE_SOURCES[35] : null, onError);
  const image36 = useImage(enabled ? ENEMY_IMAGE_SOURCES[36] : null, onError);
  const image37 = useImage(enabled ? ENEMY_IMAGE_SOURCES[37] : null, onError);
  return useMemo(() => {
    if (!enabled) return [];
    const images = [image0, image1, image2, image3, image4, image5, image6, image7, image8, image9, image10, image11, image12, image13, image14, image15, image16, image17, image18, image19, image20, image21, image22, image23, image24, image25, image26, image27, image28, image29, image30, image31, image32, image33, image34, image35, image36, image37];
    return images.every(Boolean) ? images as SkImage[] : null;
  }, [enabled, image0, image1, image2, image3, image4, image5, image6, image7, image8, image9, image10, image11, image12, image13, image14, image15, image16, image17, image18, image19, image20, image21, image22, image23, image24, image25, image26, image27, image28, image29, image30, image31, image32, image33, image34, image35, image36, image37]);
}
