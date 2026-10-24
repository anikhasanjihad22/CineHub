import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'glass';
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading }: Props) {
  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? colors.onAmber : colors.text} />
  ) : (
    <Text style={[styles.label, variant === 'glass' && { color: colors.text, fontWeight: '600' }]}>
      {label}
    </Text>
  );

  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={colors.amber}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.base}
        >
          {content}
        </LinearGradient>
      ) : (
        <Pressable style={[styles.base, styles.glass]} pointerEvents="none">
          {content}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glass: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 16, fontWeight: '700', color: colors.onAmber },
});
