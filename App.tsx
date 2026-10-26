import React, { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/lib/auth';
import { colors } from './src/theme';
import { isTV } from './src/lib/platform';
import { useUpdateCheck } from './src/lib/update';
import { LogoMark } from './src/components/Logo';
import Welcome from './src/screens/Welcome';
import Login from './src/screens/Login';
import Main from './src/screens/Main';
import Details from './src/screens/Details';
import Player from './src/screens/Player';
import ListScreen from './src/screens/ListScreen';
import AdminPlugins from './src/screens/admin/Plugins';
import AppUpdate from './src/screens/admin/AppUpdate';
import { UpdateGate } from './src/screens/UpdateGate';
import { startPluginSync } from './src/plugins/loader';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
};

// Logo that gently fades in while the app starts.
function Splash() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, [v]);
  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }}>
        <LogoMark size={110} />
      </Animated.View>
    </View>
  );
}

function Root() {
  const { session, ready } = useAuth();
  const { cfg, state } = useUpdateCheck();
  const [skipped, setSkipped] = useState(false);

  // While someone is logged in, plugins are re-checked when the app opens and every 45 seconds,
  // so a plugin the admin installs goes live on every phone without reinstalling the app.
  const loggedIn = !!session;
  useEffect(() => {
    if (!loggedIn) return;
    return startPluginSync();
  }, [loggedIn]);

  // Phones stay upright (the player turns to landscape by itself). A TV is always landscape.
  useEffect(() => {
    if (!isTV) ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  if (!ready) return <Splash />;

  // Forced update: nothing else can be used until the new version is installed.
  if (cfg && state === 'required') return <UpdateGate cfg={cfg} required onLater={() => {}} />;

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        {session ? (
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="Main" component={Main} />
            <Stack.Screen name="Details" component={Details} />
            <Stack.Screen name="Player" component={Player} options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="List" component={ListScreen} />
            <Stack.Screen name="AdminPlugins" component={AdminPlugins} />
            <Stack.Screen name="AppUpdate" component={AppUpdate} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="Welcome" component={Welcome} />
            <Stack.Screen name="Login" component={Login} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
      {cfg && state === 'optional' && !skipped && <UpdateGate cfg={cfg} required={false} onLater={() => setSkipped(true)} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
