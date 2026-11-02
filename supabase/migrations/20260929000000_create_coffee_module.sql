-- Migration: 20260929000000_create_coffee_module.sql
-- Description: Create dedicated tables for the Coffee module (Products, Bills, Bill Items)
-- Completely separate from existing orders and products tables.

-- 1. Coffee Products Table
CREATE TABLE IF NOT EXISTS public.coffee_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Espresso',
    size TEXT DEFAULT 'Regular',
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for searching and status filtering
CREATE INDEX IF NOT EXISTS idx_coffee_products_status ON public.coffee_products(status);
CREATE INDEX IF NOT EXISTS idx_coffee_products_category ON public.coffee_products(category);
CREATE INDEX IF NOT EXISTS idx_coffee_products_name ON public.coffee_products(name);

-- 2. Coffee Bills Table
CREATE TABLE IF NOT EXISTS public.coffee_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT NOT NULL UNIQUE,
    bill_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_name TEXT,
    customer_phone TEXT,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'qr')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for filtering and reporting
CREATE INDEX IF NOT EXISTS idx_coffee_bills_date ON public.coffee_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_coffee_bills_payment_method ON public.coffee_bills(payment_method);
CREATE INDEX IF NOT EXISTS idx_coffee_bills_number ON public.coffee_bills(bill_number);

-- 3. Coffee Bill Items Table (Stores snapshot of product name and unit price)
CREATE TABLE IF NOT EXISTS public.coffee_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.coffee_bills(id) ON DELETE CASCADE,
    coffee_product_id UUID REFERENCES public.coffee_products(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    size TEXT DEFAULT 'Regular',
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coffee_bill_items_bill_id ON public.coffee_bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_coffee_bill_items_product_id ON public.coffee_bill_items(coffee_product_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.coffee_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_bill_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Coffee Products: anyone authenticated/anon can view active products; only admins can insert/update/delete
CREATE POLICY "Allow public read active coffee products"
    ON public.coffee_products FOR SELECT
    USING (true);

CREATE POLICY "Allow admin full access to coffee products"
    ON public.coffee_products FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Coffee Bills: authenticated staff can manage bills
CREATE POLICY "Allow authenticated read coffee bills"
    ON public.coffee_bills FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert/update/delete coffee bills"
    ON public.coffee_bills FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Coffee Bill Items: authenticated staff can manage items
CREATE POLICY "Allow authenticated read coffee bill items"
    ON public.coffee_bill_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert/update/delete coffee bill items"
    ON public.coffee_bill_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Initial Seed Data for Coffee Products
INSERT INTO public.coffee_products (name, category, size, price, image_url, status)
VALUES
    ('Espresso Single', 'Espresso', 'Single', 550.00, '/latte-coffee.png', 'active'),
    ('Espresso Double', 'Espresso', 'Double', 750.00, '/latte-coffee.png', 'active'),
    ('Caffe Latte', 'Milk Coffee', 'Regular', 850.00, '/latte-coffee.png', 'active'),
    ('Cappuccino', 'Milk Coffee', 'Regular', 800.00, '/latte-coffee.png', 'active'),
    ('Flat White', 'Milk Coffee', 'Regular', 850.00, '/latte-coffee.png', 'active'),
    ('Americano', 'Black Coffee', 'Large', 650.00, '/latte-coffee.png', 'active'),
    ('Caramel Macchiato', 'Specialty', 'Large', 950.00, '/latte-coffee.png', 'active'),
    ('Iced Vanilla Latte', 'Cold Coffee', 'Large', 950.00, '/iced-tea.png', 'active'),
    ('Cold Brew Reserve', 'Cold Coffee', 'Regular', 900.00, '/iced-tea.png', 'active'),
    ('Mocha Frappe', 'Blended', 'Large', 1100.00, '/ice-cream-sundae.png', 'active')
ON CONFLICT DO NOTHING;
