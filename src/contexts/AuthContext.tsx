import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const FAKE_DOMAIN = 'fitapp.local';

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signUp: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${FAKE_DOMAIN}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) return { error: 'Nieprawidłowy login lub hasło' };
    return {};
  };

  const signUp = async (username: string, password: string) => {
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) return { error: 'Login: 3–20 znaków, litery/cyfry/_' };
    if (password.length < 6) return { error: 'Hasło min. 6 znaków' };
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(clean),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: clean },
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes('registered')) return { error: 'Login zajęty' };
      return { error: error.message };
    }
    return {};
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
