export type FoodItem = {
  barcode?: string;
  name: string;
  brand?: string;
  serving_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size';
const OFF_BASE = import.meta.env.DEV ? '/off' : 'https://world.openfoodfacts.org';

function fromOff(p: any): FoodItem | null {
  if (!p) return null;
  const n = p.nutriments || {};
  const cal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
  if (cal == null) return null;
  return {
    barcode: p.code,
    name: p.product_name || 'Bez nazwy',
    brand: p.brands,
    serving_g: 100,
    calories: Math.round(Number(cal)),
    protein_g: Math.round(Number(n.proteins_100g ?? 0) * 10) / 10,
    carbs_g: Math.round(Number(n.carbohydrates_100g ?? 0) * 10) / 10,
    fat_g: Math.round(Number(n.fat_100g ?? 0) * 10) / 10,
  };
}

export async function searchFood(query: string): Promise<FoodItem[]> {
  const v2Url = `${OFF_BASE}/api/v2/search?search_terms=${encodeURIComponent(query)}&page_size=20&fields=${OFF_FIELDS}`;
  const v2Res = await fetch(v2Url);
  if (v2Res.ok) {
    const v2Data = await v2Res.json();
    return (v2Data.products || []).map(fromOff).filter(Boolean) as FoodItem[];
  }

  // Fallback if v2 search is temporarily unavailable.
  const legacyUrl = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
  const legacyRes = await fetch(legacyUrl);
  if (!legacyRes.ok) throw new Error('Błąd wyszukiwania produktu');
  const legacyData = await legacyRes.json();
  return (legacyData.products || []).map(fromOff).filter(Boolean) as FoodItem[];
}

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  const res = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return fromOff(data.product);
}
