-- =====================================================================
-- Floor, inventory and KOT/BOT repair.
-- Idempotent: safe to run on a fresh database or on top of an existing
-- one. It only creates what is missing and never drops business data.
-- =====================================================================

-- ---------- role helpers (SECURITY DEFINER so RLS can't recurse) -----
CREATE OR REPLACE FUNCTION public.pos_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('cashier','manager','admin'))
$$;
CREATE OR REPLACE FUNCTION public.pos_is_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
$$;
REVOKE ALL ON FUNCTION public.pos_is_staff(), public.pos_is_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_is_staff(), public.pos_is_manager() TO authenticated;

-- ---------- pos_tables -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS pos_tables_name_key ON public.pos_tables (lower(name));
EXCEPTION WHEN others THEN RAISE NOTICE 'pos_tables_name_key skipped: %', SQLERRM; END $$;

INSERT INTO public.pos_tables (name, capacity)
SELECT v.name, v.capacity
FROM (VALUES ('Table 01',2),('Table 02',4),('Table 03',4),('Table 04',6),('Table 05',4),('Table 06',2),('Table 07',4),('Table 08',6)) AS v(name, capacity)
WHERE NOT EXISTS (SELECT 1 FROM public.pos_tables);

ALTER TABLE public.pos_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_tables_staff_read ON public.pos_tables;
CREATE POLICY pos_tables_staff_read ON public.pos_tables FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS pos_tables_staff_update ON public.pos_tables;
CREATE POLICY pos_tables_staff_update ON public.pos_tables FOR UPDATE TO authenticated USING (public.pos_is_staff()) WITH CHECK (public.pos_is_staff());
DROP POLICY IF EXISTS pos_tables_manager_insert ON public.pos_tables;
CREATE POLICY pos_tables_manager_insert ON public.pos_tables FOR INSERT TO authenticated WITH CHECK (public.pos_is_manager());
DROP POLICY IF EXISTS pos_tables_manager_delete ON public.pos_tables;
CREATE POLICY pos_tables_manager_delete ON public.pos_tables FOR DELETE TO authenticated USING (public.pos_is_manager());

-- ---------- pos_categories (menu categories) --------------------------
CREATE TABLE IF NOT EXISTS public.pos_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS pos_categories_name_key ON public.pos_categories (lower(name));
EXCEPTION WHEN others THEN RAISE NOTICE 'pos_categories_name_key skipped: %', SQLERRM; END $$;

INSERT INTO public.pos_categories (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES ('Hot Coffee',10),('Cold Coffee',20),('Juices & Smoothies',30),('Mains',40),('Snacks & Bites',50),('Desserts',60),('Add-ons',70)) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.pos_categories);

ALTER TABLE public.pos_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_categories_staff_read ON public.pos_categories;
CREATE POLICY pos_categories_staff_read ON public.pos_categories FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS pos_categories_manager_write ON public.pos_categories;
CREATE POLICY pos_categories_manager_write ON public.pos_categories FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());

-- ---------- pos_products ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_products
  ADD COLUMN IF NOT EXISTS image text,
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS temperature text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dietary_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS department_override text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_products_staff_read ON public.pos_products;
CREATE POLICY pos_products_staff_read ON public.pos_products FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS pos_products_manager_write ON public.pos_products;
CREATE POLICY pos_products_manager_write ON public.pos_products FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());

-- ---------- pos_orders (tickets live here) ----------------------------
CREATE TABLE IF NOT EXISTS public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing rows get 'served' so old orders don't flood the kitchen; new rows default to 'pending'.
ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS table_name text NOT NULL DEFAULT 'Takeaway',
  ADD COLUMN IF NOT EXISTS cashier_name text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS cash_received numeric(12,2),
  ADD COLUMN IF NOT EXISTS change_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS kitchen_status text NOT NULL DEFAULT 'served',
  ADD COLUMN IF NOT EXISTS bar_status text NOT NULL DEFAULT 'served',
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.pos_orders
  ALTER COLUMN kitchen_status SET DEFAULT 'pending',
  ALTER COLUMN bar_status SET DEFAULT 'pending',
  ALTER COLUMN stock_deducted SET DEFAULT false;

