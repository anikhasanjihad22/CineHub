import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/lib/auth';
import { colors } from './src/theme';
import Welcome from './src/screens/Welcome';
import Login from './src/screens/Login';
import Main from './src/screens/Main';
import Details from './src/screens/Details';
import Player from './src/screens/Player';
import ListScreen from './src/screens/ListScreen';
import AdminPlugins from './src/screens/admin/Plugins';
import { startPluginSync } from './src/plugins/loader';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
};

function Root() {
  const { session, ready } = useAuth();

  // While someone is logged in, plugins are re-checked when the app opens and every 45 seconds,
  // so a plugin the admin installs goes live on every phone without reinstalling the app.
  const loggedIn = !!session;
  useEffect(() => {
    if (!loggedIn) return;
    return startPluginSync();
  }, [loggedIn]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {session ? (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="Main" component={Main} />
          <Stack.Screen name="Details" component={Details} />
          <Stack.Screen name="Player" component={Player} options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="List" component={ListScreen} />
          <Stack.Screen name="AdminPlugins" component={AdminPlugins} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen name="Login" component={Login} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
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
