-- =====================================================================
-- Migration: 20261024010000_enhance_recipe_inventory_deduction.sql
-- Description:
--   Improve deduct_order_inventory function to match recipes by both
--   product_id and product_name, and accurately subtract base quantities
--   multiplied by the order quantity.
-- =====================================================================

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
      SELECT e->>'id' AS product_id, e->>'name' AS product_name, COALESCE(NULLIF(e->>'quantity','')::numeric, 0) AS qty
      FROM jsonb_array_elements(o.items) e
    LOOP
      CONTINUE WHEN (line.product_id IS NULL AND line.product_name IS NULL) OR line.qty <= 0;
      
      -- 1. Deduct direct pos_products stock
      UPDATE public.pos_products 
         SET stock = GREATEST(0, COALESCE(stock, 0) - line.qty)
       WHERE id::text = line.product_id OR lower(trim(name)) = lower(trim(line.product_name));

      -- 2. Deduct recipe ingredients (multiplied by line.qty) matching by product_id or product_name
      FOR rec IN 
        SELECT ingredient_id, quantity_base 
        FROM public.recipe_items 
        WHERE product_id = line.product_id 
           OR lower(trim(product_id)) = lower(trim(line.product_name))
      LOOP
        UPDATE public.ingredients
           SET current_stock_base = GREATEST(0, current_stock_base - (rec.quantity_base * line.qty)),
               version = version + 1, updated_at = now()
         WHERE id = rec.ingredient_id;
        
        INSERT INTO public.ingredient_stock_movements (ingredient_id, quantity_change_base, reason, reference)
        VALUES (rec.ingredient_id, -(rec.quantity_base * line.qty), 'Sale ' || o.order_number, p_order_id::text);
      END LOOP;
    END LOOP;
  END IF;
  UPDATE public.pos_orders SET stock_deducted = true WHERE id = p_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.deduct_order_inventory(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
