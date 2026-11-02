-- =====================================================================
-- Migration: 20261017000000_unified_pos_orders_and_products.sql
-- Description: Unify POS orders, coffee bills, products, and order items.
-- Eliminates limits, unifies kitchen/bar tickets, provides atomic
-- order placement with stock deduction, and fixes product updates.
-- =====================================================================

-- 1. Ensure columns on pos_orders
ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.pos_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT 'Walk-in',
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS tax numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS is_void boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos';

DO $$ BEGIN
  ALTER TABLE public.pos_orders DROP CONSTRAINT IF EXISTS pos_orders_payment_status_check;
  ALTER TABLE public.pos_orders ADD CONSTRAINT pos_orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'paid', 'partially_paid', 'refunded', 'void'));
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. Update pos_products table with required columns
ALTER TABLE public.pos_products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS station text NOT NULL DEFAULT 'kitchen',
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.pos_products DROP CONSTRAINT IF EXISTS pos_products_station_check;
  ALTER TABLE public.pos_products ADD CONSTRAINT pos_products_station_check
    CHECK (station IN ('kitchen', 'bar', 'none'));
EXCEPTION WHEN others THEN NULL; END $$;

-- Trigger to auto-update updated_at on pos_products
CREATE OR REPLACE FUNCTION public.pos_touch_product_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  -- Keep is_active in sync with active
  IF NEW.active IS NOT NULL AND NEW.is_active IS DISTINCT FROM NEW.active THEN
    NEW.is_active = NEW.active;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pos_products_touch ON public.pos_products;
CREATE TRIGGER trg_pos_products_touch BEFORE UPDATE ON public.pos_products
  FOR EACH ROW EXECUTE FUNCTION public.pos_touch_product_updated_at();

-- Auto-assign station on pos_products based on department/category
UPDATE public.pos_products
SET station = 'bar'
WHERE department_override ILIKE '%bar%'
   OR department_override ILIKE '%coffee%'
   OR name ILIKE '%coffee%'
   OR name ILIKE '%latte%'
   OR name ILIKE '%cappuccino%'
   OR name ILIKE '%espresso%'
   OR name ILIKE '%tea%'
   OR name ILIKE '%juice%'
   OR name ILIKE '%smoothie%'
   OR name ILIKE '%shake%'
   OR name ILIKE '%cooler%';

-- 3. Normalized order_items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.pos_products(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  unit_price_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(12,2) GENERATED ALWAYS AS (unit_price_snapshot * quantity) STORED,
  notes text DEFAULT '',
  modifiers jsonb DEFAULT '[]'::jsonb,
  station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'none')),
  item_status text NOT NULL DEFAULT 'pending' CHECK (item_status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Station Tickets Table (links to orders, never replaces them)
CREATE TABLE IF NOT EXISTS public.station_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  ticket_number text NOT NULL,
  station text NOT NULL CHECK (station IN ('kitchen', 'bar')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  notes text DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, station)
);

