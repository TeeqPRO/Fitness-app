import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Scale } from 'lucide-react';
import { format } from 'date-fns';

export default function Weight() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [w, setW] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ['weight_logs', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('weight_logs').select('*')
        .eq('user_id', user!.id).order('logged_at', { ascending: true }).limit(60);
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = +w;
    if (val < 30 || val > 300) return toast.error('Podaj wagę 30–300 kg');
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('weight_logs').upsert(
      { user_id: user!.id, weight_kg: val, logged_at: today },
      { onConflict: 'user_id,logged_at' as any },
    );
    if (!error) {
      await supabase.from('profiles').update({ current_weight_kg: val }).eq('id', user!.id);
    }
    setBusy(false);
    if (error) {
      const { error: e2 } = await supabase.from('weight_logs').insert({ user_id: user!.id, weight_kg: val });
      if (e2) return toast.error(e2.message);
    }
    qc.invalidateQueries({ queryKey: ['weight_logs'] });
    qc.invalidateQueries({ queryKey: ['profile'] });
    setW('');
    toast.success('Zapisano wagę');
  };

  const chartData = logs.map((l) => ({
    date: format(new Date(l.logged_at), 'dd.MM'),
    weight: Number(l.weight_kg),
  }));

  const target = profile?.target_weight_kg ? Number(profile.target_weight_kg) : null;
  const current = profile?.current_weight_kg ? Number(profile.current_weight_kg) : null;
  const diff = target && current ? current - target : null;

  return (
    <div className="space-y-6 px-5 py-6 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold">Twoja waga</h1>
        <p className="text-sm text-muted-foreground">Loguj się regularnie, by widzieć postęp</p>
      </header>

      <section className="glass rounded-3xl p-6">
        <div className="flex items-end gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Aktualnie</div>
            <div className="font-display text-4xl font-bold">{current?.toFixed(1) ?? '—'}<span className="text-base text-muted-foreground"> kg</span></div>
          </div>
          {target && diff !== null && (
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">Do celu</div>
              <div className="font-display text-2xl font-bold text-primary">{Math.abs(diff).toFixed(1)} kg</div>
              <div className="text-xs text-muted-foreground">{diff > 0 ? 'do schudnięcia' : diff < 0 ? 'do przybrania' : 'osiągnięto!'}</div>
            </div>
          )}
        </div>

        {chartData.length > 1 && (
          <div className="-mx-2 mt-5 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <form onSubmit={submit} className="glass space-y-3 rounded-3xl p-5">
        <Label htmlFor="w" className="flex items-center gap-2"><Scale className="h-4 w-4" /> Zapisz dzisiejszą wagę</Label>
        <div className="flex gap-2">
          <Input id="w" type="number" step="0.1" inputMode="decimal" placeholder="np. 75.4" value={w} onChange={(e) => setW(e.target.value)} />
          <Button variant="hero" disabled={busy} type="submit">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Zapisz'}
          </Button>
        </div>
      </form>

      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">Historia</h3>
        <ul className="space-y-2">
          {[...logs].reverse().slice(0, 15).map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
              <span className="text-sm">{format(new Date(l.logged_at), 'dd.MM.yyyy')}</span>
              <span className="font-display font-bold">{Number(l.weight_kg).toFixed(1)} kg</span>
            </li>
          ))}
          {logs.length === 0 && <li className="rounded-2xl bg-secondary/40 p-4 text-center text-sm text-muted-foreground">Brak wpisów</li>}
        </ul>
      </section>
    </div>
  );
}
