import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthValue = { session: Session | null; isAdmin: boolean; ready: boolean };
const Ctx = createContext<AuthValue>({ session: null, isAdmin: false, ready: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
    if (!session) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsAdmin(data?.role === 'admin');
      });
    return () => { alive = false; };
  }, [session]);

  return <Ctx.Provider value={{ session, isAdmin, ready }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