-- 5. Stock Movements Table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.pos_orders(id) ON DELETE SET NULL,
  change_qty integer NOT NULL,
  previous_stock integer,
  new_stock integer,
  reason text NOT NULL CHECK (reason IN ('sale', 'refund', 'adjustment', 'restock', 'waste', 'void')),
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Indexes for High-Performance Queries & Reports
CREATE INDEX IF NOT EXISTS idx_pos_orders_created_at ON public.pos_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON public.pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_payment_status ON public.pos_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_payment_method ON public.pos_orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_pos_orders_department ON public.pos_orders(department);
CREATE INDEX IF NOT EXISTS idx_pos_orders_table_name ON public.pos_orders(table_name);
CREATE INDEX IF NOT EXISTS idx_pos_orders_order_number ON public.pos_orders(order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_station ON public.order_items(station);
CREATE INDEX IF NOT EXISTS idx_order_items_item_status ON public.order_items(item_status);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON public.order_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_station_tickets_order_id ON public.station_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_station_tickets_station_status ON public.station_tickets(station, status);

CREATE INDEX IF NOT EXISTS idx_pos_products_category_id ON public.pos_products(category_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_station ON public.pos_products(station);
CREATE INDEX IF NOT EXISTS idx_pos_products_active ON public.pos_products(active) WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements(order_id);

-- 7. Migrate Coffee Products into pos_products if missing
INSERT INTO public.pos_products (id, name, price, image, category_id, stock, active, is_archived, department_override, station, created_at, updated_at)
SELECT
    cp.id,
    cp.name,
    cp.price,
    COALESCE(cp.image_url, '/latte-coffee.png'),
    (SELECT id FROM public.pos_categories WHERE name ILIKE '%coffee%' LIMIT 1),
    100,
    cp.status = 'active',
    false,
    'Coffee Bar',
    'bar',
    cp.created_at,
    cp.updated_at
FROM public.coffee_products cp
WHERE NOT EXISTS (SELECT 1 FROM public.pos_products p WHERE p.id = cp.id OR lower(p.name) = lower(cp.name))
ON CONFLICT DO NOTHING;

-- 8. Migrate Coffee Bills into pos_orders without data loss
INSERT INTO public.pos_orders (
    id,
    order_number,
    receipt_number,
    table_name,
    cashier_name,
    department,
    subtotal,
    discount,
    tax,
    total,
    payment_method,
    status,
    payment_status,
    kitchen_status,
    bar_status,
    stock_deducted,
    order_type,
    created_at,
    updated_at,
    paid_at,
    notes,
    source
)
SELECT
    cb.id,
    cb.bill_number,
    'CFE-' || cb.bill_number,
    COALESCE(cb.table_name, 'Takeaway'),
    'Coffee Barista',
    'Coffee Bar',
    cb.subtotal,
    cb.discount,
    cb.tax,
    cb.grand_total,
    cb.payment_method,
    CASE WHEN cb.bar_status = 'served' THEN 'completed' ELSE 'paid' END,
    'paid',
    'served',
    COALESCE(cb.bar_status, 'pending'),
    true,
    'coffee_bar',
    cb.created_at,
    cb.updated_at,
    cb.created_at,
    COALESCE(cb.notes, ''),
    'coffee_bill'
FROM public.coffee_bills cb
WHERE NOT EXISTS (
    SELECT 1 FROM public.pos_orders po
    WHERE po.id = cb.id OR po.order_number = cb.bill_number
)
ON CONFLICT (order_number) DO NOTHING;

-- 9. Backfill order_items from coffee_bill_items
INSERT INTO public.order_items (
    id,
    order_id,
    product_id,
    product_name_snapshot,
    unit_price_snapshot,
    quantity,
    station,
    item_status,
    created_at
)
SELECT
    cbi.id,
    cbi.bill_id,
    cbi.coffee_product_id,
    cbi.item_name,
    cbi.unit_price,
    cbi.quantity,
    'bar',
    COALESCE(cb.bar_status, 'served'),
    cbi.created_at
FROM public.coffee_bill_items cbi
JOIN public.coffee_bills cb ON cb.id = cbi.bill_id
WHERE EXISTS (SELECT 1 FROM public.pos_orders po WHERE po.id = cbi.bill_id)
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.id = cbi.id)
ON CONFLICT (id) DO NOTHING;

-- 10. Backfill order_items from pos_orders.items JSONB column
DO $$
DECLARE
    rec RECORD;
    item_elem JSONB;
    v_prod_id UUID;
    v_prod_name TEXT;
    v_price NUMERIC(12,2);
    v_qty INTEGER;
    v_station TEXT;
    v_status TEXT;
BEGIN
    FOR rec IN SELECT id, items, kitchen_status, bar_status, created_at FROM public.pos_orders WHERE items IS NOT NULL AND jsonb_array_length(items) > 0 LOOP
        FOR item_elem IN SELECT * FROM jsonb_array_elements(rec.items) LOOP
            v_prod_name := COALESCE(item_elem->>'name', 'Unknown Item');
            v_price := COALESCE((item_elem->>'price')::numeric, 0);
            v_qty := GREATEST(1, COALESCE((item_elem->>'quantity')::integer, 1));
            
            -- Try to resolve product UUID
            BEGIN
                v_prod_id := (item_elem->>'id')::uuid;
            EXCEPTION WHEN others THEN
                v_prod_id := NULL;
            END;

            -- Determine station
            IF (item_elem->>'department') ILIKE '%bar%'
               OR (item_elem->>'category') ILIKE '%coffee%'
               OR (item_elem->>'category') ILIKE '%juice%'
               OR (item_elem->>'category') ILIKE '%smoothie%'
               OR (item_elem->>'category') ILIKE '%beverage%'
               OR (item_elem->>'category') ILIKE '%tea%'
               OR v_prod_name ILIKE '%coffee%'
               OR v_prod_name ILIKE '%latte%'
               OR v_prod_name ILIKE '%juice%'
               OR v_prod_name ILIKE '%cooler%' THEN
                v_station := 'bar';
                v_status := COALESCE(rec.bar_status, 'served');
            ELSE
                v_station := 'kitchen';
                v_status := COALESCE(rec.kitchen_status, 'served');
            END IF;

            -- Insert into order_items if not already inserted
            IF NOT EXISTS (
                SELECT 1 FROM public.order_items
                WHERE order_id = rec.id AND product_name_snapshot = v_prod_name AND quantity = v_qty
            ) THEN
                INSERT INTO public.order_items (
                    order_id,
                    product_id,
                    product_name_snapshot,
                    unit_price_snapshot,
                    quantity,
                    station,
                    item_status,
                    created_at
                ) VALUES (
                    rec.id,
                    v_prod_id,
                    v_prod_name,
                    v_price,
                    v_qty,
                    v_station,
                    v_status,
                    rec.created_at
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 11. Create station_tickets for all existing orders
INSERT INTO public.station_tickets (order_id, ticket_number, station, status, sent_at, ready_at, served_at)
SELECT
    o.id,
    o.order_number || '-K',
    'kitchen',
    COALESCE(o.kitchen_status, 'served'),
    o.created_at,
    CASE WHEN o.kitchen_status IN ('ready', 'served') THEN o.created_at ELSE NULL END,
    CASE WHEN o.kitchen_status = 'served' THEN o.created_at ELSE NULL END
FROM public.pos_orders o
WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.station = 'kitchen')
ON CONFLICT (order_id, station) DO NOTHING;

INSERT INTO public.station_tickets (order_id, ticket_number, station, status, sent_at, ready_at, served_at)
SELECT
    o.id,
    o.order_number || '-B',
    'bar',
    COALESCE(o.bar_status, 'served'),
    o.created_at,
    CASE WHEN o.bar_status IN ('ready', 'served') THEN o.created_at ELSE NULL END,
    CASE WHEN o.bar_status = 'served' THEN o.created_at ELSE NULL END
FROM public.pos_orders o
WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.station = 'bar')
ON CONFLICT (order_id, station) DO NOTHING;

