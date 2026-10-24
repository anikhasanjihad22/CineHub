import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { BottomNav, Tab } from '../components/BottomNav';
import Home from './Home';
import Search from './Search';
import MyList from './MyList';
import Profile from './Profile';

// All tabs stay mounted so switching is instant and nothing reloads.
export default function Main({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('home');
  const show = (t: Tab) => ({ flex: 1, display: tab === t ? ('flex' as const) : ('none' as const) });
  return (
    <Screen edges={['top']}>
      <View style={show('home')}><Home navigation={navigation} goProfile={() => setTab('profile')} goSearch={() => setTab('search')} /></View>
      <View style={show('search')}><Search navigation={navigation} /></View>
      <View style={show('list')}><MyList navigation={navigation} active={tab === 'list'} /></View>
      <View style={show('profile')}><Profile navigation={navigation} active={tab === 'profile'} /></View>
      <BottomNav tab={tab} onChange={setTab} />
    </Screen>
  );
}
