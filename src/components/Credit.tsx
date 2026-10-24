import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// Developer credit.
export function Credit() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        Developed by <Text style={styles.name}>AHR</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 26 },
  text: { color: colors.muted, fontSize: 12, letterSpacing: 0.4 },
  name: { color: colors.text, fontWeight: '800' },
});
