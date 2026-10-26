import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { isTV } from '../lib/platform';

// A Pressable that shows a white focus ring + slight zoom when the TV remote selects it.
// On phones it behaves like a normal Pressable.
export function Focusable({ children, style, ring = 12, ...rest }: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>); ring?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      focusable
      {...rest}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      style={(s) => [typeof style === 'function' ? style(s) : style, isTV && focused && { transform: [{ scale: 1.06 }], zIndex: 5 }]}
    >
      {children as any}
      {isTV && focused && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: ring, borderWidth: 3, borderColor: '#fff' }}
        />
      )}
    </Pressable>
  );
}
