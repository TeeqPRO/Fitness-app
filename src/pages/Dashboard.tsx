import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { bmi, bmiCategory } from '@/lib/nutrition';
import { Flame, TrendingDown, TrendingUp, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const todayISO = () => new Date().toISOString().slice(0, 10);

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąska',
};
const MEAL_ICON: Record<string, string> = {
  breakfast: '🍳', lunch: '🍽️', dinner: '🌙', snack: '🍎',
};

function Ring({ value, max, label, color = 'hsl(var(--primary))' }: { value: number; max: number; label: string; color?: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} stroke="hsl(var(--secondary))" strokeWidth="14" fill="none" />
        <circle cx="80" cy="80" r={r} stroke={color} strokeWidth="14" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </svg>
      <div className="text-center">
        <div className="font-display text-4xl font-bold">{Math.round(value)}</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">z {max}</div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{Math.round(value)}/{max}g</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ['food_logs', user?.id, todayISO()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('food_logs').select('*')
        .eq('user_id', user!.id).eq('logged_date', todayISO())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => logs.reduce(
    (a, l) => ({
      cal: a.cal + Number(l.calories),
      p: a.p + Number(l.protein_g),
      c: a.c + Number(l.carbs_g),
      f: a.f + Number(l.fat_g),
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  ), [logs]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof logs> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    logs.forEach((l) => g[l.meal_type]?.push(l));
    return g;
  }, [logs]);

  const remove = async (id: string) => {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (error) return toast.error('Nie udało się usunąć');
    qc.invalidateQueries({ queryKey: ['food_logs'] });
    toast.success('Usunięto');
  };

  if (!profile) return null;

  const goal = profile.daily_calorie_goal ?? 2000;
  const remaining = goal - totals.cal;
  const userBmi = profile.height_cm && profile.current_weight_kg
    ? bmi(Number(profile.current_weight_kg), Number(profile.height_cm)) : 0;
  const cat = bmiCategory(userBmi);
  const goalIcon = profile.goal === 'lose' ? TrendingDown : profile.goal === 'gain' ? TrendingUp : Target;
  const GoalIcon = goalIcon;

  return (
    <div className="space-y-6 px-5 py-6 animate-fade-up">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Cześć,</p>
          <h1 className="font-display text-2xl font-bold">{profile.username} 👋</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
          <GoalIcon className="h-3.5 w-3.5 text-primary" />
          {profile.goal === 'lose' ? 'Deficyt' : profile.goal === 'gain' ? 'Nadwyżka' : 'Utrzymanie'}
        </div>
      </header>

      <section className="glass rounded-3xl p-6 shadow-card">
        <div className="flex flex-col items-center">
          <Ring value={totals.cal} max={goal} label="kcal zjedzone" />
          <div className="mt-4 flex items-center gap-2 rounded-full bg-secondary px-4 py-2">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {remaining > 0 ? `Pozostało ${remaining} kcal` : `Przekroczyłeś o ${Math.abs(remaining)} kcal`}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <MacroBar label="Białko" value={totals.p} max={profile.daily_protein_g ?? 0} color="hsl(var(--primary))" />
          <MacroBar label="Węglowodany" value={totals.c} max={profile.daily_carbs_g ?? 0} color="hsl(var(--accent))" />
          <MacroBar label="Tłuszcze" value={totals.f} max={profile.daily_fat_g ?? 0} color="hsl(var(--warning))" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">BMI</div>
          <div className="mt-1 font-display text-3xl font-bold">{userBmi.toFixed(1)}</div>
          <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-${cat.tone}/20 text-${cat.tone}`}
            style={{
              background: `hsl(var(--${cat.tone}) / 0.2)`,
              color: `hsl(var(--${cat.tone}))`,
            }}>
            {cat.label}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Waga / Cel</div>
          <div className="mt-1 font-display text-3xl font-bold">{Number(profile.current_weight_kg).toFixed(1)}<span className="text-base text-muted-foreground"> kg</span></div>
          <div className="mt-1 text-xs text-muted-foreground">cel: {Number(profile.target_weight_kg).toFixed(1)} kg</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Posiłki dziś</h2>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => {
          const items = grouped[m];
          const sum = items.reduce((a, l) => a + Number(l.calories), 0);
          return (
            <div key={m} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{MEAL_ICON[m]}</span>
                  <span className="font-medium">{MEAL_LABEL[m]}</span>
                </div>
                <span className="text-sm font-semibold text-primary">{Math.round(sum)} kcal</span>
              </div>
              {items.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {items.map((l) => (
                    <li key={l.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{Math.round(Number(l.calories))} kcal · {Number(l.serving_g)}g</div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => remove(l.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
