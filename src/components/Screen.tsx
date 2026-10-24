import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
