import { suspendFrenesisAttack, releaseFrenesisAttack } from './frenesis';
import type { SurvivalState } from './survival';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ControlVisual } from '../ui/ControlVisual';
import { controlArea, controlBox, resolveControlLayout, elementOpacity } from '../ui/controlLayout';
import { useControlSettings } from '../ui/ControlPreferences';
import { requestAttack, beginDash, DASH_COOLDOWN_MS, JOYSTICK_TRAVEL, joystickInput, REST_INPUT, type MoveInput, type PlayerState } from './player';

type Props = { player: SharedValue<PlayerState>; input: SharedValue<MoveInput>; enabled: boolean; onPause?: () => void; onPausePressIn?: () => void;
  gameState?: SharedValue<SurvivalState>; clock?: SharedValue<{running:boolean;firstFrame:boolean}>; pauseAvailable?: boolean };
export function TouchControls({ player, input, enabled, onPause, onPausePressIn, gameState, clock, pauseAvailable = false }: Props) {
  const { settings } = useControlSettings();
  const window = useWindowDimensions(), insets = useSafeAreaInsets();
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const width = viewport?.width ?? window.width, height = viewport?.height ?? window.height;
  const boxes = useMemo(() => {
    const area = controlArea(width, height, insets), layout = resolveControlLayout(settings, area);
    return { joystick: controlBox('joystick', layout.joystick, area), attack: controlBox('attack', layout.attack, area),
      dash: controlBox('dash', layout.dash, area), pause: controlBox('pause', layout.pause, area) };
  }, [width, height, insets, settings]);
  const knob = useSharedValue({ x: 0, y: 0 });
  const attackPressed = useSharedValue(false);
  const dashPressed = useSharedValue(false);
  const pauseRequested = useSharedValue(false);
  useEffect(() => { if (enabled || pauseAvailable) pauseRequested.set(false); }, [enabled, pauseAvailable, pauseRequested]);
  const notifyPause = React.useCallback(() => { onPause?.(); onPausePressIn?.(); }, [onPause, onPausePressIn]);
  useEffect(() => {
    input.set(REST_INPUT);
    knob.set({ x: 0, y: 0 });
    attackPressed.set(false);
    player.set(suspendFrenesisAttack(player.value));
    dashPressed.set(false);
  }, [enabled, input, knob, attackPressed, dashPressed, settings, width, height, player]);

  const gestures = useMemo(() => {
    const allowed = () => { 'worklet'; return (!clock || clock.value.running) && (!gameState || gameState.value.mode === 'playing'); };
    const attack = Gesture.Pan().enabled(enabled).minDistance(0).maxPointers(1).shouldCancelWhenOutside(false).runOnJS(false)
      .onBegin(() => {
        'worklet';
        if (!allowed()) return;
        attackPressed.set(true);
        player.set(requestAttack(player.value));
      }).onFinalize(() => { 'worklet'; attackPressed.set(false); player.set(allowed()?releaseFrenesisAttack(player.value):suspendFrenesisAttack(player.value)); });
    const dash = Gesture.Tap().enabled(enabled).maxDuration(10000).runOnJS(false)
      .onBegin(() => {
        'worklet';
        if (!allowed()) return;
        dashPressed.set(true);
        player.set(beginDash(player.value, input.value));
      }).onFinalize(() => { 'worklet'; dashPressed.set(false); });
    const updateStick = (x: number, y: number) => {
      'worklet';
      if (!allowed()) return;
      const dx = (x - boxes.joystick.width / 2) / boxes.joystick.scale;
      const dy = (y - boxes.joystick.height / 2) / boxes.joystick.scale;
      const length = Math.hypot(dx, dy);
      const ratio = length > JOYSTICK_TRAVEL ? JOYSTICK_TRAVEL / length : 1;
      knob.set({ x: dx * ratio * boxes.joystick.scale, y: dy * ratio * boxes.joystick.scale });
      input.set(joystickInput(dx, dy, settings.deadZone));
    };
    const stick = Gesture.Pan().enabled(enabled).minDistance(0).minPointers(1).maxPointers(1)
      .enableTrackpadTwoFingerGesture(false).shouldCancelWhenOutside(false).runOnJS(false)
      .onBegin((event) => { 'worklet'; updateStick(event.x, event.y); })
      .onUpdate((event) => { 'worklet'; updateStick(event.x, event.y); })
      .onFinalize(() => {
        'worklet';
        input.set(REST_INPUT);
        knob.set({ x: 0, y: 0 });
      });
    // Explicit native relations allow the left thumb to keep moving while the
    // right thumb attacks/dashes. Neither control is a whole-screen recognizer.
    stick.simultaneousWithExternalGesture(attack, dash);
    attack.simultaneousWithExternalGesture(stick, dash);
    dash.simultaneousWithExternalGesture(stick, attack);
    const pause = onPause ? Gesture.Tap().enabled(enabled || pauseAvailable).maxDuration(10000).runOnJS(false)
      .onBegin(() => {
        'worklet';
        if (pauseRequested.value) return;
        pauseRequested.set(true);
        clock?.set({ running: false, firstFrame: true });
        input.set(REST_INPUT); knob.set({ x: 0, y: 0 });
        attackPressed.set(false); dashPressed.set(false);
        player.set(suspendFrenesisAttack(player.value));
        scheduleOnRN(notifyPause);
      }) : null;
    if (pause) {
      pause.simultaneousWithExternalGesture(stick, attack, dash);
      stick.simultaneousWithExternalGesture(pause);
      attack.simultaneousWithExternalGesture(pause);
      dash.simultaneousWithExternalGesture(pause);
    }
    return { stick, attack, dash, pause };
  }, [enabled, input, knob, player, attackPressed, dashPressed, boxes, settings.deadZone, gameState, clock, onPause, pauseAvailable, pauseRequested, notifyPause]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knob.value.x }, { translateY: knob.value.y }] }));
  const attackStyle = useAnimatedStyle(() => ({
    opacity: elementOpacity(settings,'attack'),
    transform: [{ scale: attackPressed.value ? 0.95 : 1 }],
  }));
  const dashStyle = useAnimatedStyle(() => ({
    opacity: elementOpacity(settings,'dash') * (player.value.dashCooldownMs > 0 ? 0.56 : 1),
    transform: [{ scale: dashPressed.value ? 0.95 : 1 }],
  }));
  const recoveryStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, Math.min(1, 1 - player.value.dashCooldownMs / (DASH_COOLDOWN_MS * (player.value.dashCooldownMultiplier ?? 1)))) }] }));
  if (!enabled && !pauseAvailable) return null;
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={event => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setViewport(previous => previous?.width === w && previous?.height === h ? previous : { width: w, height: h });
  }}>
    {enabled && <><GestureDetector gesture={gestures.stick} touchAction="none" userSelect="none">
      <View testID="game-control-joystick" style={[styles.zone, { left: boxes.joystick.x, top: boxes.joystick.y, width: boxes.joystick.width, height: boxes.joystick.height }]} collapsable={false} accessibilityLabel="Joystick: mueve en ocho direcciones. Desliza poco para caminar o hasta el borde para correr.">
        <View style={{ opacity: elementOpacity(settings,'joystick') }}><ControlVisual id="joystick" width={boxes.joystick.visualWidth} height={boxes.joystick.visualHeight} knobStyle={knobStyle} /></View>
      </View>
    </GestureDetector>
      <GestureDetector gesture={gestures.dash} touchAction="none" userSelect="none">
        <View testID="game-control-dash" style={[styles.zone, { left: boxes.dash.x, top: boxes.dash.y, width: boxes.dash.width, height: boxes.dash.height }]} collapsable={false} accessibilityRole="button" accessibilityLabel="Dash: impulsa en la dirección de movimiento o de la última orientación.">
          <Animated.View style={dashStyle}><ControlVisual id="dash" width={boxes.dash.visualWidth} height={boxes.dash.visualHeight} recoveryStyle={recoveryStyle} /></Animated.View>
        </View>
      </GestureDetector>
      <GestureDetector gesture={gestures.attack} touchAction="none" userSelect="none">
        <View testID="game-control-attack" style={[styles.zone, { left: boxes.attack.x, top: boxes.attack.y, width: boxes.attack.width, height: boxes.attack.height }]} collapsable={false} accessibilityRole="button" accessibilityLabel="Ataque. En Frenesis: toca para tajos, mantén pulsado para girar.">
          <Animated.View style={attackStyle}><ControlVisual id="attack" width={boxes.attack.visualWidth} height={boxes.attack.visualHeight} /></Animated.View>
        </View>
      </GestureDetector>
    </>}
    {gestures.pause && <GestureDetector gesture={gestures.pause} touchAction="none" userSelect="none">
      <View testID="game-control-pause" collapsable={false} accessibilityRole="button" accessibilityLabel="Pausar partida"
        style={[styles.zone, { left: boxes.pause.x, top: boxes.pause.y, width: boxes.pause.width, height: boxes.pause.height, opacity: elementOpacity(settings,'pause') }]}>
        <ControlVisual id="pause" width={boxes.pause.visualWidth} height={boxes.pause.visualHeight} />
      </View>
    </GestureDetector>}
  </View>;
}
const styles = StyleSheet.create({
  zone: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
