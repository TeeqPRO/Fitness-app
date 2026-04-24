import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ACTIVITY_LABEL, GOAL_LABEL, calorieGoal, macroSplit, type Activity, type Goal } from '@/lib/nutrition';
import { LogOut, Loader2, Save } from 'lucide-react';

export default function Settings() {
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const [age, setAge] = useState(String(profile.age ?? ''));
  const [height, setHeight] = useState(String(profile.height_cm ?? ''));
  const [activity, setActivity] = useState<Activity>(profile.activity_level as Activity);
  const [goal, setGoal] = useState<Goal>(profile.goal as Goal);
  const [target, setTarget] = useState(String(profile.target_weight_kg ?? ''));

  const save = async () => {
    setBusy(true);
    const cals = calorieGoal({
      sex: profile.sex as any,
      weightKg: Number(profile.current_weight_kg),
      heightCm: +height,
      age: +age,
      activity,
      goal,
    });
    const m = macroSplit(cals, goal);
    const { error } = await supabase.from('profiles').update({
      age: +age,
      height_cm: +height,
      activity_level: activity,
      goal,
      target_weight_kg: goal === 'maintain' ? Number(profile.current_weight_kg) : +target,
      daily_calorie_goal: cals,
      daily_protein_g: m.protein_g,
      daily_carbs_g: m.carbs_g,
      daily_fat_g: m.fat_g,
    }).eq('id', user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['profile'] });
    toast.success('Zaktualizowano cel: ' + cals + ' kcal/dzień');
  };

  return (
    <div className="space-y-6 px-5 py-6 animate-fade-up">
      <header className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-3xl font-bold text-primary-foreground shadow-glow">
          {profile.username[0].toUpperCase()}
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold">@{profile.username}</h1>
        <p className="text-sm text-muted-foreground">{profile.daily_calorie_goal} kcal · cel dzienny</p>
      </header>

      <section className="glass space-y-4 rounded-3xl p-5">
        <h2 className="font-display text-lg font-semibold">Twoje dane</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Wiek</Label>
            <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Wzrost (cm)</Label>
            <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Aktywność</Label>
          <Select value={activity} onValueChange={(v) => setActivity(v as Activity)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Cel</Label>
          <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(GOAL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {goal !== 'maintain' && (
          <div className="space-y-1.5">
            <Label>Waga docelowa (kg)</Label>
            <Input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        )}
        <Button variant="hero" className="w-full" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Zapisz zmiany</>}
        </Button>
      </section>

      <Button variant="glass" size="lg" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Wyloguj się
      </Button>
    </div>
  );
}
