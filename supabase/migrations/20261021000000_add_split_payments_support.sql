-- =====================================================================
-- Migration: 20261021000000_add_split_payments_support.sql
-- Description: Add split_payments JSONB column to pos_orders and coffee_bills
-- Supports mixed tender / split payments (e.g. Cash + Card)
-- =====================================================================

ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS split_payments jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.coffee_bills
  ADD COLUMN IF NOT EXISTS split_payments jsonb DEFAULT '[]'::jsonb;

-- Create GIN index for fast filtering by payment methods inside split_payments
CREATE INDEX IF NOT EXISTS idx_pos_orders_split_payments 
  ON public.pos_orders USING gin (split_payments);

CREATE INDEX IF NOT EXISTS idx_coffee_bills_split_payments 
  ON public.coffee_bills USING gin (split_payments);
