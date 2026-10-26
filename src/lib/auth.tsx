import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthValue = {
  session: Session | null; isAdmin: boolean; ready: boolean;
  displayName: string; updateName: (n: string) => Promise<void>;
};
const Ctx = createContext<AuthValue>({ session: null, isAdmin: false, ready: false, displayName: '', updateName: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    if (!session) { setIsAdmin(false); setName(''); return; }
    supabase
      .from('profiles')
      .select('role,display_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setIsAdmin(data?.role === 'admin');
        setName(data?.display_name ?? '');
      });
    return () => { alive = false; };
  }, [session]);

  const updateName = useCallback(async (n: string) => {
    const v = n.trim().slice(0, 30);
    if (!session || !v) return;
    setName(v);
    await supabase.from('profiles').update({ display_name: v }).eq('id', session.user.id);
  }, [session]);

  const fallback = (session?.user.email ?? '').split('@')[0];
  return <Ctx.Provider value={{ session, isAdmin, ready, displayName: name || fallback, updateName }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
