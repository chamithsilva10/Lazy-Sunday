-- ============================================================================
-- Migration: 20261109000000_atomic_bill_sequence.sql
-- 1. Atomic PostgreSQL Sequence for Concurrency-Safe Bill & Receipt Numbering
-- 2. Preserves format 'LS-000xxx' and 'LS-RC-000xxx'
-- 3. Hardens create_pos_order_atomic with SELECT FOR UPDATE and UUID fallback
-- 4. Ensures indexes for lightning-fast incremental synchronization
-- ============================================================================

-- Ensure helpful columns exist on pos_orders
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS split_payments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS customer_id text;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT 'Walk-in';
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Optimized indexes for fast incremental syncing and conflict resolution
CREATE INDEX IF NOT EXISTS idx_pos_orders_updated_at ON public.pos_orders (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_orders_order_number ON public.pos_orders (order_number);

-- 1. Create atomic sequence starting after existing max bill number
CREATE SEQUENCE IF NOT EXISTS public.pos_bill_sequence START 101;

SELECT setval('public.pos_bill_sequence', GREATEST(
  100,
  COALESCE((
    SELECT max(NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '')::bigint)
    FROM public.pos_orders
    WHERE order_number ~ '^LS-[0-9]+'
  ), 100),
  COALESCE((
    SELECT max(NULLIF(regexp_replace(bill_number, '[^0-9]', '', 'g'), '')::bigint)
    FROM public.coffee_bills
    WHERE bill_number ~ '^LS-[0-9]+'
  ), 100)
));

-- 2. Concurrency-Safe Atomic Bill Number Generator
CREATE OR REPLACE FUNCTION public.get_next_bill_numbers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seq bigint;
  v_order_num text;
  v_receipt_num text;
BEGIN
  v_seq := nextval('public.pos_bill_sequence');
  v_order_num := 'LS-' || lpad(v_seq::text, 6, '0');
  v_receipt_num := 'LS-RC-' || lpad(v_seq::text, 6, '0');
  RETURN jsonb_build_object(
    'order_number', v_order_num,
    'receipt_number', v_receipt_num,
    'seq', v_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_bill_numbers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_bill_numbers() TO authenticated, anon, service_role;

-- 3. Update create_pos_order_atomic to use atomic sequence and hardened inventory locks
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
    v_split_payments jsonb;
    v_customer_id text;
    v_customer_name text;
    v_notes text;
    item record;
    rec record;
    v_prod_id uuid;
    v_prod_name text;
    v_unit_price numeric(12,2);
    v_qty integer;
    v_station text;
    v_current_stock integer;
    v_new_stock integer;
    v_track_stock boolean;
    v_order_row public.pos_orders%ROWTYPE;
    v_seq_info jsonb;
    v_existing_id uuid;
BEGIN
    -- Extract order details
    v_order_number := p_order->>'order_number';
    
    -- Check if provided order_number already exists under a DIFFERENT order id
    IF v_order_number IS NOT NULL AND trim(v_order_number) <> '' THEN
        SELECT id INTO v_existing_id FROM public.pos_orders WHERE order_number = v_order_number LIMIT 1;
        IF v_existing_id IS NOT NULL AND (p_order->>'id' IS NULL OR v_existing_id::text <> p_order->>'id') THEN
            -- Conflicting order number from simultaneous checkout; allocate safe new atomic number
            v_order_number := NULL;
        END IF;
    END IF;

    IF v_order_number IS NULL OR trim(v_order_number) = '' THEN
        v_seq_info := public.get_next_bill_numbers();
        v_order_number := v_seq_info->>'order_number';
        v_receipt_number := v_seq_info->>'receipt_number';
    ELSE
        v_receipt_number := COALESCE(p_order->>'receipt_number', 'LS-RC-' || regexp_replace(v_order_number, '^LS-', ''));
    END IF;

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
    v_split_payments := COALESCE(p_order->'split_payments', '[]'::jsonb);
    v_customer_id := p_order->>'customer_id';
    v_customer_name := COALESCE(p_order->>'customer_name', 'Walk-in');
    v_notes := COALESCE(p_order->>'notes', '');

    -- Try to parse client-supplied UUID or generate new
    BEGIN
        v_order_id := (p_order->>'id')::uuid;
    EXCEPTION WHEN others THEN
        v_order_id := gen_random_uuid();
    END;
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

    -- Insert or Update pos_orders atomically
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
        split_payments,
        cash_received,
        change_amount,
        status,
        payment_status,
        kitchen_status,
        bar_status,
        items,
        stock_deducted,
        customer_id,
        customer_name,
        notes,
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
        v_split_payments,
        v_cash_received,
        v_change_amount,
        v_status,
        v_payment_status,
        v_kitchen_status,
        v_bar_status,
        p_items,
        true,
        v_customer_id,
        v_customer_name,
        v_notes,
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
        split_payments = EXCLUDED.split_payments,
        cash_received = EXCLUDED.cash_received,
        change_amount = EXCLUDED.change_amount,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        items = EXCLUDED.items,
        customer_name = EXCLUDED.customer_name,
        notes = EXCLUDED.notes,
        updated_at = now()
    RETURNING * INTO v_order_row;

    -- Insert items into normalized order_items and execute thread-safe stock updates
    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_prod_name := COALESCE(item.value->>'name', 'Item');
        v_unit_price := COALESCE((item.value->>'price')::numeric, 0);
        v_qty := GREATEST(1, COALESCE((item.value->>'quantity')::integer, 1));
        
        BEGIN
            v_prod_id := (item.value->>'id')::uuid;
        EXCEPTION WHEN others THEN
            v_prod_id := NULL;
        END;

        -- Fallback product lookup by name if client passed non-UUID identifier
        IF v_prod_id IS NULL AND v_prod_name IS NOT NULL THEN
            SELECT id INTO v_prod_id FROM public.pos_products WHERE name ILIKE v_prod_name LIMIT 1;
        END IF;

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

        -- CRITICAL: SELECT ... FOR UPDATE acquires an exclusive row lock on pos_products
        -- This guarantees that concurrent sales across multiple terminals cannot overwrite stock
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

        -- Also deduct raw recipe ingredients if configured
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_items') THEN
                FOR rec IN 
                    SELECT ingredient_id, quantity_base 
                    FROM public.recipe_items 
                    WHERE (v_prod_id IS NOT NULL AND product_id::text = v_prod_id::text)
                       OR (v_prod_name IS NOT NULL AND lower(trim(product_id::text)) = lower(trim(v_prod_name)))
                LOOP
                    UPDATE public.ingredients
                       SET current_stock_base = GREATEST(0, current_stock_base - (rec.quantity_base * v_qty)),
                           version = version + 1, updated_at = now()
                     WHERE id = rec.ingredient_id;
                    
                    INSERT INTO public.ingredient_stock_movements (ingredient_id, quantity_change_base, reason, reference)
                    VALUES (rec.ingredient_id, -(rec.quantity_base * v_qty), 'Sale ' || v_order_number, v_order_row.id::text);
                END LOOP;
            END IF;
        EXCEPTION WHEN others THEN
            NULL;
        END;
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

GRANT EXECUTE ON FUNCTION public.create_pos_order_atomic(jsonb, jsonb) TO authenticated, anon, service_role;
