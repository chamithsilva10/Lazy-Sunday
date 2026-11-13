-- ============================================================================
-- Migration: 20261110000000_hardened_pos_core.sql
-- Description:
-- 1. Idempotency key tracking on pos_orders (prevents duplicate orders/deductions on retries)
-- 2. Deadlock-free sorted row locking on products and recipe ingredients
-- 3. Strict stock validation (rejects overselling and missing products with rollback)
-- 4. Correct lifecycle separation (no double deduction on paying existing tabs; handles incremental item additions)
-- 5. Atomic void/cancellation RPC with complete stock and ingredient reversal
-- 6. Child table touch trigger (order_items and station_tickets touch pos_orders.updated_at)
-- 7. Deterministic composite index (updated_at ASC, id ASC) for forward cursor sync
-- 8. Provisional offline bill number mapping (OFFLINE-*)
-- ============================================================================

-- 1. Add idempotency_key and offline_ref columns
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS offline_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_orders_idempotency_key 
  ON public.pos_orders (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Ensure station_tickets supports updated_at and cancelled status
ALTER TABLE public.station_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
DO $$ BEGIN
  ALTER TABLE public.station_tickets DROP CONSTRAINT IF EXISTS station_tickets_status_check;
  ALTER TABLE public.station_tickets ADD CONSTRAINT station_tickets_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'preparing'::text, 'ready'::text, 'served'::text, 'cancelled'::text]));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Deterministic composite index for forward cursor incremental sync
CREATE INDEX IF NOT EXISTS idx_pos_orders_sync_cursor 
  ON public.pos_orders (updated_at ASC, id ASC);

-- 3. Touch triggers to update pos_orders.updated_at on child changes
CREATE OR REPLACE FUNCTION public.pos_touch_parent_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.pos_orders SET updated_at = now() WHERE id = OLD.order_id;
    RETURN OLD;
  ELSE
    UPDATE public.pos_orders SET updated_at = now() WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_touch_parent ON public.order_items;
CREATE TRIGGER trg_order_items_touch_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.pos_touch_parent_order();

DROP TRIGGER IF EXISTS trg_station_tickets_touch_parent ON public.station_tickets;
CREATE TRIGGER trg_station_tickets_touch_parent
  AFTER INSERT OR UPDATE OR DELETE ON public.station_tickets
  FOR EACH ROW EXECUTE FUNCTION public.pos_touch_parent_order();

-- 4. Hardened create_pos_order_atomic
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
    v_offline_ref text;
    v_table_name text;
    v_cashier_name text;
    v_department text;
    v_order_type text;
    v_subtotal numeric(12,2);
    v_service_charge numeric(12,2);
    v_service_charge_rate numeric(6,4);
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
    v_idempotency_key text;
    v_action text;
    v_is_existing boolean := false;
    v_was_deducted boolean := false;
    v_has_deltas_to_deduct boolean := false;
    v_existing_row public.pos_orders%ROWTYPE;
    v_order_row public.pos_orders%ROWTYPE;
    v_seq_info jsonb;
    v_existing_id uuid;
    v_current_stock integer;
    v_new_stock integer;
    v_track_stock boolean;
    v_db_prod_name text;
    v_ing_stock numeric(16,3);
    v_ing_name text;
    item record;
    p_rec record;
    ing_rec record;
