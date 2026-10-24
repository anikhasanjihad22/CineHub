import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { colors, radius } from '../theme';

type Props = TextInputProps & { label?: string; icon?: IconName; secure?: boolean };

// Text field with a label, optional icon and a show / hide button for passwords.
export function Field({ label, icon, secure, style, ...rest }: Props) {
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.box, focus && styles.focus]}>
        {!!icon && <Icon name={icon} size={19} color={focus ? colors.text : colors.muted} />}
        <TextInput
          {...rest}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Icon name={hidden ? 'eye' : 'eye-off'} size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: radius.sm,
    paddingHorizontal: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  focus: { borderColor: colors.borderStrong, backgroundColor: colors.surface3 },
  input: { flex: 1, color: colors.text, fontSize: 16, height: '100%', padding: 0 },
});