-- Allow unpaid "open" tabs: replace any old status CHECK with one that includes it.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.pos_orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%kitchen_status%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%bar_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.pos_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.pos_orders ADD CONSTRAINT pos_orders_status_check
    CHECK (status IN ('open','paid','completed','refunded','cancelled')) NOT VALID;
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS pos_orders_order_number_key ON public.pos_orders (order_number);
EXCEPTION WHEN others THEN RAISE NOTICE 'pos_orders_order_number_key skipped: %', SQLERRM; END $$;
CREATE INDEX IF NOT EXISTS pos_orders_status_created_idx ON public.pos_orders (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.pos_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS pos_orders_touch ON public.pos_orders;
CREATE TRIGGER pos_orders_touch BEFORE UPDATE ON public.pos_orders FOR EACH ROW EXECUTE FUNCTION public.pos_touch_updated_at();

ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_orders_staff_read ON public.pos_orders;
CREATE POLICY pos_orders_staff_read ON public.pos_orders FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS pos_orders_staff_insert ON public.pos_orders;
CREATE POLICY pos_orders_staff_insert ON public.pos_orders FOR INSERT TO authenticated WITH CHECK (public.pos_is_staff());
DROP POLICY IF EXISTS pos_orders_staff_update ON public.pos_orders;
CREATE POLICY pos_orders_staff_update ON public.pos_orders FOR UPDATE TO authenticated USING (public.pos_is_staff()) WITH CHECK (public.pos_is_staff());

-- Server-side order numbers (the browser counter produced duplicates).
CREATE SEQUENCE IF NOT EXISTS public.pos_order_seq START 1000;
SELECT setval('public.pos_order_seq', GREATEST(
  1000,
  COALESCE((SELECT max(regexp_replace(order_number, '\D', '', 'g')::bigint)
            FROM public.pos_orders WHERE order_number ~ '^CFJ-[0-9]{1,12}$'), 0)
));
CREATE OR REPLACE FUNCTION public.next_pos_order_number() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.pos_is_staff() THEN RAISE EXCEPTION 'Staff authorization required'; END IF;
  RETURN 'CFJ-' || lpad(nextval('public.pos_order_seq')::text, 6, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_pos_order_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_pos_order_number() TO authenticated;

-- ---------- KOT / BOT status RPC now targets pos_orders ---------------
CREATE OR REPLACE FUNCTION public.update_pos_ticket_status(p_order_number text, p_station text, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer := 0; m integer := 0;
BEGIN
  IF p_station NOT IN ('kitchen','bar') THEN RAISE EXCEPTION 'Invalid ticket station'; END IF;
  IF p_status NOT IN ('pending','preparing','ready','served') THEN RAISE EXCEPTION 'Invalid ticket status'; END IF;
  IF auth.uid() IS NULL OR NOT public.pos_is_staff() THEN RAISE EXCEPTION 'Staff authorization required'; END IF;

  IF p_station = 'kitchen' THEN
    UPDATE public.pos_orders SET kitchen_status = p_status WHERE order_number = p_order_number;
  ELSE
    UPDATE public.pos_orders SET bar_status = p_status WHERE order_number = p_order_number;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- legacy "orders" table (older deployments) is kept in step when it exists
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE format('UPDATE public.orders SET %I = $1 WHERE order_number = $2', p_station || '_status')
      USING p_status, p_order_number;
    GET DIAGNOSTICS m = ROW_COUNT;
  END IF;
  RETURN (n + m) > 0;
END $$;
REVOKE ALL ON FUNCTION public.update_pos_ticket_status(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pos_ticket_status(text, text, text) TO authenticated;

-- ---------- Inventory -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredient_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredient_categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS ingredient_categories_name_key ON public.ingredient_categories (lower(name));
EXCEPTION WHEN others THEN RAISE NOTICE 'ingredient_categories_name_key skipped: %', SQLERRM; END $$;
INSERT INTO public.ingredient_categories (name, sort_order)
SELECT v.name, v.sort_order
FROM (VALUES ('Coffee & Tea',10),('Dairy',20),('Produce',30),('Dry Goods',40),('Meat & Seafood',50),('Beverages',60),('Packaging',70),('Cleaning',80)) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.ingredient_categories);

CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.ingredient_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dimension text NOT NULL DEFAULT 'weight',
  ADD COLUMN IF NOT EXISTS base_unit text NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS default_purchase_unit text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS current_stock_base numeric(16,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS par_level_base numeric(16,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level_base numeric(16,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_qty_base numeric(16,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_perishable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Older builds of the UI used different column names. Carry data over and relax them.
DO $$
DECLARE legacy text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ingredients' AND column_name='stock_base') THEN
    EXECUTE 'UPDATE public.ingredients SET current_stock_base = stock_base WHERE current_stock_base = 0 AND stock_base IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ingredients' AND column_name='active') THEN
    EXECUTE 'UPDATE public.ingredients SET is_active = active WHERE active IS NOT NULL';
  END IF;
  FOREACH legacy IN ARRAY ARRAY['stock_base','active','reorder_quantity_base'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ingredients' AND column_name=legacy AND is_nullable='NO') THEN
      EXECUTE format('ALTER TABLE public.ingredients ALTER COLUMN %I DROP NOT NULL', legacy);
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_dimension_check CHECK (dimension IN ('weight','volume','count')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingredients_staff_read ON public.ingredients;
CREATE POLICY ingredients_staff_read ON public.ingredients FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS ingredients_manager_write ON public.ingredients;
CREATE POLICY ingredients_manager_write ON public.ingredients FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());
DROP POLICY IF EXISTS ingredient_categories_staff_read ON public.ingredient_categories;
CREATE POLICY ingredient_categories_staff_read ON public.ingredient_categories FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS ingredient_categories_manager_write ON public.ingredient_categories;
CREATE POLICY ingredient_categories_manager_write ON public.ingredient_categories FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','void')),
  payment_method text NOT NULL DEFAULT 'cash',
  subtotal_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity numeric(16,3) NOT NULL,
  unit text NOT NULL,
  quantity_base numeric(16,3) NOT NULL,
  unit_price_minor bigint NOT NULL DEFAULT 0,
  total_price_minor bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ingredient_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_change_base numeric(16,3) NOT NULL,
  reason text NOT NULL,
  reference text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_base numeric(16,3) NOT NULL CHECK (quantity_base > 0),
  UNIQUE (product_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON public.purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS ingredient_stock_movements_created_idx ON public.ingredient_stock_movements (created_at DESC);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchases_manager_all ON public.purchases;
CREATE POLICY purchases_manager_all ON public.purchases FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());
DROP POLICY IF EXISTS purchase_items_manager_all ON public.purchase_items;
CREATE POLICY purchase_items_manager_all ON public.purchase_items FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());
DROP POLICY IF EXISTS ingredient_movements_staff_read ON public.ingredient_stock_movements;
CREATE POLICY ingredient_movements_staff_read ON public.ingredient_stock_movements FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS recipe_items_staff_read ON public.recipe_items;
CREATE POLICY recipe_items_staff_read ON public.recipe_items FOR SELECT TO authenticated USING (public.pos_is_staff());
DROP POLICY IF EXISTS recipe_items_manager_write ON public.recipe_items;
CREATE POLICY recipe_items_manager_write ON public.recipe_items FOR ALL TO authenticated USING (public.pos_is_manager()) WITH CHECK (public.pos_is_manager());

-- Post a grocery run: adds stock, writes movements, locks the purchase. Runs once.
CREATE OR REPLACE FUNCTION public.post_purchase_atomic(p_purchase_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.purchases%ROWTYPE; r record;
BEGIN
  IF NOT public.pos_is_manager() THEN RAISE EXCEPTION 'Only a manager or admin can post grocery purchases'; END IF;
  SELECT * INTO p FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF p.status <> 'draft' THEN RAISE EXCEPTION 'Purchase is already %', p.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_items WHERE purchase_id = p_purchase_id) THEN
    RAISE EXCEPTION 'Purchase has no items';
  END IF;

  FOR r IN SELECT ingredient_id, quantity_base FROM public.purchase_items WHERE purchase_id = p_purchase_id LOOP
    UPDATE public.ingredients
       SET current_stock_base = current_stock_base + r.quantity_base, version = version + 1, updated_at = now()
     WHERE id = r.ingredient_id;
    INSERT INTO public.ingredient_stock_movements (ingredient_id, quantity_change_base, reason, reference)
    VALUES (r.ingredient_id, r.quantity_base, 'Grocery run', p_purchase_id::text);
  END LOOP;
  UPDATE public.purchases SET status = 'posted', posted_at = now() WHERE id = p_purchase_id;
END $$;
REVOKE ALL ON FUNCTION public.post_purchase_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_purchase_atomic(uuid) TO authenticated;

-- Sale deduction: product stock + recipe ingredients, exactly once per order.
CREATE OR REPLACE FUNCTION public.deduct_order_inventory(p_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o public.pos_orders%ROWTYPE; line record; rec record;
BEGIN
  IF NOT public.pos_is_staff() THEN RAISE EXCEPTION 'Staff authorization required'; END IF;
  SELECT * INTO o FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.stock_deducted THEN RETURN; END IF;

  IF jsonb_typeof(COALESCE(o.items, '[]'::jsonb)) = 'array' THEN
    FOR line IN
      SELECT e->>'id' AS product_id, COALESCE(NULLIF(e->>'quantity','')::numeric, 0) AS qty
      FROM jsonb_array_elements(o.items) e
    LOOP
      CONTINUE WHEN line.product_id IS NULL OR line.qty <= 0;
      UPDATE public.pos_products SET stock = GREATEST(0, COALESCE(stock, 0) - line.qty)
       WHERE id::text = line.product_id;
      FOR rec IN SELECT ingredient_id, quantity_base FROM public.recipe_items WHERE product_id = line.product_id LOOP
        UPDATE public.ingredients
           SET current_stock_base = GREATEST(0, current_stock_base - rec.quantity_base * line.qty),
               version = version + 1, updated_at = now()
         WHERE id = rec.ingredient_id;
        INSERT INTO public.ingredient_stock_movements (ingredient_id, quantity_change_base, reason, reference)
        VALUES (rec.ingredient_id, -(rec.quantity_base * line.qty), 'Sale ' || o.order_number, p_order_id::text);
      END LOOP;
    END LOOP;
  END IF;
  UPDATE public.pos_orders SET stock_deducted = true WHERE id = p_order_id;
END $$;
REVOKE ALL ON FUNCTION public.deduct_order_inventory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_order_inventory(uuid) TO authenticated;

-- Manual stock correction (stock take, spillage, waste) with an audit row.
CREATE OR REPLACE FUNCTION public.adjust_ingredient_stock(p_ingredient_id uuid, p_delta_base numeric, p_reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE new_stock numeric;
BEGIN
  IF NOT public.pos_is_manager() THEN RAISE EXCEPTION 'Only a manager or admin can adjust stock'; END IF;
  IF p_delta_base IS NULL OR p_delta_base = 0 THEN RAISE EXCEPTION 'Adjustment must not be zero'; END IF;
  UPDATE public.ingredients
     SET current_stock_base = GREATEST(0, current_stock_base + p_delta_base), version = version + 1, updated_at = now()
   WHERE id = p_ingredient_id
   RETURNING current_stock_base INTO new_stock;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ingredient not found'; END IF;
  INSERT INTO public.ingredient_stock_movements (ingredient_id, quantity_change_base, reason)
  VALUES (p_ingredient_id, p_delta_base, COALESCE(NULLIF(trim(p_reason), ''), 'Manual adjustment'));
  RETURN new_stock;
END $$;
REVOKE ALL ON FUNCTION public.adjust_ingredient_stock(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_ingredient_stock(uuid, numeric, text) TO authenticated;

-- ---------- Tables <-> sessions stay in step --------------------------
DO $$
BEGIN
  IF to_regclass('public.table_sessions') IS NOT NULL THEN
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_one_open_per_table
        ON public.table_sessions (table_id) WHERE status IN ('open','bill_requested');
    EXCEPTION WHEN others THEN RAISE NOTICE 'table_sessions_one_open_per_table skipped: %', SQLERRM; END;

    CREATE OR REPLACE FUNCTION public.sync_pos_table_from_session() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    DECLARE tid uuid := COALESCE(NEW.table_id, OLD.table_id);
    BEGIN
      IF EXISTS (SELECT 1 FROM public.table_sessions WHERE table_id = tid AND status IN ('open','bill_requested')) THEN
        UPDATE public.pos_tables SET status = 'occupied' WHERE id = tid AND status <> 'occupied';
      ELSE
        UPDATE public.pos_tables SET status = 'available' WHERE id = tid AND status = 'occupied';
      END IF;
      RETURN NULL;
    END $fn$;

    DROP TRIGGER IF EXISTS table_sessions_sync_table ON public.table_sessions;
    CREATE TRIGGER table_sessions_sync_table
      AFTER INSERT OR UPDATE OF status OR DELETE ON public.table_sessions
      FOR EACH ROW EXECUTE FUNCTION public.sync_pos_table_from_session();
  END IF;
END $$;

-- ---------- Realtime publication (idempotent) -------------------------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'pos_orders','pos_tables','pos_categories','pos_products',
      'ingredients','ingredient_categories','purchases','ingredient_stock_movements','recipe_items',
      'reservations','table_sessions','coffee_bills','coffee_bill_items','coffee_products'
    ] LOOP
      IF to_regclass('public.' || t) IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
