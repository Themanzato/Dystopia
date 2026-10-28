import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useControlSettings } from './ControlPreferences';

/** Wrap only in-world HUD, never modal selections, pause/results or the editor.
 * Opacity changes drawing only: child touch footprints remain untouched. */
export default function GameUIOpacity({ children, active = true }: { children: ReactNode; active?: boolean }) {
  const { settings } = useControlSettings();
  return <View testID="game-ui-opacity" pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: active ? settings.hudOpacity ?? 1 : 1 }]}>{children}</View>;
}