-- 12. Create atomic order creation stored procedure
CREATE OR REPLACE FUNCTION public.create_pos_order_atomic(
    p_order jsonb,
    p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_receipt_number text;
    v_table_name text;
    v_cashier_name text;
    v_department text;
    v_order_type text;
    v_subtotal numeric(12,2);
    v_service_charge numeric(12,2);
    v_discount numeric(12,2);
    v_tax numeric(12,2);
    v_total numeric(12,2);
    v_payment_method text;
    v_cash_received numeric(12,2);
    v_change_amount numeric(12,2);
    v_status text;
    v_payment_status text;
    v_kitchen_status text := 'served';
    v_bar_status text := 'served';
    v_has_kitchen boolean := false;
    v_has_bar boolean := false;
    item record;
    v_item_id uuid;
    v_prod_id uuid;
    v_prod_name text;
    v_unit_price numeric(12,2);
    v_qty integer;
    v_station text;
    v_current_stock integer;
    v_new_stock integer;
    v_track_stock boolean;
    v_order_row public.pos_orders%ROWTYPE;
BEGIN
    -- Extract order details
    v_order_number := p_order->>'order_number';
    IF v_order_number IS NULL OR trim(v_order_number) = '' THEN
        v_order_number := public.next_pos_order_number();
    END IF;

    v_receipt_number := COALESCE(p_order->>'receipt_number', 'RC-' || v_order_number);
    v_table_name := COALESCE(p_order->>'table_name', 'Takeaway');
    v_cashier_name := COALESCE(p_order->>'cashier_name', 'Staff');
    v_department := COALESCE(p_order->>'department', 'Juice & Food');
    v_order_type := COALESCE(p_order->>'order_type', CASE WHEN v_table_name ILIKE '%takeaway%' THEN 'takeaway' ELSE 'dine_in' END);
    v_subtotal := COALESCE((p_order->>'subtotal')::numeric, 0);
    v_service_charge := COALESCE((p_order->>'service_charge')::numeric, 0);
    v_discount := COALESCE((p_order->>'discount')::numeric, 0);
    v_tax := COALESCE((p_order->>'tax')::numeric, 0);
    v_total := COALESCE((p_order->>'total')::numeric, v_subtotal + v_service_charge + v_tax - v_discount);
    v_payment_method := COALESCE(p_order->>'payment_method', 'cash');
    v_cash_received := COALESCE((p_order->>'cash_received')::numeric, v_total);
    v_change_amount := COALESCE((p_order->>'change_amount')::numeric, 0);
    v_status := COALESCE(p_order->>'status', 'paid');
    v_payment_status := CASE WHEN v_status = 'open' THEN 'unpaid' ELSE 'paid' END;

    -- Try to parse client-supplied UUID or generate new
    BEGIN
        v_order_id := (p_order->>'id')::uuid;
    EXCEPTION WHEN others THEN
        v_order_id := gen_random_uuid();
    END IF;
    IF v_order_id IS NULL THEN
        v_order_id := gen_random_uuid();
    END IF;

    -- Analyze stations from items
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_station := COALESCE(item.value->>'station', '');
        IF v_station = '' THEN
            IF (item.value->>'department') ILIKE '%bar%'
               OR (item.value->>'category') ILIKE '%coffee%'
               OR (item.value->>'category') ILIKE '%juice%'
               OR (item.value->>'category') ILIKE '%beverage%'
               OR (item.value->>'name') ILIKE '%coffee%'
               OR (item.value->>'name') ILIKE '%latte%'
               OR (item.value->>'name') ILIKE '%tea%'
               OR (item.value->>'name') ILIKE '%juice%' THEN
                v_station := 'bar';
            ELSE
                v_station := 'kitchen';
            END IF;
        END IF;

        IF v_station = 'kitchen' THEN v_has_kitchen := true; END IF;
        IF v_station = 'bar' THEN v_has_bar := true; END IF;
    END LOOP;

    IF v_has_kitchen THEN v_kitchen_status := 'pending'; END IF;
    IF v_has_bar THEN v_bar_status := 'pending'; END IF;

    -- Insert or Update pos_orders
    INSERT INTO public.pos_orders (
        id,
        order_number,
        receipt_number,
        table_name,
        cashier_name,
        department,
        order_type,
        subtotal,
        service_charge,
        discount,
        tax,
        total,
        payment_method,
        cash_received,
        change_amount,
        status,
        payment_status,
        kitchen_status,
        bar_status,
        items,
        stock_deducted,
        created_at,
        updated_at,
        paid_at
    ) VALUES (
        v_order_id,
        v_order_number,
        v_receipt_number,
        v_table_name,
        v_cashier_name,
        v_department,
        v_order_type,
        v_subtotal,
        v_service_charge,
        v_discount,
        v_tax,
        v_total,
        v_payment_method,
        v_cash_received,
        v_change_amount,
        v_status,
        v_payment_status,
        v_kitchen_status,
        v_bar_status,
        p_items,
        true,
        COALESCE((p_order->>'created_at')::timestamptz, now()),
        now(),
        CASE WHEN v_status = 'paid' OR v_status = 'completed' THEN now() ELSE NULL END
    )
    ON CONFLICT (order_number) DO UPDATE SET
        subtotal = EXCLUDED.subtotal,
        service_charge = EXCLUDED.service_charge,
        discount = EXCLUDED.discount,
        tax = EXCLUDED.tax,
        total = EXCLUDED.total,
        payment_method = EXCLUDED.payment_method,
        cash_received = EXCLUDED.cash_received,
        change_amount = EXCLUDED.change_amount,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        items = EXCLUDED.items,
        updated_at = now()
    RETURNING * INTO v_order_row;

    -- Insert items into normalized order_items and update stock
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_name := COALESCE(item.value->>'name', 'Item');
        v_unit_price := COALESCE((item.value->>'price')::numeric, 0);
        v_qty := GREATEST(1, COALESCE((item.value->>'quantity')::integer, 1));
        
        BEGIN
            v_prod_id := (item.value->>'id')::uuid;
        EXCEPTION WHEN others THEN
            v_prod_id := NULL;
        END;

        -- Station determination
        v_station := COALESCE(item.value->>'station', '');
        IF v_station NOT IN ('kitchen', 'bar', 'none') THEN
            IF (item.value->>'department') ILIKE '%bar%'
               OR (item.value->>'category') ILIKE '%coffee%'
               OR (item.value->>'category') ILIKE '%juice%'
               OR (item.value->>'category') ILIKE '%beverage%'
               OR v_prod_name ILIKE '%coffee%'
               OR v_prod_name ILIKE '%latte%'
               OR v_prod_name ILIKE '%tea%'
               OR v_prod_name ILIKE '%juice%' THEN
                v_station := 'bar';
            ELSE
                v_station := 'kitchen';
            END IF;
        END IF;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name_snapshot,
            unit_price_snapshot,
            quantity,
            notes,
            station,
            item_status,
            created_at
        ) VALUES (
            v_order_row.id,
            v_prod_id,
            v_prod_name,
            v_unit_price,
            v_qty,
            COALESCE(item.value->>'notes', ''),
            v_station,
            'pending',
            now()
        );

        -- Stock deduction if product exists
        IF v_prod_id IS NOT NULL THEN
            SELECT stock, track_stock INTO v_current_stock, v_track_stock
            FROM public.pos_products
            WHERE id = v_prod_id
            FOR UPDATE;

            IF FOUND AND COALESCE(v_track_stock, true) THEN
                v_new_stock := GREATEST(0, COALESCE(v_current_stock, 0) - v_qty);
                UPDATE public.pos_products
                SET stock = v_new_stock, updated_at = now()
                WHERE id = v_prod_id;

                INSERT INTO public.stock_movements (
                    product_id,
                    order_id,
                    change_qty,
                    previous_stock,
                    new_stock,
                    reason,
                    notes
                ) VALUES (
                    v_prod_id,
                    v_order_row.id,
                    -v_qty,
                    v_current_stock,
                    v_new_stock,
                    'sale',
                    'Sale ' || v_order_number
                );
            END IF;
        END IF;
    END LOOP;

    -- Create/Update station tickets
    IF v_has_kitchen THEN
        INSERT INTO public.station_tickets (order_id, ticket_number, station, status, sent_at)
        VALUES (v_order_row.id, v_order_number || '-K', 'kitchen', 'pending', now())
        ON CONFLICT (order_id, station) DO UPDATE SET status = 'pending', sent_at = now();
    END IF;

    IF v_has_bar THEN
        INSERT INTO public.station_tickets (order_id, ticket_number, station, status, sent_at)
        VALUES (v_order_row.id, v_order_number || '-B', 'bar', 'pending', now())
        ON CONFLICT (order_id, station) DO UPDATE SET status = 'pending', sent_at = now();
    END IF;

    RETURN to_jsonb(v_order_row);