BEGIN
    -- Extract idempotency key and action
    v_idempotency_key := NULLIF(trim(p_order->>'idempotency_key'), '');
    v_action := COALESCE(p_order->>'action', 'create_order');

    -- IDEMPOTENCY CHECK: Return existing committed order immediately on retry
    IF v_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_row FROM public.pos_orders WHERE idempotency_key = v_idempotency_key LIMIT 1;
        IF FOUND THEN
            -- Verify payload consistency
            IF ABS(COALESCE((p_order->>'total')::numeric, v_existing_row.total) - v_existing_row.total) > 0.01 THEN
                RAISE EXCEPTION 'Idempotency key % already used with total %, cannot reuse with %',
                    v_idempotency_key, v_existing_row.total, p_order->>'total';
            END IF;
            RETURN to_jsonb(v_existing_row);
        END IF;
    END IF;

    -- Extract order ID
    BEGIN
        v_order_id := (p_order->>'id')::uuid;
    EXCEPTION WHEN others THEN
        v_order_id := NULL;
    END;

    -- Check if updating an existing order
    IF v_order_id IS NOT NULL THEN
        SELECT * INTO v_existing_row FROM public.pos_orders WHERE id = v_order_id FOR UPDATE;
        IF FOUND THEN
            v_is_existing := true;
            v_was_deducted := COALESCE(v_existing_row.stock_deducted, false);
            v_order_number := v_existing_row.order_number;
            v_receipt_number := v_existing_row.receipt_number;
            v_offline_ref := v_existing_row.offline_ref;
        END IF;
    END IF;

    -- Handle provisional offline bill numbering (e.g. OFFLINE-T1-0001)
    v_order_number := COALESCE(v_order_number, p_order->>'order_number');
    IF v_order_number IS NOT NULL AND v_order_number LIKE 'OFFLINE-%' THEN
        v_offline_ref := v_order_number;
        v_order_number := NULL; -- Trigger authoritative sequence allocation
        v_receipt_number := NULL;
    END IF;

    -- Allocate bill sequence atomically if not existing or in collision
    IF v_order_number IS NOT NULL AND trim(v_order_number) <> '' THEN
        SELECT id INTO v_existing_id FROM public.pos_orders WHERE order_number = v_order_number LIMIT 1;
        IF v_existing_id IS NOT NULL AND (v_order_id IS NULL OR v_existing_id <> v_order_id) THEN
            v_order_number := NULL; -- Collision with other terminal; allocate fresh sequence
        END IF;
    END IF;

    IF v_order_number IS NULL OR trim(v_order_number) = '' THEN
        v_seq_info := public.get_next_bill_numbers();
        v_order_number := v_seq_info->>'order_number';
        v_receipt_number := v_seq_info->>'receipt_number';
    ELSE
        v_receipt_number := COALESCE(v_receipt_number, p_order->>'receipt_number', 'LS-RC-' || regexp_replace(v_order_number, '^LS-', ''));
    END IF;

    IF v_order_id IS NULL THEN
        v_order_id := gen_random_uuid();
    END IF;

    v_table_name := COALESCE(p_order->>'table_name', 'Takeaway');
    v_cashier_name := COALESCE(p_order->>'cashier_name', 'Staff');
    v_department := COALESCE(p_order->>'department', 'Juice & Food');
    v_order_type := COALESCE(p_order->>'order_type', CASE WHEN v_table_name ILIKE '%takeaway%' THEN 'takeaway' ELSE 'dine_in' END);
    v_subtotal := COALESCE((p_order->>'subtotal')::numeric, 0);
    v_service_charge := COALESCE((p_order->>'service_charge')::numeric, 0);
    v_service_charge_rate := COALESCE((p_order->>'service_charge_rate')::numeric, 0.1);
    v_discount := COALESCE((p_order->>'discount')::numeric, 0);
    v_tax := COALESCE((p_order->>'tax')::numeric, 0);
    v_total := COALESCE((p_order->>'total')::numeric, v_subtotal + v_service_charge + v_tax - v_discount);
    v_payment_method := COALESCE(p_order->>'payment_method', 'cash');
    v_cash_received := COALESCE((p_order->>'cash_received')::numeric, v_total);
    v_change_amount := COALESCE((p_order->>'change_amount')::numeric, 0);
    v_status := COALESCE(p_order->>'status', CASE WHEN v_action = 'send_kitchen' THEN 'open' ELSE 'paid' END);
    v_payment_status := CASE WHEN v_status = 'open' THEN 'unpaid' ELSE 'paid' END;
    v_split_payments := COALESCE(p_order->'split_payments', '[]'::jsonb);
    v_customer_id := p_order->>'customer_id';
    v_customer_name := COALESCE(p_order->>'customer_name', 'Walk-in');
    v_notes := COALESCE(p_order->>'notes', '');

    -- Analyze stations from items
    IF jsonb_typeof(p_items) = 'array' THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            IF (item.value->>'station') = 'kitchen' THEN v_has_kitchen := true; END IF;
            IF (item.value->>'station') = 'bar' THEN v_has_bar := true; END IF;
            IF (item.value->>'station') IS NULL OR (item.value->>'station') = '' THEN
                IF (item.value->>'department') ILIKE '%bar%'
                   OR (item.value->>'category') ILIKE '%coffee%'
                   OR (item.value->>'category') ILIKE '%juice%'
                   OR (item.value->>'name') ILIKE '%coffee%'
                   OR (item.value->>'name') ILIKE '%tea%'
                   OR (item.value->>'name') ILIKE '%juice%' THEN
                    v_has_bar := true;
                ELSE
                    v_has_kitchen := true;
                END IF;
            END IF;
        END LOOP;
    END IF;

    IF v_has_kitchen THEN v_kitchen_status := 'pending'; END IF;
    IF v_has_bar THEN v_bar_status := 'pending'; END IF;

    -- INVENTORY VALIDATION & LOCKING (Protected by Sorted Row Locks)
    DROP TABLE IF EXISTS tmp_order_products;
    CREATE TEMP TABLE tmp_order_products (
        product_id uuid PRIMARY KEY,
        product_name text,
        delta_qty integer
    ) ON COMMIT DROP;

    IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
        -- Validate line item quantities
        FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            IF COALESCE((item.value->>'quantity')::integer, 0) <= 0 THEN
                RAISE EXCEPTION 'Invalid quantity for item %: must be greater than 0', item.value->>'name';
            END IF;
        END LOOP;

        -- Calculate net delta quantity to deduct per product
        -- If order was already deducted, only newly added items are deducted
        INSERT INTO tmp_order_products (product_id, product_name, delta_qty)
        WITH new_cart AS (
            SELECT 
                (elem->>'id')::uuid AS product_id,
                COALESCE(elem->>'name', 'Item') AS product_name,
                SUM(GREATEST(1, COALESCE((elem->>'quantity')::integer, 1))) AS total_qty
            FROM jsonb_array_elements(p_items) elem
            WHERE (elem->>'id') IS NOT NULL 
              AND (elem->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            GROUP BY (elem->>'id')::uuid, COALESCE(elem->>'name', 'Item')
        ),
        existing_items AS (
            SELECT 
                product_id,
                SUM(quantity) AS old_qty
            FROM public.order_items
            WHERE order_id = v_order_id AND product_id IS NOT NULL AND v_was_deducted = true
            GROUP BY product_id
        )
        SELECT 
            nc.product_id,
            nc.product_name,
            GREATEST(0, (nc.total_qty - COALESCE(ei.old_qty, 0))::integer) AS delta_qty
        FROM new_cart nc
        LEFT JOIN existing_items ei ON ei.product_id = nc.product_id;

        -- Check if any delta needs deduction
        SELECT EXISTS (SELECT 1 FROM tmp_order_products WHERE delta_qty > 0) INTO v_has_deltas_to_deduct;

        IF v_has_deltas_to_deduct THEN
            -- Check product availability while holding exclusive row locks in ASCENDING UUID order
            FOR p_rec IN SELECT * FROM tmp_order_products WHERE delta_qty > 0 ORDER BY product_id ASC LOOP
                SELECT stock, track_stock, name INTO v_current_stock, v_track_stock, v_db_prod_name
                FROM public.pos_products
                WHERE id = p_rec.product_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Product % (ID %) not found', p_rec.product_name, p_rec.product_id;
                END IF;

                IF COALESCE(v_track_stock, true) AND v_current_stock < p_rec.delta_qty THEN
                    RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)',
                        v_db_prod_name, v_current_stock, p_rec.delta_qty;
                END IF;
            END LOOP;

            -- Check recipe ingredients availability in strict ASCENDING ingredient ID order
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_items') THEN
                DROP TABLE IF EXISTS tmp_recipe_reqs;
                CREATE TEMP TABLE tmp_recipe_reqs (
                    ingredient_id text PRIMARY KEY,
                    total_ingredient_qty numeric(16,3)
                ) ON COMMIT DROP;

                INSERT INTO tmp_recipe_reqs (ingredient_id, total_ingredient_qty)
                SELECT 
                    ri.ingredient_id,
                    SUM(ri.quantity_base * op.delta_qty) AS total_ingredient_qty
                FROM tmp_order_products op
                JOIN public.recipe_items ri ON ri.product_id = op.product_id::text
                WHERE op.delta_qty > 0
                GROUP BY ri.ingredient_id
                ORDER BY ri.ingredient_id ASC;

                FOR ing_rec IN SELECT * FROM tmp_recipe_reqs ORDER BY ingredient_id ASC LOOP
                    SELECT current_stock_base, name INTO v_ing_stock, v_ing_name
                    FROM public.ingredients
                    WHERE id = ing_rec.ingredient_id
                    FOR UPDATE;

                    IF FOUND AND v_ing_stock < ing_rec.total_ingredient_qty THEN
                        RAISE EXCEPTION 'Insufficient ingredient stock for % (Available: %, Required: %)',
                            v_ing_name, v_ing_stock, ing_rec.total_ingredient_qty;
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;

    -- Insert or Update pos_orders record atomically FIRST so foreign keys are satisfied
    INSERT INTO public.pos_orders (
        id,
        order_number,
        receipt_number,
        offline_ref,
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
        idempotency_key,
        created_at,
        updated_at,
        paid_at
    ) VALUES (
        v_order_id,
        v_order_number,
        v_receipt_number,
        v_offline_ref,
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
        true, -- Mark stock_deducted = true once order is created/processed
        v_customer_id,
        v_customer_name,
        v_notes,
        v_idempotency_key,
        COALESCE((p_order->>'created_at')::timestamptz, now()),
        now(),
        CASE WHEN v_status IN ('paid', 'completed') THEN now() ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        receipt_number = EXCLUDED.receipt_number,
        offline_ref = COALESCE(EXCLUDED.offline_ref, pos_orders.offline_ref),
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
        is_void = false,
        void_reason = NULL,
        kitchen_status = COALESCE(EXCLUDED.kitchen_status, pos_orders.kitchen_status),
        bar_status = COALESCE(EXCLUDED.bar_status, pos_orders.bar_status),
        items = EXCLUDED.items,
        stock_deducted = true,
        customer_name = EXCLUDED.customer_name,
        notes = EXCLUDED.notes,
        idempotency_key = COALESCE(EXCLUDED.idempotency_key, pos_orders.idempotency_key),
        updated_at = now(),
        paid_at = CASE WHEN EXCLUDED.status IN ('paid', 'completed') AND pos_orders.paid_at IS NULL THEN now() ELSE pos_orders.paid_at END
    RETURNING * INTO v_order_row;

    -- Execute product stock deductions and stock_movements only for positive deltas
    IF v_has_deltas_to_deduct THEN
        FOR p_rec IN SELECT * FROM tmp_order_products WHERE delta_qty > 0 ORDER BY product_id ASC LOOP
            SELECT stock, track_stock INTO v_current_stock, v_track_stock
            FROM public.pos_products
            WHERE id = p_rec.product_id;

            IF COALESCE(v_track_stock, true) THEN
                v_new_stock := v_current_stock - p_rec.delta_qty;
                UPDATE public.pos_products
                SET stock = v_new_stock, updated_at = now()
                WHERE id = p_rec.product_id;

                INSERT INTO public.stock_movements (
                    product_id, order_id, change_qty, previous_stock, new_stock, reason, notes
                ) VALUES (
                    p_rec.product_id, v_order_row.id, -p_rec.delta_qty, v_current_stock, v_new_stock, 'sale', 'Sale ' || v_order_number
                );
            END IF;
        END LOOP;

        -- Execute recipe ingredient deductions
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tmp_recipe_reqs') THEN
            FOR ing_rec IN SELECT * FROM tmp_recipe_reqs ORDER BY ingredient_id ASC LOOP
                SELECT current_stock_base INTO v_ing_stock
                FROM public.ingredients
                WHERE id = ing_rec.ingredient_id;

                UPDATE public.ingredients
                SET current_stock_base = v_ing_stock - ing_rec.total_ingredient_qty,
                    version = version + 1,
                    updated_at = now()
                WHERE id = ing_rec.ingredient_id;

                INSERT INTO public.ingredient_stock_movements (
                    ingredient_id, quantity_change_base, reason, reference
                ) VALUES (
                    ing_rec.ingredient_id, -ing_rec.total_ingredient_qty, 'Sale ' || v_order_number, v_order_row.id::text
                );
            END LOOP;
        END IF;
    END IF;

    -- Clean up temporary tables
    DROP TABLE IF EXISTS tmp_order_products;
    DROP TABLE IF EXISTS tmp_recipe_reqs;

    -- Insert or replace order_items
    IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
        DELETE FROM public.order_items WHERE order_id = v_order_row.id;
        FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            BEGIN
                v_existing_id := (item.value->>'id')::uuid;
            EXCEPTION WHEN others THEN
                v_existing_id := NULL;
            END;

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
                v_existing_id,
                COALESCE(item.value->>'name', 'Item'),
                COALESCE((item.value->>'price')::numeric, 0),
                GREATEST(1, COALESCE((item.value->>'quantity')::integer, 1)),
                COALESCE(item.value->>'notes', ''),
                COALESCE(item.value->>'station', 'kitchen'),
                'pending',
                now()
            );
        END LOOP;
    END IF;

    -- Create or update station tickets
    IF v_has_kitchen THEN
        INSERT INTO public.station_tickets (order_id, ticket_number, station, status, sent_at)
        VALUES (v_order_row.id, v_order_number || '-K', 'kitchen', 'pending', now())
        ON CONFLICT (order_id, station) DO UPDATE SET updated_at = now() WHERE station_tickets.status <> 'served';
    END IF;

    IF v_has_bar THEN
        INSERT INTO public.station_tickets (order_id, ticket_number, station, status, sent_at)
        VALUES (v_order_row.id, v_order_number || '-B', 'bar', 'pending', now())
        ON CONFLICT (order_id, station) DO UPDATE SET updated_at = now() WHERE station_tickets.status <> 'served';
    END IF;

    RETURN to_jsonb(v_order_row);
