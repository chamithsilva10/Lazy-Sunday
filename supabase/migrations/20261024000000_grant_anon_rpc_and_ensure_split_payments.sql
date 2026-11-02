-- =====================================================================
-- Migration: 20261024000000_grant_anon_rpc_and_ensure_split_payments.sql
-- Description: 
--   1. Ensure split_payments JSONB column on pos_orders and coffee_bills
--   2. Grant EXECUTE permissions on adjust_ingredient_stock and 
--      deduct_order_inventory to anon and authenticated roles
--   3. Reload PostgREST schema cache
-- =====================================================================

ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS split_payments jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.coffee_bills
  ADD COLUMN IF NOT EXISTS split_payments jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pos_orders_split_payments 
  ON public.pos_orders USING gin (split_payments);

CREATE INDEX IF NOT EXISTS idx_coffee_bills_split_payments 
  ON public.coffee_bills USING gin (split_payments);

GRANT EXECUTE ON FUNCTION public.adjust_ingredient_stock(uuid, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_order_inventory(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
