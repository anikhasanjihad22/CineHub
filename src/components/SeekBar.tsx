import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

// Draggable progress bar for the video player.
export function SeekBar({ position, duration, buffered = 0, onStart, onScrub, onCommit }: {
  position: number; duration: number; buffered?: number;
  onStart?: () => void; onScrub?: (t: number) => void; onCommit: (t: number) => void;
}) {
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const wRef = useRef(1);
  const durRef = useRef(0);
  durRef.current = duration;
  const cb = useRef({ onStart, onScrub, onCommit });
  cb.current = { onStart, onScrub, onCommit };
  const startX = useRef(0);

  const toTime = (x: number) => {
    const cl = Math.min(Math.max(x, 0), wRef.current);
    return (cl / wRef.current) * durRef.current;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        const t = toTime(startX.current);
        setDrag(t);
        cb.current.onStart?.();
        cb.current.onScrub?.(t);
      },
      onPanResponderMove: (_e, g) => {
        const t = toTime(startX.current + g.dx);
        setDrag(t);
        cb.current.onScrub?.(t);
      },
      onPanResponderRelease: (_e, g) => {
        const t = toTime(startX.current + g.dx);
        setDrag(null);
        cb.current.onCommit(t);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  const shown = drag ?? position;
  const pct = duration > 0 ? Math.min(Math.max(shown / duration, 0), 1) : 0;
  const bufPct = duration > 0 ? Math.min(Math.max(buffered / duration, 0), 1) : 0;

  return (
    <View
      style={styles.hit}
      onLayout={(e) => { wRef.current = Math.max(e.nativeEvent.layout.width, 1); setW(wRef.current); }}
      {...pan.panHandlers}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.buf, { width: bufPct * w }]} />
        <View style={[styles.fill, { width: pct * w }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, drag !== null && styles.thumbBig, { left: pct * w - (drag !== null ? 9 : 7) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 36, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  buf: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.35)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent },
  thumb: { position: 'absolute', top: 11, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
  thumbBig: { top: 9, width: 18, height: 18, borderRadius: 9 },
});
