import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { BottomNav, SideNav, Tab } from '../components/BottomNav';
import Home from './Home';
import Search from './Search';
import MyList from './MyList';
import Downloads from './Downloads';
import Profile from './Profile';
import { isTV } from '../lib/platform';

// All tabs stay mounted so switching is instant and nothing reloads.
export default function Main({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('home');
  const show = (t: Tab) => ({ flex: 1, display: tab === t ? ('flex' as const) : ('none' as const) });
  const pages = (
    <View style={{ flex: 1 }}>
      <View style={show('home')}><Home navigation={navigation} goProfile={() => setTab('profile')} goSearch={() => setTab('search')} /></View>
      <View style={show('search')}><Search navigation={navigation} /></View>
      <View style={show('list')}><MyList navigation={navigation} active={tab === 'list'} /></View>
      <View style={show('downloads')}><Downloads navigation={navigation} /></View>
      <View style={show('profile')}><Profile navigation={navigation} active={tab === 'profile'} /></View>
    </View>
  );
  if (isTV) {
    return (
      <Screen edges={[]}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SideNav tab={tab} onChange={setTab} />
          {pages}
        </View>
      </Screen>
    );
  }
  return (
    <Screen edges={['top']}>
      {pages}
      <BottomNav tab={tab} onChange={setTab} />
    </Screen>
  );
}
