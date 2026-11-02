-- =====================================================================
-- Rollback Migration: 20261017000000_unified_pos_orders_and_products_rollback.sql
-- Description: Reverts the changes introduced in 20261017000000_unified_pos_orders_and_products.sql
-- =====================================================================

DROP FUNCTION IF EXISTS public.check_pos_data_integrity();
DROP FUNCTION IF EXISTS public.create_pos_order_atomic(jsonb, jsonb);

DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.station_tickets CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;

DROP TRIGGER IF EXISTS trg_pos_products_touch ON public.pos_products;
DROP FUNCTION IF EXISTS public.pos_touch_product_updated_at();

-- Note: We intentionally do not drop columns or records added to pos_orders
-- and pos_products to prevent permanent loss of customer order data.
