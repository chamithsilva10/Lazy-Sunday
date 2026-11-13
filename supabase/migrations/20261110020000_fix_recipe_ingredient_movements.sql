-- ============================================================================
-- FIX INGREDIENT STOCK MOVEMENTS & RECIPE DEDUCTIONS
-- 1. Creates public.ingredient_stock_movements table
-- 2. Fixes pg_temp table detection in create_pos_order_atomic
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingredient_stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity_change_base numeric(16,3) NOT NULL,
    reason text NOT NULL,
    reference text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS service_charge_rate numeric(5,4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ingredient_movements_ing_date
    ON public.ingredient_stock_movements (ingredient_id, created_at DESC);

-- Update create_pos_order_atomic to use to_regclass('pg_temp.tmp_recipe_reqs')
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
    v_existing_order record;
    v_order_row record;
    v_status text;
    v_payment_status text;
    v_payment_method text;
    v_offline_ref text;
    v_subtotal numeric(12,2);
    v_service_charge numeric(12,2);
    v_discount numeric(12,2);
    v_tax numeric(12,2);
    v_total numeric(12,2);
    v_cash_received numeric(12,2);
    v_change_amount numeric(12,2);
    v_table_name text;
    v_cashier_name text;
    v_department text;
    v_order_type text;
    v_receipt_number text;
    v_notes text;
    v_idempotency_key text;
    v_action text;
    v_items_len integer;
    v_prod_id uuid;
    v_db_prod_name text;
    v_current_stock integer;
    v_new_stock integer;
    v_track_stock boolean;
    v_has_kitchen boolean := false;
    v_has_bar boolean := false;
    v_seq_json jsonb;
    p_rec record;
    ing_rec record;
    v_ing_stock numeric(16,3);
    v_ing_name text;
BEGIN
    -- 1. Extract Order Parameters
    v_status := COALESCE(p_order->>'status', 'paid');
    v_payment_status := COALESCE(
        NULLIF(TRIM(p_order->>'payment_status'), ''),
        CASE 
            WHEN v_status IN ('paid', 'completed') THEN 'paid'
            WHEN v_status = 'refunded' THEN 'refunded'
            WHEN v_status = 'cancelled' THEN 'void'
            ELSE 'unpaid'
        END
    );
    v_payment_method := COALESCE(p_order->>'payment_method', 'cash');
    v_subtotal := COALESCE((p_order->>'subtotal')::numeric, 0);
    v_service_charge := COALESCE((p_order->>'service_charge')::numeric, 0);
    v_discount := COALESCE((p_order->>'discount')::numeric, 0);
    v_tax := COALESCE((p_order->>'tax')::numeric, 0);
    v_total := COALESCE((p_order->>'total')::numeric, 0);
    v_cash_received := COALESCE((p_order->>'cash_received')::numeric, v_total);
    v_change_amount := COALESCE((p_order->>'change_amount')::numeric, 0);
    v_table_name := COALESCE(p_order->>'table_name', 'Takeaway');
    v_cashier_name := COALESCE(p_order->>'cashier_name', 'Staff');
    v_department := COALESCE(p_order->>'department', 'Juice & Food');
    v_order_type := COALESCE(p_order->>'order_type', 'dine_in');
    v_order_number := NULLIF(TRIM(p_order->>'order_number'), '');
    v_receipt_number := NULLIF(TRIM(p_order->>'receipt_number'), '');
    v_notes := COALESCE(p_order->>'notes', '');
    v_idempotency_key := NULLIF(TRIM(p_order->>'idempotency_key'), '');
    v_action := COALESCE(p_order->>'action', '');

    IF v_order_number IS NOT NULL AND (v_order_number LIKE 'OFFLINE-%' OR v_order_number LIKE 'TEMP-%') THEN
        v_offline_ref := v_order_number;
        v_order_number := NULL;
        v_receipt_number := NULL;
    END IF;

    IF p_order->>'id' IS NOT NULL AND p_order->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_order_id := (p_order->>'id')::uuid;
    ELSE
        v_order_id := gen_random_uuid();
    END IF;

    -- 2. Idempotency Check
    IF v_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_order
        FROM public.pos_orders
        WHERE idempotency_key = v_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            IF v_total > 0 AND v_existing_order.total <> v_total THEN
                RAISE EXCEPTION 'Idempotency key % already used with total %, cannot mutate to %',
                    v_idempotency_key, v_existing_order.total, v_total;
            END IF;

            RETURN jsonb_build_object(
                'id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'receipt_number', v_existing_order.receipt_number,
                'status', v_existing_order.status,
                'total', v_existing_order.total,
                'idempotent_replay', true,
                'created_at', v_existing_order.created_at,
                'updated_at', v_existing_order.updated_at
            );
        END IF;
    END IF;

    -- 3. Bill Numbers Generation
    IF v_order_number IS NULL THEN
        v_seq_json := public.get_next_bill_numbers();
        v_order_number := v_seq_json->>'order_number';
        v_receipt_number := v_seq_json->>'receipt_number';
    ELSIF v_receipt_number IS NULL THEN
        v_receipt_number := 'LS-RC-' || regexp_replace(v_order_number, '^LS-', '');
    END IF;

    -- 4. Check If Modifying Existing Order
    IF v_order_id IS NOT NULL THEN
        SELECT * INTO v_existing_order
        FROM public.pos_orders
        WHERE id = v_order_id
        FOR UPDATE;
    END IF;

    IF v_existing_order.id IS NULL AND v_order_number IS NOT NULL THEN
        SELECT * INTO v_existing_order
        FROM public.pos_orders
        WHERE order_number = v_order_number
        FOR UPDATE;

        IF v_existing_order.id IS NOT NULL THEN
            v_order_id := v_existing_order.id;
        END IF;
    END IF;

    -- 5. Prepare Net Inventory Deductions
    v_items_len := jsonb_array_length(COALESCE(p_items, '[]'::jsonb));

    IF v_items_len > 0 THEN
        DROP TABLE IF EXISTS tmp_incoming_items;
        CREATE TEMP TABLE tmp_incoming_items (
            product_id uuid,
            quantity integer,
            station text,
            name text,
            price numeric(12,2),
            notes text
        ) ON COMMIT DROP;

        INSERT INTO tmp_incoming_items (product_id, quantity, station, name, price, notes)
        SELECT
            CASE
                WHEN item->>'product_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (item->>'product_id')::uuid
                WHEN item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (item->>'id')::uuid
                ELSE NULL
            END,
            COALESCE((item->>'quantity')::integer, 1),
            COALESCE(item->>'station', 'kitchen'),
            COALESCE(item->>'name', 'Item'),
            COALESCE((item->>'price')::numeric, 0),
            COALESCE(item->>'notes', '')
        FROM jsonb_array_elements(p_items) AS item;

        IF EXISTS (SELECT 1 FROM tmp_incoming_items WHERE station = 'kitchen') THEN
            v_has_kitchen := true;
        END IF;
        IF EXISTS (SELECT 1 FROM tmp_incoming_items WHERE station = 'bar') THEN
            v_has_bar := true;
        END IF;

        IF v_action <> 'pay_existing' THEN
            DROP TABLE IF EXISTS tmp_order_products;
            CREATE TEMP TABLE tmp_order_products (
                product_id uuid PRIMARY KEY,
                delta_qty integer
            ) ON COMMIT DROP;

            IF v_existing_order.id IS NOT NULL THEN
                INSERT INTO tmp_order_products (product_id, delta_qty)
                SELECT
                    COALESCE(new_it.product_id, old_it.product_id) AS product_id,
                    (COALESCE(new_it.new_qty, 0) - COALESCE(old_it.old_qty, 0)) AS delta_qty
                FROM (
                    SELECT product_id, SUM(quantity) AS new_qty
                    FROM tmp_incoming_items
                    WHERE product_id IS NOT NULL
                    GROUP BY product_id
                ) new_it
                FULL OUTER JOIN (
                    SELECT product_id, SUM(quantity) AS old_qty
                    FROM public.order_items
                    WHERE order_id = v_existing_order.id AND product_id IS NOT NULL
                    GROUP BY product_id
                ) old_it ON new_it.product_id = old_it.product_id
                ORDER BY product_id ASC;
            ELSE
                INSERT INTO tmp_order_products (product_id, delta_qty)
                SELECT product_id, SUM(quantity) AS delta_qty
                FROM tmp_incoming_items
                WHERE product_id IS NOT NULL
                GROUP BY product_id
                ORDER BY product_id ASC;
            END IF;

            -- Row Locks in Sorted Order
            FOR p_rec IN SELECT * FROM tmp_order_products WHERE delta_qty > 0 ORDER BY product_id ASC LOOP
                SELECT stock, track_stock, name INTO v_current_stock, v_track_stock, v_db_prod_name
                FROM public.pos_products
                WHERE id = p_rec.product_id
                FOR UPDATE;

                IF COALESCE(v_track_stock, true) AND v_current_stock < p_rec.delta_qty THEN
                    RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)',
                        v_db_prod_name, v_current_stock, p_rec.delta_qty;
                END IF;
            END LOOP;

            -- Check and lock recipe ingredients in strict ASCENDING ingredient ID order
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_items') THEN
                DROP TABLE IF EXISTS tmp_recipe_reqs;
                CREATE TEMP TABLE tmp_recipe_reqs (
                    ingredient_id uuid PRIMARY KEY,
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

    -- 6. Upsert pos_orders Record
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
        service_charge_rate,
        discount,
        tax,
        total,
        payment_method,
        payment_status,
        split_payments,
        cash_received,
        change_amount,
        status,
        kitchen_status,
        bar_status,
        notes,
        idempotency_key,
        is_void,
        void_reason,
        paid_at,
        created_at,
        updated_at
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
        COALESCE((p_order->>'service_charge_rate')::numeric, 0),
        v_discount,
        v_tax,
        v_total,
        v_payment_method,
        v_payment_status,
        COALESCE(p_order->'split_payments', '[]'::jsonb),
        v_cash_received,
        v_change_amount,
        v_status,
        CASE WHEN v_has_kitchen THEN 'pending' ELSE 'served' END,
        CASE WHEN v_has_bar THEN 'pending' ELSE 'served' END,
        v_notes,
        v_idempotency_key,
        false,
        NULL,
        CASE WHEN v_status IN ('paid', 'completed') THEN now() ELSE NULL END,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        cashier_name = EXCLUDED.cashier_name,
        department = EXCLUDED.department,
        order_type = EXCLUDED.order_type,
        subtotal = EXCLUDED.subtotal,
        service_charge = EXCLUDED.service_charge,
        service_charge_rate = EXCLUDED.service_charge_rate,
        discount = EXCLUDED.discount,
        tax = EXCLUDED.tax,
        total = EXCLUDED.total,
        payment_method = EXCLUDED.payment_method,
        payment_status = EXCLUDED.payment_status,
        split_payments = COALESCE(EXCLUDED.split_payments, pos_orders.split_payments),
        cash_received = EXCLUDED.cash_received,
        change_amount = EXCLUDED.change_amount,
        status = EXCLUDED.status,
        kitchen_status = CASE
            WHEN pos_orders.kitchen_status IS NOT NULL AND pos_orders.kitchen_status <> 'pending' THEN pos_orders.kitchen_status
            ELSE EXCLUDED.kitchen_status
        END,
        bar_status = CASE
            WHEN pos_orders.bar_status IS NOT NULL AND pos_orders.bar_status <> 'pending' THEN pos_orders.bar_status
            ELSE EXCLUDED.bar_status
        END,
        notes = EXCLUDED.notes,
        idempotency_key = COALESCE(EXCLUDED.idempotency_key, pos_orders.idempotency_key),
        is_void = false,
        void_reason = NULL,
        paid_at = CASE
            WHEN EXCLUDED.status IN ('paid', 'completed') THEN COALESCE(pos_orders.paid_at, now())
            ELSE pos_orders.paid_at
        END,
        updated_at = now()
    RETURNING * INTO v_order_row;

    -- 7. Insert Order Items (Net additions)
    IF v_items_len > 0 THEN
        IF v_existing_order.id IS NOT NULL THEN
            DELETE FROM public.order_items WHERE order_id = v_order_row.id;
        END IF;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name_snapshot,
            unit_price_snapshot,
            quantity,
            notes,
            station,
            item_status
        )
        SELECT
            v_order_row.id,
            t.product_id,
            t.name,
            t.price,
            t.quantity,
            t.notes,
            t.station,
            'pending'
        FROM tmp_incoming_items t;
    END IF;

    -- 8. Upsert Station Tickets
    IF v_has_kitchen THEN
        INSERT INTO public.station_tickets (
            order_id, ticket_number, station, status, notes
        ) VALUES (
            v_order_row.id,
            'KOT-' || regexp_replace(v_order_number, '^LS-', ''),
            'kitchen',
            'pending',
            'Table: ' || v_table_name
        )
        ON CONFLICT (order_id, station) DO UPDATE SET
            status = CASE WHEN station_tickets.status <> 'served' THEN 'pending' ELSE station_tickets.status END,
            notes = EXCLUDED.notes;
    END IF;

    IF v_has_bar THEN
        INSERT INTO public.station_tickets (
            order_id, ticket_number, station, status, notes
        ) VALUES (
            v_order_row.id,
            'BOT-' || regexp_replace(v_order_number, '^LS-', ''),
            'bar',
            'pending',
            'Table: ' || v_table_name
        )
        ON CONFLICT (order_id, station) DO UPDATE SET
            status = CASE WHEN station_tickets.status <> 'served' THEN 'pending' ELSE station_tickets.status END,
            notes = EXCLUDED.notes;
    END IF;

    -- 9. Execute Product and Recipe Stock Deductions
    IF v_items_len > 0 AND v_action <> 'pay_existing' THEN
        FOR p_rec IN SELECT * FROM tmp_order_products WHERE delta_qty <> 0 ORDER BY product_id ASC LOOP
            SELECT stock, track_stock INTO v_current_stock, v_track_stock
            FROM public.pos_products
            WHERE id = p_rec.product_id;

            IF COALESCE(v_track_stock, true) THEN
                v_new_stock := GREATEST(0, v_current_stock - p_rec.delta_qty);

                UPDATE public.pos_products
                SET stock = v_new_stock,
                    updated_at = now()
                WHERE id = p_rec.product_id;

                INSERT INTO public.stock_movements (
                    product_id, order_id, change_qty, previous_stock, new_stock, reason, notes
                ) VALUES (
                    p_rec.product_id, v_order_row.id, -p_rec.delta_qty, v_current_stock, v_new_stock, 'sale', 'Sale ' || v_order_number
                );
            END IF;
        END LOOP;

        -- Execute recipe ingredient deductions using pg_temp detection
        IF to_regclass('pg_temp.tmp_recipe_reqs') IS NOT NULL THEN
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

    -- Return JSON payload of committed order
    RETURN jsonb_build_object(
        'id', v_order_row.id,
        'order_number', v_order_row.order_number,
        'receipt_number', v_order_row.receipt_number,
        'table_name', v_order_row.table_name,
        'cashier_name', v_order_row.cashier_name,
        'department', v_order_row.department,
        'order_type', v_order_row.order_type,
        'subtotal', v_order_row.subtotal,
        'service_charge', v_order_row.service_charge,
        'discount', v_order_row.discount,
        'tax', v_order_row.tax,
        'total', v_order_row.total,
        'payment_method', v_order_row.payment_method,
        'payment_status', v_order_row.payment_status,
        'split_payments', v_order_row.split_payments,
        'cash_received', v_order_row.cash_received,
        'change_amount', v_order_row.change_amount,
        'service_charge_rate', v_order_row.service_charge_rate,
        'status', v_order_row.status,
        'kitchen_status', v_order_row.kitchen_status,
        'bar_status', v_order_row.bar_status,
        'notes', v_order_row.notes,
        'offline_ref', v_offline_ref,
        'created_at', v_order_row.created_at,
        'updated_at', v_order_row.updated_at
    );
