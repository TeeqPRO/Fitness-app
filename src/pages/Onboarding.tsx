import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ACTIVITY_LABEL, GOAL_LABEL, calorieGoal, macroSplit, type Activity, type Goal, type Sex } from '@/lib/nutrition';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';

type Form = {
  sex: Sex | '';
  age: string;
  height: string;
  weight: string;
  activity: Activity | '';
  goal: Goal | '';
  target: string;
};

const STEPS = ['Płeć', 'Wiek', 'Wzrost', 'Waga', 'Aktywność', 'Cel', 'Podsumowanie'];

export default function Onboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Form>({ sex: '', age: '', height: '', weight: '', activity: '', goal: '', target: '' });

  const valid = (() => {
    switch (step) {
      case 0: return !!f.sex;
      case 1: return +f.age >= 10 && +f.age <= 120;
      case 2: return +f.height >= 100 && +f.height <= 250;
      case 3: return +f.weight >= 30 && +f.weight <= 300;
      case 4: return !!f.activity;
      case 5: return !!f.goal && (f.goal === 'maintain' || +f.target > 30);
      default: return true;
    }
  })();

  const computed = valid && step >= 5 ? (() => {
    const cals = calorieGoal({
      sex: f.sex as Sex, weightKg: +f.weight, heightCm: +f.height, age: +f.age,
      activity: f.activity as Activity, goal: f.goal as Goal,
    });
    const m = macroSplit(cals, f.goal as Goal);
    return { cals, ...m };
  })() : null;

  const finish = async () => {
    if (!user || !computed) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      sex: f.sex as Sex,
      age: +f.age,
      height_cm: +f.height,
      current_weight_kg: +f.weight,
      activity_level: f.activity as Activity,
      goal: f.goal as Goal,
      target_weight_kg: f.goal === 'maintain' ? +f.weight : +f.target,
      daily_calorie_goal: computed.cals,
      daily_protein_g: computed.protein_g,
      daily_carbs_g: computed.carbs_g,
      daily_fat_g: computed.fat_g,
      onboarded: true,
    }).eq('id', user.id);
    if (!error) {
      await supabase.from('weight_logs').insert({ user_id: user.id, weight_kg: +f.weight });
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ['profile'] });
    toast.success('Wszystko gotowe! 🎯');
    nav('/');
  };

  const next = () => step < STEPS.length - 1 ? setStep(step + 1) : finish();
  const back = () => setStep(Math.max(0, step - 1));

  return (
    <div className="min-h-screen px-6 py-8 safe-top">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <p className="mb-2 text-sm text-muted-foreground">Krok {step + 1} z {STEPS.length}</p>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
        </div>

        <div key={step} className="glass rounded-3xl p-6 shadow-card animate-fade-up">
          <h2 className="font-display text-2xl font-bold">{STEPS[step]}</h2>

          {step === 0 && (
            <RadioGroup value={f.sex} onValueChange={(v) => setF({ ...f, sex: v as Sex })} className="mt-6 grid grid-cols-2 gap-3">
              {(['male', 'female'] as Sex[]).map((s) => (
                <Label key={s} htmlFor={s}
                  className={`cursor-pointer rounded-2xl border-2 p-6 text-center transition-all ${f.sex === s ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                  <RadioGroupItem value={s} id={s} className="sr-only" />
                  <div className="text-3xl">{s === 'male' ? '👨' : '👩'}</div>
                  <div className="mt-2 font-medium">{s === 'male' ? 'Mężczyzna' : 'Kobieta'}</div>
                </Label>
              ))}
            </RadioGroup>
          )}

          {step === 1 && (
            <div className="mt-6 space-y-2">
              <Label>Wiek (lata)</Label>
              <Input type="number" inputMode="numeric" autoFocus value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} placeholder="np. 28" />
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 space-y-2">
              <Label>Wzrost (cm)</Label>
              <Input type="number" inputMode="numeric" autoFocus value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} placeholder="np. 178" />
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 space-y-2">
              <Label>Aktualna waga (kg)</Label>
              <Input type="number" step="0.1" inputMode="decimal" autoFocus value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} placeholder="np. 75.5" />
            </div>
          )}

          {step === 4 && (
            <div className="mt-6 space-y-2">
              <Label>Poziom aktywności</Label>
              <Select value={f.activity} onValueChange={(v) => setF({ ...f, activity: v as Activity })}>
                <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 5 && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Cel</Label>
                <RadioGroup value={f.goal} onValueChange={(v) => setF({ ...f, goal: v as Goal })} className="space-y-2">
                  {Object.entries(GOAL_LABEL).map(([k, v]) => (
                    <Label key={k} htmlFor={`g-${k}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all ${f.goal === k ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      <RadioGroupItem value={k} id={`g-${k}`} />
                      <span className="font-medium">{v}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              {f.goal && f.goal !== 'maintain' && (
                <div className="space-y-2">
                  <Label>Waga docelowa (kg)</Label>
                  <Input type="number" step="0.1" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="np. 70" />
                </div>
              )}
            </div>
          )}

          {step === 6 && computed && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-gradient-primary p-6 text-primary-foreground">
                <div className="flex items-center gap-2 text-sm font-medium opacity-90">
                  <Sparkles className="h-4 w-4" /> Twój dzienny cel
                </div>
                <div className="mt-2 font-display text-5xl font-bold">{computed.cals}</div>
                <div className="text-sm opacity-90">kcal / dzień</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Białko', v: computed.protein_g, u: 'g' },
                  { l: 'Węgle', v: computed.carbs_g, u: 'g' },
                  { l: 'Tłuszcze', v: computed.fat_g, u: 'g' },
                ].map((m) => (
                  <div key={m.l} className="rounded-2xl bg-secondary p-4 text-center">
                    <div className="text-xs text-muted-foreground">{m.l}</div>
                    <div className="font-display text-xl font-bold">{m.v}{m.u}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button variant="glass" size="lg" onClick={back} className="flex-1">
              <ArrowLeft className="h-4 w-4" /> Wstecz
            </Button>
          )}
          <Button variant="hero" size="lg" disabled={!valid || busy} onClick={next} className="flex-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>{step === STEPS.length - 1 ? 'Zaczynamy' : 'Dalej'} <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
