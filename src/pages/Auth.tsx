import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Dumbbell, Loader2 } from 'lucide-react';

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const fn = tab === 'signin' ? signIn : signUp;
    const { error } = await fn(u, p);
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(tab === 'signin' ? 'Witaj z powrotem!' : 'Konto utworzone!');
    nav('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Dumbbell className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-4xl font-bold gradient-text">FitTrack</h1>
          <p className="mt-2 text-muted-foreground">Twój dziennik kalorii i celów</p>
        </div>

        <div className="glass rounded-3xl p-6 shadow-elevated">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin">Logowanie</TabsTrigger>
              <TabsTrigger value="signup">Rejestracja</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="m-0">
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Login</Label>
                  <Input id="username" autoComplete="username" placeholder="np. jan_kowalski"
                    value={u} onChange={(e) => setU(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Hasło</Label>
                  <Input id="password" type="password" autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="min. 6 znaków" value={p} onChange={(e) => setP(e.target.value)} required />
                </div>
                <Button type="submit" disabled={busy} variant="hero" size="lg" className="w-full">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (tab === 'signin' ? 'Zaloguj się' : 'Stwórz konto')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
