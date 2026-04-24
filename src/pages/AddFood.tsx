import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { searchFood, lookupBarcode, type FoodItem } from '@/lib/foodApi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ScanLine, Loader2, Plus, ArrowLeft, Save, PencilLine } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';

type FoodSource = 'search' | 'barcode' | 'manual' | 'saved';

type ManualForm = {
  name: string;
  brand: string;
  barcode: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};

const emptyManualForm: ManualForm = {
  name: '',
  brand: '',
  barcode: '',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
};

const localSavedProductsKey = (userId: string) => `fitapp_saved_products_${userId}`;
const localSavedProductsModeKey = (userId: string) => `fitapp_saved_products_mode_${userId}`;

const isMissingUserFoodItemsTable = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST205' || (error?.status === 404 && message.includes('user_food_items'));
};

const readLocalProducts = (userId: string) => {
  try {
    const raw = localStorage.getItem(localSavedProductsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const isLocalProductsMode = (userId: string) => localStorage.getItem(localSavedProductsModeKey(userId)) === 'local';

const enableLocalProductsMode = (userId: string) => {
  localStorage.setItem(localSavedProductsModeKey(userId), 'local');
};

const upsertLocalProduct = (userId: string, item: FoodItem) => {
  const list = readLocalProducts(userId) as Array<FoodItem & { id: string; updated_at: string }>;
  const name = item.name.trim();
  const brand = item.brand?.trim() || '';
  const idx = list.findIndex((p) => p.name.trim() === name && (p.brand?.trim() || '') === brand);
  const updated = {
    id: idx >= 0 ? list[idx].id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    brand: brand || undefined,
    barcode: item.barcode,
    serving_g: item.serving_g,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = updated;
  else list.unshift(updated);
  localStorage.setItem(localSavedProductsKey(userId), JSON.stringify(list));
};

export default function AddFood() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<ManualForm>(emptyManualForm);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualBarcodeLoading, setManualBarcodeLoading] = useState(false);
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [pickedSource, setPickedSource] = useState<FoodSource>('search');
  const [saveProduct, setSaveProduct] = useState(false);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('snack');
  const [saving, setSaving] = useState(false);

  const { data: savedProducts = [] } = useQuery({
    queryKey: ['user_food_items', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      if (!user) return [];
      if (isLocalProductsMode(user.id)) {
        return readLocalProducts(user.id);
      }
      const { data, error } = await supabase
        .from('user_food_items')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) {
        if (isMissingUserFoodItemsTable(error)) {
          enableLocalProductsMode(user.id);
          return readLocalProducts(user.id);
        }
        throw error;
      }
      return data;
    },
  });

  const search = async () => {
    if (!q.trim()) return;
    setManualMode(false);
    setLoading(true);
    try { setResults(await searchFood(q)); }
    catch { toast.error('Błąd wyszukiwania'); }
    finally { setLoading(false); }
  };

  const pickProduct = (item: FoodItem, source: FoodSource) => {
    setPicked(item);
    setPickedSource(source);
    setSaveProduct(source === 'manual');
    setGrams(String(item.serving_g || 100));
  };

  const createManualProduct = () => {
    if (!manual.name.trim()) return toast.error('Podaj nazwę produktu');

    const calories = Number(manual.calories);
    const protein = Number(manual.protein_g || 0);
    const carbs = Number(manual.carbs_g || 0);
    const fat = Number(manual.fat_g || 0);
    if (!Number.isFinite(calories) || calories <= 0) {
      return toast.error('Podaj poprawne kcal/100g');
    }
    if ([protein, carbs, fat].some((v) => !Number.isFinite(v) || v < 0)) {
      return toast.error('Makro nie może być ujemne');
    }

    pickProduct({
      name: manual.name.trim(),
      brand: manual.brand.trim() || undefined,
      barcode: manual.barcode.trim() || undefined,
      serving_g: 100,
      calories: Math.round(calories),
      protein_g: Math.round(protein * 10) / 10,
      carbs_g: Math.round(carbs * 10) / 10,
      fat_g: Math.round(fat * 10) / 10,
    }, 'manual');
  };

  const onScan = async (code: string) => {
    setScanning(false);
    setLoading(true);
    try {
      const item = await lookupBarcode(code);
      if (!item) { toast.error('Nie znaleziono produktu o kodzie ' + code); return; }
      pickProduct(item, 'barcode');
      toast.success('Znaleziono: ' + item.name);
    } catch { toast.error('Błąd skanowania'); }
    finally { setLoading(false); }
  };

  const lookupManualBarcode = async () => {
    const code = manualBarcode.trim();
    if (!code) return toast.error('Wpisz kod kreskowy');

    setManualBarcodeLoading(true);
    try {
      const item = await lookupBarcode(code);
      if (!item) {
        toast.error('Nie znaleziono produktu o kodzie ' + code);
        return;
      }
      pickProduct(item, 'barcode');
      toast.success('Znaleziono: ' + item.name);
    } catch {
      toast.error('Błąd pobierania kodu kreskowego');
    } finally {
      setManualBarcodeLoading(false);
    }
  };

  const persistProduct = async (item: FoodItem) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: item.name,
      brand: item.brand ?? null,
      barcode: item.barcode ?? null,
      serving_g: item.serving_g,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    };

    const { data: existingRows, error: findErr } = await supabase
      .from('user_food_items')
      .select('id, brand')
      .eq('user_id', user.id)
      .eq('name', payload.name);

    if (findErr) throw findErr;

    const existing = existingRows?.find((row) => (row.brand ?? null) === payload.brand);

    if (existing) {
      const { error } = await supabase
        .from('user_food_items')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('user_food_items').insert(payload);
    if (error) throw error;
  };

  const save = async () => {
    if (!picked || !user) return;
    const g = +grams;
    if (g <= 0) return toast.error('Podaj gramaturę');
    const ratio = g / picked.serving_g;
    setSaving(true);
    try {
      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        name: picked.name,
        brand: picked.brand,
        barcode: picked.barcode,
        serving_g: g,
        calories: Math.round(picked.calories * ratio),
        protein_g: Math.round(picked.protein_g * ratio * 10) / 10,
        carbs_g: Math.round(picked.carbs_g * ratio * 10) / 10,
        fat_g: Math.round(picked.fat_g * ratio * 10) / 10,
        meal_type: meal,
      });
      if (error) throw error;

      if (saveProduct) {
        try {
          await persistProduct(picked);
        } catch (e: any) {
          if (isMissingUserFoodItemsTable(e)) {
            enableLocalProductsMode(user.id);
            upsertLocalProduct(user.id, picked);
            toast.success('Produkt zapisany lokalnie na tym urządzeniu');
          } else {
            throw e;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['food_logs'] });
      qc.invalidateQueries({ queryKey: ['user_food_items'] });
      toast.success('Dodano do dziennika');
      nav('/');
    } catch (e: any) {
      toast.error(e?.message || 'Nie udało się zapisać produktu');
    } finally {
      setSaving(false);
    }
  };

  if (scanning) return <BarcodeScanner onDetected={onScan} onClose={() => setScanning(false)} />;

  if (picked) {
    const g = +grams || 0;
    const ratio = g / picked.serving_g;
    return (
      <div className="space-y-5 px-5 py-6 animate-fade-up">
        <Button variant="ghost" onClick={() => setPicked(null)} className="-ml-2"><ArrowLeft className="h-4 w-4" /> Wróć</Button>
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display text-xl font-bold">{picked.name}</h2>
          {picked.brand && <p className="text-sm text-muted-foreground">{picked.brand}</p>}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { l: 'kcal', v: Math.round(picked.calories * ratio) },
              { l: 'B', v: (picked.protein_g * ratio).toFixed(1) },
              { l: 'W', v: (picked.carbs_g * ratio).toFixed(1) },
              { l: 'T', v: (picked.fat_g * ratio).toFixed(1) },
            ].map((m) => (
              <div key={m.l} className="rounded-2xl bg-secondary p-3">
                <div className="font-display text-lg font-bold">{m.v}</div>
                <div className="text-xs text-muted-foreground">{m.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gramatura (g)</Label>
          <Input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Posiłek</Label>
          <Select value={meal} onValueChange={(v) => setMeal(v as typeof meal)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="breakfast">🍳 Śniadanie</SelectItem>
              <SelectItem value="lunch">🍽️ Obiad</SelectItem>
              <SelectItem value="dinner">🌙 Kolacja</SelectItem>
              <SelectItem value="snack">🍎 Przekąska</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
          <span className="font-medium">Zapisz w moich produktach</span>
          <input
            type="checkbox"
            checked={saveProduct}
            onChange={(e) => setSaveProduct(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
        </label>
        {pickedSource === 'saved' && (
          <p className="text-xs text-muted-foreground">To jest produkt z Twojej zapisanej listy.</p>
        )}
        <Button variant="hero" size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" /> Dodaj do dziennika</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-6 animate-fade-up">
      <h1 className="font-display text-2xl font-bold">Dodaj produkt</h1>

      <Button variant="hero" size="xl" className="w-full" onClick={() => setScanning(true)}>
        <ScanLine className="h-5 w-5" /> Skanuj kod kreskowy
      </Button>

      <div className="glass rounded-3xl p-4 space-y-2">
        <Label>Wpisz kod kreskowy</Label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookupManualBarcode();
          }}
          className="flex gap-2"
        >
          <Input
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            inputMode="numeric"
            placeholder="np. 5900012008409"
          />
          <Button type="submit" variant="hero" className="shrink-0" disabled={manualBarcodeLoading}>
            {manualBarcodeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Szukaj'}
          </Button>
        </form>
      </div>

      <Button variant="outline" size="xl" className="w-full" onClick={() => setManualMode((s) => !s)}>
        <PencilLine className="h-5 w-5" /> {manualMode ? 'Zamknij ręczne dodawanie' : 'Dodaj ręcznie'}
      </Button>

      {manualMode && (
        <div className="glass rounded-3xl p-4 space-y-3">
          <h2 className="font-display text-lg font-semibold">Ręczne dodawanie</h2>
          <div className="space-y-2">
            <Label>Nazwa</Label>
            <Input value={manual.name} onChange={(e) => setManual((s) => ({ ...s, name: e.target.value }))} placeholder="np. Twaróg półtłusty" />
          </div>
          <div className="space-y-2">
            <Label>Marka (opcjonalnie)</Label>
            <Input value={manual.brand} onChange={(e) => setManual((s) => ({ ...s, brand: e.target.value }))} placeholder="np. Mlekovita" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>kcal / 100g</Label>
              <Input type="number" inputMode="decimal" value={manual.calories} onChange={(e) => setManual((s) => ({ ...s, calories: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kod kreskowy</Label>
              <Input value={manual.barcode} onChange={(e) => setManual((s) => ({ ...s, barcode: e.target.value }))} placeholder="opcjonalnie" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>B</Label>
              <Input type="number" inputMode="decimal" value={manual.protein_g} onChange={(e) => setManual((s) => ({ ...s, protein_g: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>W</Label>
              <Input type="number" inputMode="decimal" value={manual.carbs_g} onChange={(e) => setManual((s) => ({ ...s, carbs_g: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>T</Label>
              <Input type="number" inputMode="decimal" value={manual.fat_g} onChange={(e) => setManual((s) => ({ ...s, fat_g: e.target.value }))} />
            </div>
          </div>
          <Button variant="hero" className="w-full" onClick={createManualProduct}>
            <Plus className="h-4 w-4" /> Dalej
          </Button>
        </div>
      )}

      {savedProducts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium"><Save className="h-4 w-4" /> Moje produkty</div>
          <ul className="space-y-2">
            {savedProducts.slice(0, 6).map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => pickProduct({
                    name: r.name,
                    brand: r.brand ?? undefined,
                    barcode: r.barcode ?? undefined,
                    serving_g: Number(r.serving_g),
                    calories: Number(r.calories),
                    protein_g: Number(r.protein_g),
                    carbs_g: Number(r.carbs_g),
                    fat_g: Number(r.fat_g),
                  }, 'saved')}
                  className="w-full rounded-2xl glass p-4 text-left transition hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      {r.brand && <div className="truncate text-xs text-muted-foreground">{r.brand}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">B {Number(r.protein_g)}g · W {Number(r.carbs_g)}g · T {Number(r.fat_g)}g / 100g</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-bold text-primary">{Number(r.calories)}</div>
                      <div className="text-[10px] text-muted-foreground">kcal/100g</div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">lub wyszukaj</span></div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
        <Input placeholder="np. jogurt naturalny" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" size="icon" variant="hero" className="h-10 w-10 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      <ul className="space-y-2">
        {results.map((r, i) => (
          <li key={i}>
            <button onClick={() => pickProduct(r, 'search')}
              className="w-full rounded-2xl glass p-4 text-left transition hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  {r.brand && <div className="truncate text-xs text-muted-foreground">{r.brand}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">B {r.protein_g}g · W {r.carbs_g}g · T {r.fat_g}g / 100g</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-lg font-bold text-primary">{r.calories}</div>
                  <div className="text-[10px] text-muted-foreground">kcal/100g</div>
                </div>
              </div>
            </button>
          </li>
        ))}
        {!loading && q && results.length === 0 && (
          <li className="rounded-2xl bg-secondary/50 p-4 text-center text-sm text-muted-foreground">Brak wyników</li>
        )}
      </ul>
    </div>
  );
}
