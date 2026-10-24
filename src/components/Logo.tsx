import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme';

// Text wordmark: CINE (white) + HUB (red).
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: size, fontWeight: '900', letterSpacing: size * 0.04 }}>CINE</Text>
      <View style={{ backgroundColor: colors.accent, borderRadius: size * 0.16, paddingHorizontal: size * 0.2, marginLeft: size * 0.12 }}>
        <Text style={{ color: colors.onAccent, fontSize: size, fontWeight: '900', letterSpacing: size * 0.04 }}>HUB</Text>
      </View>
    </View>
  );
}

// Small square mark (for avatars / headers where the full wordmark does not fit).
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.onAccent, fontSize: size * 0.6, fontWeight: '900' }}>C</Text>
    </View>
  );
}