END;
$$;

-- 5. Atomic Void and Refund Function with complete stock and ingredient reversal
CREATE OR REPLACE FUNCTION public.void_pos_order_atomic(
    p_order_id uuid,
    p_reason text DEFAULT 'Voided by staff'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.pos_orders%ROWTYPE;
    item record;
    ing_rec record;
    v_current_stock integer;
    v_new_stock integer;
BEGIN
    SELECT * INTO v_order FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order ID % not found', p_order_id;
    END IF;

    -- Idempotent void check
    IF COALESCE(v_order.is_void, false) = true THEN
        RETURN to_jsonb(v_order);
    END IF;

    -- If stock was deducted, reverse all items and raw ingredients
    IF COALESCE(v_order.stock_deducted, false) = true THEN
        -- Reverse product stock in strictly sorted product_id order
        FOR item IN 
            SELECT product_id, SUM(quantity) as quantity
            FROM public.order_items 
            WHERE order_id = p_order_id AND product_id IS NOT NULL
            GROUP BY product_id
            ORDER BY product_id ASC
        LOOP
            SELECT stock INTO v_current_stock FROM public.pos_products WHERE id = item.product_id FOR UPDATE;
            IF FOUND THEN
                v_new_stock := v_current_stock + item.quantity;
                UPDATE public.pos_products SET stock = v_new_stock, updated_at = now() WHERE id = item.product_id;

                INSERT INTO public.stock_movements (
                    product_id, order_id, change_qty, previous_stock, new_stock, reason, notes
                ) VALUES (
                    item.product_id, p_order_id, item.quantity, v_current_stock, v_new_stock, 'void', 'Void order ' || v_order.order_number
                );
            END IF;
        END LOOP;

        -- Reverse recipe ingredients if tables exist in sorted ingredient_id order
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_items') THEN
            FOR ing_rec IN 
                SELECT ri.ingredient_id, SUM(ri.quantity_base * oi.quantity) as restore_qty
                FROM public.order_items oi
                JOIN public.recipe_items ri ON ri.product_id = oi.product_id::text
                WHERE oi.order_id = p_order_id
                GROUP BY ri.ingredient_id
                ORDER BY ri.ingredient_id ASC
            LOOP
                UPDATE public.ingredients
                SET current_stock_base = current_stock_base + ing_rec.restore_qty,
                    version = version + 1,
                    updated_at = now()
                WHERE id = ing_rec.ingredient_id;

                INSERT INTO public.ingredient_stock_movements (
                    ingredient_id, quantity_change_base, reason, reference
                ) VALUES (
                    ing_rec.ingredient_id, ing_rec.restore_qty, 'Void ' || v_order.order_number, p_order_id::text
                );
            END LOOP;
        END IF;
    END IF;

    -- Mark order voided/cancelled
    UPDATE public.pos_orders
    SET status = 'cancelled',
        payment_status = 'void',
        is_void = true,
        void_reason = p_reason,
        updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    -- Cancel tickets
    UPDATE public.station_tickets
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = p_order_id;

    RETURN to_jsonb(v_order);
END;
$$;

-- 6. Permissions: Restrict anonymous invocation, grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.create_pos_order_atomic(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pos_order_atomic(jsonb, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.void_pos_order_atomic(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_pos_order_atomic(uuid, text) TO authenticated, service_role;
