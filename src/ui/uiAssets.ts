// Verified against the original UI PNGs; coordinates exclude adjacent sprites.
// These are static resources, not animation strips.
export const UI_ASSETS = {
  borders: require('../../assets/assets/UI/UI - Borders and HP/UI - 16x16 UI Tileset.png'),
  blank: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words15.png'),
  sliders: require('../../assets/assets/UI/UI - Sliders/Sliders 35x16.png'),
  start: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words5.png'),
  settings: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words4.png'),
  resume: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words11.png'),
  mainMenu: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words10.png'),
  back: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words8.png'),
  quit: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words3.png'),
  continue: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words1.png'),
  credits: require('../../assets/assets/UI/UI - Words/Words without BG/UI - Words6.png'),
  iconSettings: require('../../assets/assets/UI/UI - ICONS/UI - Icons1.png'),
  iconGamepad: require('../../assets/assets/UI/UI - ICONS/UI - Icons3.png'),
  iconVolume: require('../../assets/assets/UI/UI - ICONS/UI - Icons6.png'),
  iconMuted: require('../../assets/assets/UI/UI - ICONS/UI - Icons7.png'),
  iconCheck: require('../../assets/assets/UI/UI - ICONS/UI - Icons8.png'),
  iconClose: require('../../assets/assets/UI/UI - ICONS/UI - Icons9.png'),
  iconMenu: require('../../assets/assets/UI/UI - ICONS/UI - Icons12.png'),
  iconLeft: require('../../assets/assets/UI/UI - ICONS/UI - Icons16.png'),
  iconRight: require('../../assets/assets/UI/UI - ICONS/UI - Icons17.png'),
  iconMusic: require('../../assets/assets/UI/UI - ICONS/UI - Icons18.png'),
};

export type UIRect = { x: number; y: number; width: number; height: number };
export const UI_WORD_CROPS = {
  start: { x: 20, y: 7, width: 50, height: 18 },
  settings: { x: 10, y: 7, width: 74, height: 18 },
  resume: { x: 15, y: 7, width: 62, height: 18 },
  mainMenu: { x: 4, y: 7, width: 85, height: 18 },
  back: { x: 25, y: 7, width: 43, height: 18 },
  quit: { x: 28, y: 7, width: 36, height: 18 },
  continue: { x: 8, y: 7, width: 77, height: 18 },
  credits: { x: 13, y: 7, width: 66, height: 18 },
} satisfies Record<string, UIRect>;
export type UIWordName = keyof typeof UI_WORD_CROPS;

export const UI_ICON_CROPS = {
  settings: { sheet: 'iconSettings', x: 6, y: 6, width: 20, height: 21 },
  gamepad: { sheet: 'iconGamepad', x: 5, y: 3, width: 22, height: 23 },
  music: { sheet: 'iconMusic', x: 8, y: 6, width: 16, height: 20 },
  volume: { sheet: 'iconVolume', x: 4, y: 9, width: 18, height: 15 },
  muted: { sheet: 'iconMuted', x: 4, y: 10, width: 22, height: 13 },
  check: { sheet: 'iconCheck', x: 5, y: 8, width: 22, height: 18 },
  close: { sheet: 'iconClose', x: 7, y: 7, width: 18, height: 19 },
  menu: { sheet: 'iconMenu', x: 4, y: 9, width: 23, height: 16 },
  left: { sheet: 'iconLeft', x: 8, y: 9, width: 17, height: 15 },
  right: { sheet: 'iconRight', x: 7, y: 9, width: 17, height: 15 },
} satisfies Record<string, UIRect & { sheet: keyof typeof UI_ASSETS }>;
export type UIIconName = keyof typeof UI_ICON_CROPS;

// Borders tileset: six independent 48px frames on the y=64 row.
// Fixed corner cells retain their source size; only the edge runs extend.
export const UI_FRAME_CROPS = {
  panel: { sheet: 'borders', x: 160, y: 64, width: 48, height: 48, cap: 16, scale: 1 },
  primary: { sheet: 'borders', x: 112, y: 64, width: 48, height: 48, cap: 16, scale: 1 },
  button: { sheet: 'blank', x: 0, y: 0, width: 93, height: 33, cap: 3, scale: 2 },
  danger: { sheet: 'blank', x: 0, y: 0, width: 93, height: 33, cap: 3, scale: 2 },
} satisfies Record<string, UIRect & { sheet: keyof typeof UI_ASSETS; cap: number; scale: number }>;
export type UIFrameVariant = keyof typeof UI_FRAME_CROPS;
export const UI_ORNAMENT_CROP: UIRect = { x: 14, y: 40, width: 68, height: 13 };
export const UI_SLIDER = { sheetWidth: 525, sheetHeight: 48, width: 35, height: 16, y: 16, frames: 13 };
export function sliderSource(value: number): UIRect {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return { x: Math.round(normalized * (UI_SLIDER.frames - 1)) * UI_SLIDER.width,
    y: UI_SLIDER.y, width: UI_SLIDER.width, height: UI_SLIDER.height };
}
