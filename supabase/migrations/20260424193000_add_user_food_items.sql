CREATE TABLE public.user_food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  serving_g NUMERIC NOT NULL DEFAULT 100,
  calories NUMERIC NOT NULL,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_food_items_user_idx ON public.user_food_items(user_id, updated_at DESC);

ALTER TABLE public.user_food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own user_food_items all" ON public.user_food_items
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_food_items_touch BEFORE UPDATE ON public.user_food_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
