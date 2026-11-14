-- ============================================================================
-- POS DEMO SQL SEED DATA - EMPTY CLEAN STATE
-- 0 categories, 0 products, 0 orders, 0 inventory
-- ============================================================================

-- 1. Roles
INSERT OR REPLACE INTO roles (id, name, description, is_system) VALUES
('admin', 'Admin', 'Full administrative access across restaurant systems', 1),
('manager', 'Manager', 'Store management, inventory controls, and financial reports', 1),
('cashier', 'Cashier', 'Create orders, process bill payments, and view catalog', 1),
('kitchen', 'Kitchen', 'View kitchen order tickets and update prep status', 1),
('staff', 'Staff', 'General floor staff with basic ordering permissions', 1);

-- 2. Staff Users
INSERT OR REPLACE INTO app_users (id, username, full_name, email, password_hash, role_id, is_active) VALUES
('usr-001', 'admin', 'Alexa Pheloung (Administrator)', 'alexa@lazysunday.com', 'demo_hash_admin', 'admin', 1),
('usr-002', 'manager', 'Elena Rostova (Store Manager)', 'manager@posdemo.com', 'demo_hash_manager', 'manager', 1),
('usr-003', 'cashier', 'Alex Rivera (Head Cashier)', 'cashier@posdemo.com', 'demo_hash_cashier', 'cashier', 1),
('usr-004', 'kitchen', 'Marco Silva (Head Chef)', 'kitchen@posdemo.com', 'demo_hash_kitchen', 'kitchen', 1);

-- 3. Tables
INSERT OR REPLACE INTO pos_tables (id, name, capacity, status, section) VALUES
('tbl-1', 'Table 1', 2, 'available', 'Indoor'),
('tbl-2', 'Table 2', 4, 'available', 'Indoor'),
('tbl-3', 'Table 3', 4, 'available', 'Indoor'),
('tbl-4', 'Table 4', 6, 'available', 'Indoor'),
('tbl-5', 'Table 5', 2, 'available', 'Indoor'),
('tbl-6', 'Table 6', 4, 'available', 'Indoor'),
('tbl-7', 'Terrace 1', 2, 'available', 'Terrace'),
('tbl-8', 'Terrace 2', 4, 'available', 'Terrace'),
('tbl-9', 'Terrace 3', 4, 'available', 'Terrace'),
('tbl-10', 'Terrace 4', 6, 'available', 'Terrace'),
('tbl-11', 'VIP Lounge', 8, 'available', 'VIP Lounge'),
('tbl-12', 'Bar Counter 1', 1, 'available', 'Bar'),
('tbl-13', 'Bar Counter 2', 1, 'available', 'Bar'),
('tbl-14', 'Bar Counter 3', 1, 'available', 'Bar');

-- 4. Clean Orders, Products, Categories & Inventory (Clean State - 0 items)
DELETE FROM order_items;
DELETE FROM station_tickets;
DELETE FROM pos_orders;
DELETE FROM pos_products;
DELETE FROM pos_categories;
DELETE FROM ingredients;
