import React from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAvatar } from '../lib/avatar';

// Round profile picture. Shows the photo, or the first letter on a red gradient.
export function Avatar({ uid, name, size = 36, ring }: { uid?: string | null; name?: string; size?: number; ring?: boolean }) {
  const uri = useAvatar(uid);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        borderWidth: ring ? 2 : 0, borderColor: 'rgba(255,255,255,0.9)',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#FF4B55', '#B8070F']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: size * 0.44, fontWeight: '800' }}>{((name ?? '')[0] ?? 'C').toUpperCase()}</Text>
        </LinearGradient>
      )}
    </View>
  );
}
