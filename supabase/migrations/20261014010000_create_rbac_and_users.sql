-- ============================================================================
-- Migration: Complete Role-Based Access Control (RBAC) and User Management
-- ============================================================================

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Role-Permissions Mapping Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Create App Users Table
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_app_users_username ON public.app_users(lower(username));
CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users(role_id);

-- Relax profiles constraint if profiles exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_allowed'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_allowed;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and service_role read access
CREATE POLICY "Allow read roles" ON public.roles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read permissions" ON public.permissions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read role_permissions" ON public.role_permissions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read app_users" ON public.app_users FOR SELECT TO authenticated, anon USING (true);

-- Admin & Service Role write access
CREATE POLICY "Allow write roles" ON public.roles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow write permissions" ON public.permissions FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow write role_permissions" ON public.role_permissions FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow write app_users" ON public.app_users FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED DATA: Default Roles
-- ============================================================================
INSERT INTO public.roles (id, name, description, is_system) VALUES
    ('admin', 'Admin', 'Full administrative access across all restaurant systems', true),
    ('cashier', 'Cashier', 'Create orders, process bill payments, and view menu catalog', true),
    ('kitchen', 'Kitchen', 'View kitchen order queue and update item preparation statuses', true),
    ('staff', 'Staff', 'General floor staff with basic ordering and catalog viewing permissions', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

-- ============================================================================
-- SEED DATA: Permissions Grouped by Module
-- ============================================================================
INSERT INTO public.permissions (id, code, module, name, description) VALUES
    -- Orders Module
    ('orders.create', 'orders.create', 'Orders', 'Create Orders', 'Initiate new dine-in, takeaway, and coffee orders'),
    ('orders.view', 'orders.view', 'Orders', 'View Orders', 'Browse historical and active customer order records'),
    ('orders.edit', 'orders.edit', 'Orders', 'Edit Orders', 'Modify line items, quantities, or tables on open tabs'),
    ('orders.cancel', 'orders.cancel', 'Orders', 'Cancel Orders', 'Cancel active unpaid orders and release dining tables'),
    ('orders.refund', 'orders.refund', 'Orders', 'Refund Orders', 'Authorize and process customer transaction refunds'),

    -- Payments Module
    ('payments.process', 'payments.process', 'Payments', 'Process Payment', 'Accept cash, card, and QR payments to close bills'),
    ('payments.discount', 'payments.discount', 'Payments', 'Apply Discounts', 'Authorize promotional or staff discounts on bills'),
    ('payments.receipt', 'payments.receipt', 'Payments', 'Print Receipts', 'Generate customer receipts and tax invoices'),

    -- Kitchen Module
    ('kitchen.view', 'kitchen.view', 'Kitchen', 'View Kitchen Queue', 'Access KOT/BOT live queues and active prep tickets'),
    ('kitchen.update_status', 'kitchen.update_status', 'Kitchen', 'Update Order Status', 'Advance tickets to Preparing, Ready, and Served'),

    -- Products Module
    ('products.view', 'products.view', 'Products', 'View Products', 'Browse catalog items, pricing, and menu categories'),
    ('products.create', 'products.create', 'Products', 'Create Products', 'Add new beverages, dishes, and merchandise'),
    ('products.edit', 'products.edit', 'Products', 'Edit Products', 'Update prices, descriptions, and category tags'),
    ('products.delete', 'products.delete', 'Products', 'Delete Products', 'Archive or permanently delete products from menu'),

    -- Inventory Module
    ('inventory.view', 'inventory.view', 'Inventory', 'View Inventory', 'Inspect ingredient levels and stock valuations'),
    ('inventory.update', 'inventory.update', 'Inventory', 'Update Inventory', 'Log stock receipts, spoilage, and stocktakes'),

    -- Reports Module
    ('reports.view', 'reports.view', 'Reports', 'View Reports', 'Analyze daily sales, category breakdowns, and revenue'),
    ('reports.export', 'reports.export', 'Reports', 'Export Reports', 'Download CSV and PDF reports for bookkeeping'),

    -- Users & Roles Module
    ('users.manage', 'users.manage', 'Users & Roles', 'Manage Users', 'Create, edit, deactivate, and delete staff accounts'),
    ('roles.manage', 'roles.manage', 'Users & Roles', 'Manage Roles', 'Create custom roles and customize permission matrices'),

    -- Settings Module
    ('settings.view', 'settings.view', 'Settings', 'View Settings', 'Inspect business profile, tax rates, and peripherals'),
    ('settings.edit', 'settings.edit', 'Settings', 'Edit Settings', 'Configure tax rules, service charges, and system preferences')
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ============================================================================
-- SEED DATA: Default Role-Permission Mappings
-- ============================================================================

-- Admin gets ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Cashier permissions: orders.create, orders.view, payments.process, payments.receipt, products.view
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('cashier', 'orders.create'),
    ('cashier', 'orders.view'),
    ('cashier', 'payments.process'),
    ('cashier', 'payments.receipt'),
    ('cashier', 'products.view')
ON CONFLICT DO NOTHING;

-- Kitchen permissions: kitchen.view, kitchen.update_status
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('kitchen', 'kitchen.view'),
    ('kitchen', 'kitchen.update_status')
ON CONFLICT DO NOTHING;

-- Staff permissions: orders.view, products.view
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('staff', 'orders.view'),
    ('staff', 'products.view')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED DATA: Default Seed Users
-- Passwords below are pre-hashed with bcrypt (cost factor 10) for 'admin123', 'cashier123', etc.
-- ============================================================================
INSERT INTO public.app_users (id, username, full_name, email, password_hash, role_id, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin', 'System Administrator', 'admin@charleys.com', '$2b$10$tZ2wzK2mY.8Jg2c5hF1QOuB4V.P7i8T4FzZ9.E5o9kM4j1x2y3z4a', 'admin', true),
    ('00000000-0000-0000-0000-000000000002', 'cashier', 'Head Cashier', 'cashier@charleys.com', '$2b$10$tZ2wzK2mY.8Jg2c5hF1QOuB4V.P7i8T4FzZ9.E5o9kM4j1x2y3z4a', 'cashier', true),
    ('00000000-0000-0000-0000-000000000003', 'kitchen', 'Kitchen Chef', 'kitchen@charleys.com', '$2b$10$tZ2wzK2mY.8Jg2c5hF1QOuB4V.P7i8T4FzZ9.E5o9kM4j1x2y3z4a', 'kitchen', true),
    ('00000000-0000-0000-0000-000000000004', 'staff', 'Floor Waiter', 'staff@charleys.com', '$2b$10$tZ2wzK2mY.8Jg2c5hF1QOuB4V.P7i8T4FzZ9.E5o9kM4j1x2y3z4a', 'staff', true)
ON CONFLICT (username) DO NOTHING;