END;
$$;

-- Fix void_pos_order_atomic to log into ingredient_stock_movements with preparation status and wastage distinction
DROP FUNCTION IF EXISTS public.void_pos_order_atomic(uuid, text);

CREATE OR REPLACE FUNCTION public.void_pos_order_atomic(
    p_order_id uuid,
    p_reason text DEFAULT 'Voided by manager',
    p_restore_inventory boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order record;
    item_rec record;
    ing_rec record;
    v_prod_stock integer;
    v_track_stock boolean;
    v_has_prepared boolean := false;
    v_should_restore boolean;
    v_movement_reason text;
BEGIN
    SELECT * INTO v_order
    FROM public.pos_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found.', p_order_id;
    END IF;

    IF v_order.is_void THEN
        RETURN jsonb_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'status', v_order.status,
            'is_void', true,
            'void_reason', v_order.void_reason,
            'idempotent', true
        );
    END IF;

    -- Determine if items were already prepared (ready or served)
    -- Checks actual station tickets and order items
    SELECT EXISTS (
        SELECT 1 FROM public.station_tickets
        WHERE order_id = p_order_id AND status IN ('ready', 'served')
    ) OR EXISTS (
        SELECT 1 FROM public.order_items
        WHERE order_id = p_order_id AND item_status IN ('ready', 'served')
    ) INTO v_has_prepared;

    v_has_prepared := COALESCE(v_has_prepared, false);

    IF p_restore_inventory IS NOT NULL THEN
        v_should_restore := p_restore_inventory;
    ELSE
        -- If items were already prepared, physical ingredients/products were consumed (waste/spoilage)
        v_should_restore := NOT v_has_prepared;
    END IF;

    v_movement_reason := CASE 
        WHEN v_should_restore THEN 'Void ' || v_order.order_number
        ELSE 'Waste (void after prep) ' || v_order.order_number
    END;

    -- Reverse Product Stock (if v_should_restore is true)
    FOR item_rec IN (
        SELECT product_id, SUM(quantity) AS total_qty
        FROM public.order_items
        WHERE order_id = p_order_id AND product_id IS NOT NULL
        GROUP BY product_id
        ORDER BY product_id ASC
    ) LOOP
        SELECT stock, track_stock INTO v_prod_stock, v_track_stock
        FROM public.pos_products
        WHERE id = item_rec.product_id
        FOR UPDATE;

        IF COALESCE(v_track_stock, true) THEN
            IF v_should_restore THEN
                UPDATE public.pos_products
                SET stock = v_prod_stock + item_rec.total_qty,
                    updated_at = now()
                WHERE id = item_rec.product_id;

                INSERT INTO public.stock_movements (
                    product_id, order_id, change_qty, previous_stock, new_stock, reason, notes
                ) VALUES (
                    item_rec.product_id, p_order_id, item_rec.total_qty, v_prod_stock, v_prod_stock + item_rec.total_qty, 'void', p_reason
                );
            ELSE
                -- Record as waste without increasing finished stock
                INSERT INTO public.stock_movements (
                    product_id, order_id, change_qty, previous_stock, new_stock, reason, notes
                ) VALUES (
                    item_rec.product_id, p_order_id, 0, v_prod_stock, v_prod_stock, 'waste', 'Waste: ' || p_reason
                );
            END IF;
        END IF;
    END LOOP;

    -- Reverse Recipe Ingredient Stock (if v_should_restore is true)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_items') THEN
        FOR ing_rec IN (
            SELECT ri.ingredient_id, SUM(ri.quantity_base * oi.quantity) AS restore_qty
            FROM public.order_items oi
            JOIN public.recipe_items ri ON ri.product_id = oi.product_id::text
            WHERE oi.order_id = p_order_id
            GROUP BY ri.ingredient_id
        ) LOOP
            IF v_should_restore THEN
                UPDATE public.ingredients
                SET current_stock_base = current_stock_base + ing_rec.restore_qty,
                    version = version + 1,
                    updated_at = now()
                WHERE id = ing_rec.ingredient_id;

                INSERT INTO public.ingredient_stock_movements (
                    ingredient_id, quantity_change_base, reason, reference
                ) VALUES (
                    ing_rec.ingredient_id, ing_rec.restore_qty, v_movement_reason, p_order_id::text
                );
            ELSE
                -- Record as waste without restocking
                INSERT INTO public.ingredient_stock_movements (
                    ingredient_id, quantity_change_base, reason, reference
                ) VALUES (
                    ing_rec.ingredient_id, 0, v_movement_reason, p_order_id::text
                );
            END IF;
        END LOOP;
    END IF;

    -- Cancel Station Tickets
    UPDATE public.station_tickets
    SET status = 'cancelled'
    WHERE order_id = p_order_id;

    -- Mark Order Cancelled and Voided
    UPDATE public.pos_orders
    SET status = 'cancelled',
        payment_status = 'void',
        is_void = true,
        void_reason = p_reason || CASE WHEN NOT v_should_restore THEN ' (Ingredients logged as waste)' ELSE '' END,
        updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'is_void', v_order.is_void,
        'restored_inventory', v_should_restore,
        'has_prepared', v_has_prepared,
        'void_reason', v_order.void_reason,
        'updated_at', v_order.updated_at
    );
END;
$$;