END;
$$;

-- 13. Enable RLS on newly created tables and ensure NO hidden filters
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated staff to read and write orders, tickets, and items
DROP POLICY IF EXISTS order_items_staff_all ON public.order_items;
CREATE POLICY order_items_staff_all ON public.order_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS station_tickets_staff_all ON public.station_tickets;
CREATE POLICY station_tickets_staff_all ON public.station_tickets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS stock_movements_staff_all ON public.stock_movements;
CREATE POLICY stock_movements_staff_all ON public.stock_movements
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also fix pos_orders RLS so ALL staff can read ALL orders (no cashier_id restriction)
DROP POLICY IF EXISTS pos_orders_staff_read ON public.pos_orders;
CREATE POLICY pos_orders_staff_read ON public.pos_orders
  FOR SELECT TO authenticated
  USING (true);

-- Fix coffee_bills RLS so ALL staff can read ALL coffee bills
DROP POLICY IF EXISTS coffee_bills_staff_read ON public.coffee_bills;
CREATE POLICY coffee_bills_staff_read ON public.coffee_bills
  FOR SELECT TO authenticated
  USING (true);

-- 14. Data Integrity Checker Function
CREATE OR REPLACE FUNCTION public.check_pos_data_integrity()
RETURNS TABLE (
    check_name text,
    status text,
    count_issues bigint,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check 1: Orphaned order_items
    RETURN QUERY
    SELECT
        'orphaned_order_items'::text,
        CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        count(*)::bigint,
        'Order items pointing to non-existent orders'::text
    FROM public.order_items oi
    WHERE NOT EXISTS (SELECT 1 FROM public.pos_orders o WHERE o.id = oi.order_id);

    -- Check 2: Duplicate order numbers
    RETURN QUERY
    SELECT
        'duplicate_order_numbers'::text,
        CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        count(*)::bigint,
        'Duplicate order numbers in pos_orders'::text
    FROM (
        SELECT order_number FROM public.pos_orders GROUP BY order_number HAVING count(*) > 1
    ) sub;

    -- Check 3: Orders without order items
    RETURN QUERY
    SELECT
        'orders_without_items'::text,
        CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END::text,
        count(*)::bigint,
        'Orders with zero items in order_items'::text
    FROM public.pos_orders o
    WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);

    -- Check 4: Products with negative stock
    RETURN QUERY
    SELECT
        'negative_stock_products'::text,
        CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'WARNING' END::text,
        count(*)::bigint,
        'Products where stock < 0'::text
    FROM public.pos_products p
    WHERE p.stock < 0;

    -- Check 5: Total orders count
    RETURN QUERY
    SELECT
        'total_orders_in_system'::text,
        'INFO'::text,
        count(*)::bigint,
        'Total pos_orders currently stored'::text
    FROM public.pos_orders;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_pos_order_atomic(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_pos_data_integrity() TO authenticated, service_role;
