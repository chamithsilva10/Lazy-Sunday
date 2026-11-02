ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'served'
        CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'served')),
    ADD COLUMN IF NOT EXISTS bar_status TEXT NOT NULL DEFAULT 'served'
        CHECK (bar_status IN ('pending', 'preparing', 'ready', 'served'));

ALTER TABLE public.coffee_bills
    ADD COLUMN IF NOT EXISTS table_name TEXT NOT NULL DEFAULT 'Takeaway',
    ADD COLUMN IF NOT EXISTS bar_status TEXT NOT NULL DEFAULT 'served'
        CHECK (bar_status IN ('pending', 'preparing', 'ready', 'served'));

CREATE OR REPLACE FUNCTION public.update_pos_ticket_status(
    p_order_number TEXT,
    p_station TEXT,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_station NOT IN ('kitchen', 'bar') THEN
        RAISE EXCEPTION 'Invalid ticket station';
    END IF;
    IF p_status NOT IN ('pending', 'preparing', 'ready', 'served') THEN
        RAISE EXCEPTION 'Invalid ticket status';
    END IF;
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('cashier', 'manager', 'admin')
    ) THEN
        RAISE EXCEPTION 'Staff authorization required';
    END IF;

    IF p_station = 'kitchen' THEN
        UPDATE public.orders SET kitchen_status = p_status WHERE order_number = p_order_number;
    ELSE
        UPDATE public.orders SET bar_status = p_status WHERE order_number = p_order_number;
    END IF;

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_coffee_bar_ticket_status(p_bill_id UUID, p_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_status NOT IN ('pending', 'preparing', 'ready', 'served') THEN
        RAISE EXCEPTION 'Invalid bar ticket status';
    END IF;

    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('cashier', 'manager', 'admin')
    ) THEN
        RAISE EXCEPTION 'Staff authorization required';
    END IF;

    UPDATE public.coffee_bills
    SET bar_status = p_status, updated_at = now()
        WHERE id = p_bill_id;

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_coffee_bar_tickets()
RETURNS TABLE (
    id UUID,
    bill_number TEXT,
    bill_date TIMESTAMPTZ,
    table_name TEXT,
    bar_status TEXT,
    subtotal NUMERIC,
    discount NUMERIC,
    tax NUMERIC,
    grand_total NUMERIC,
    payment_method TEXT,
    created_at TIMESTAMPTZ,
    item_id UUID,
    coffee_product_id UUID,
    item_name TEXT,
    size TEXT,
    quantity INTEGER,
    unit_price NUMERIC,
    line_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('cashier', 'manager', 'admin')
    ) THEN
        RAISE EXCEPTION 'Staff authorization required';
    END IF;

    RETURN QUERY
    SELECT
        bills.id,
        bills.bill_number,
        bills.bill_date,
        bills.table_name,
        bills.bar_status,
        bills.subtotal,
        bills.discount,
        bills.tax,
        bills.grand_total,
        bills.payment_method,
        bills.created_at,
        items.id,
        items.coffee_product_id,
        items.item_name,
        items.size,
        items.quantity,
        items.unit_price,
        items.line_total
    FROM public.coffee_bills AS bills
    JOIN public.coffee_bill_items AS items ON items.bill_id = bills.id
    WHERE bills.bar_status <> 'served'
    ORDER BY bills.created_at DESC, items.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.update_coffee_bar_ticket_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_coffee_bar_ticket_status(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.update_pos_ticket_status(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pos_ticket_status(TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.get_active_coffee_bar_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_coffee_bar_tickets() TO authenticated;