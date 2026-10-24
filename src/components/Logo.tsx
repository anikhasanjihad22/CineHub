import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { colors } from '../theme';

// Icon only (the ring + play button, no background tile)
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="96 96 320 320">
      <Defs>
        <LinearGradient id="amber" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD84A" />
          <Stop offset="1" stopColor="#FF9A1F" />
        </LinearGradient>
      </Defs>
      <Path
        d="M358 142 A138 138 0 1 0 358 370"
        fill="none"
        stroke="url(#amber)"
        strokeWidth={34}
        strokeLinecap="round"
      />
      <Path
        d="M228 192 L228 320 Q228 336 242 328 L338 264 Q350 256 338 248 L242 184 Q228 176 228 192 Z"
        fill="url(#amber)"
      />
      <Circle cx={398} cy={256} r={17} fill="url(#amber)" />
    </Svg>
  );
}

// Icon + "CineHub" wordmark
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LogoMark size={size} />
      <Text
        style={{
          marginLeft: 8,
          fontSize: size * 0.7,
          fontWeight: '800',
          letterSpacing: -1,
          color: colors.text,
        }}
      >
        Cine<Text style={{ color: colors.amberSolid }}>Hub</Text>
      </Text>
    </View>
  );
}
