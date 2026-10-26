import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Focusable } from './Focusable';
import { Icon, IconName } from './Icon';
import { colors, radius } from '../theme';

type Variant = 'primary' | 'light' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: ViewStyle;
};

const BG: Record<Variant, string> = {
  primary: colors.accent,
  light: '#FFFFFF',
  secondary: colors.surface3,
  ghost: 'transparent',
  danger: 'rgba(255,90,95,0.14)',
};
const FG: Record<Variant, string> = {
  primary: colors.onAccent,
  light: '#000000',
  secondary: colors.text,
  ghost: colors.text,
  danger: colors.danger,
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, small, style }: Props) {
  const fg = FG[variant];
  return (
    <Focusable
      onPress={onPress}
      ring={radius.md + 3}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: BG[variant], opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.borderStrong },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {!!icon && <Icon name={icon} size={small ? 16 : 20} color={fg} />}
          <Text style={[styles.label, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  base: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  small: { height: 40, paddingHorizontal: 16, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '700' },
});
