export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: 'Siedzący tryb (brak aktywności)',
  light: 'Lekka aktywność (1–3 dni/tyg.)',
  moderate: 'Umiarkowana (3–5 dni/tyg.)',
  active: 'Aktywny (6–7 dni/tyg.)',
  very_active: 'Bardzo aktywny (sport zawodowy)',
};

export const GOAL_LABEL: Record<Goal, string> = {
  lose: 'Schudnąć (deficyt 500 kcal)',
  maintain: 'Utrzymać wagę',
  gain: 'Przytyć (nadwyżka 350 kcal)',
};

export function bmr({ sex, weightKg, heightCm, age }: { sex: Sex; weightKg: number; heightCm: number; age: number }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(args: { sex: Sex; weightKg: number; heightCm: number; age: number; activity: Activity }) {
  return bmr(args) * ACTIVITY_FACTOR[args.activity];
}

export function calorieGoal(args: { sex: Sex; weightKg: number; heightCm: number; age: number; activity: Activity; goal: Goal }) {
  const t = tdee(args);
  if (args.goal === 'lose') return Math.round(t - 500);
  if (args.goal === 'gain') return Math.round(t + 350);
  return Math.round(t);
}

export function macroSplit(calories: number, goal: Goal) {
  const splits = {
    lose: { p: 0.35, c: 0.4, f: 0.25 },
    maintain: { p: 0.3, c: 0.45, f: 0.25 },
    gain: { p: 0.3, c: 0.5, f: 0.2 },
  } as const;
  const s = splits[goal];
  return {
    protein_g: Math.round((calories * s.p) / 4),
    carbs_g: Math.round((calories * s.c) / 4),
    fat_g: Math.round((calories * s.f) / 9),
  };
}

export function bmi(weightKg: number, heightCm: number) {
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function bmiCategory(value: number): { label: string; tone: 'success' | 'warning' | 'destructive' | 'accent' } {
  if (value < 18.5) return { label: 'Niedowaga', tone: 'accent' };
  if (value < 25) return { label: 'Norma', tone: 'success' };
  if (value < 30) return { label: 'Nadwaga', tone: 'warning' };
  return { label: 'Otyłość', tone: 'destructive' };
}
