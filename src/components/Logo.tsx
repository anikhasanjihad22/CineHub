import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../theme';

// CineHub mark: a "C" and an "H" that holds a play button. Drawn as vector paths (no image), so it is sharp at any size.
const C_PATH =
  'M257 4C307 4 335 14 350 26Q357 33 347 43L182 138C132 168 100 213 100 273C100 348 157 413 227 423L247 423L345 423Q355 424 355 434L355 468Q355 483 332 498C307 516 277 526 252 526C117 526 0 408 0 275C0 123 117 4 257 4Z';
const H_PATH =
  'M244 156Q244 131 270 135L444 231L444 158Q444 141 462 131L535 91Q555 81 555 108L555 440Q555 454 542 461L459 506Q445 514 445 498L445 303L412 284L297 390Q277 403 257 398Q244 393 244 373Z';
const PLAY_PATH = 'M297 238Q297 228 307 230Q313 231 320 235L407 283Q427 303 407 326L302 388Q297 390 297 383Z';

export function LogoMark({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <Svg width={size} height={size * (530 / 560)} viewBox="0 0 560 530">
      <Defs>
        <LinearGradient id="ch-w" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#CFCFD6" />
        </LinearGradient>
        <LinearGradient id="ch-r" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF4B55" />
          <Stop offset="1" stopColor="#E50914" />
        </LinearGradient>
      </Defs>
      <Path d={C_PATH} fill={mono ? '#fff' : 'url(#ch-w)'} />
      <Path d={H_PATH} fill={mono ? '#fff' : 'url(#ch-w)'} />
      <Path d={PLAY_PATH} fill={mono ? '#000' : 'url(#ch-r)'} />
    </Svg>
  );
}

// Mark + wordmark, used in headers.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size * 1.15} />
      <Text style={{ color: colors.text, fontSize: size * 0.82, fontWeight: '800', letterSpacing: size * 0.12 }}>
        CINE<Text style={{ color: colors.accent }}>HUB</Text>
      </Text>
    </View>
  );
}
