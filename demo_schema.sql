-- ============================================================================
-- POS DEMO SQL DATABASE SCHEMA (Standalone SQLite / ANSI SQL Compatible)
-- Zero Supabase dependencies - Fully isolated client-facing database
-- ============================================================================

-- 1. Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 2. Staff App Users
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  role_id TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 3. Product Categories & Catalog
CREATE TABLE IF NOT EXISTS pos_categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  category_id TEXT,
  category_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0.0,
  cost_price REAL DEFAULT 0.0,
  stock INTEGER DEFAULT 0,
  station TEXT DEFAULT 'kitchen', -- 'kitchen' | 'bar'
  department TEXT DEFAULT 'Juice & Food', -- 'Juice & Food' | 'Coffee Bar'
  image TEXT,
  description TEXT,
  temperature TEXT DEFAULT 'none',
  dietary_tags TEXT, -- JSON array string
  tax_rate REAL DEFAULT 0.0,
  is_archived INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES pos_categories(id)
);

-- 4. Restaurant Tables & Sessions
CREATE TABLE IF NOT EXISTS pos_tables (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  capacity INTEGER DEFAULT 2,
  status TEXT DEFAULT 'available', -- 'available' | 'occupied' | 'reserved' | 'cleaning'
  section TEXT DEFAULT 'Indoor',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_sessions (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  guest_count INTEGER DEFAULT 1,
  seated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'open', -- 'open' | 'bill_requested' | 'closed'
  notes TEXT,
  FOREIGN KEY (table_id) REFERENCES pos_tables(id)
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  reserved_for TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  table_id TEXT,
  table_name TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'pending' | 'confirmed' | 'arrived' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  special_requests TEXT DEFAULT '',
  source TEXT DEFAULT 'staff',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES pos_tables(id)
);

-- 5. Customers & CRM
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  address TEXT,
  notes TEXT,
  credit_limit REAL DEFAULT 15000.0,
  current_credit REAL DEFAULT 0.0,
  loyalty_points INTEGER DEFAULT 0,
  vip INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0.0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 6. Orders & Order Items
CREATE TABLE IF NOT EXISTS pos_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  table_name TEXT DEFAULT 'Takeaway',
  cashier_name TEXT NOT NULL,
  department TEXT DEFAULT 'Juice & Food',
  order_type TEXT DEFAULT 'dine_in', -- 'dine_in' | 'takeaway' | 'delivery'
  subtotal REAL NOT NULL DEFAULT 0.0,
  service_charge REAL DEFAULT 0.0,
  service_charge_rate REAL DEFAULT 0.1,
  discount REAL DEFAULT 0.0,
  tax REAL DEFAULT 0.0,
  total REAL NOT NULL DEFAULT 0.0,
  payment_method TEXT DEFAULT 'cash', -- 'cash' | 'card' | 'qr' | 'split'
  split_payments TEXT, -- JSON string array
  cash_received REAL DEFAULT 0.0,
  change_amount REAL DEFAULT 0.0,
  status TEXT DEFAULT 'paid', -- 'paid' | 'open' | 'completed' | 'refunded' | 'cancelled'
  payment_status TEXT DEFAULT 'paid',
  kitchen_status TEXT DEFAULT 'pending', -- 'pending' | 'preparing' | 'ready' | 'served'
  bar_status TEXT DEFAULT 'pending',     -- 'pending' | 'preparing' | 'ready' | 'served'
  customer_name TEXT DEFAULT 'Walk-in',
  customer_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total REAL NOT NULL,
  station TEXT DEFAULT 'kitchen',
  category TEXT,
  notes TEXT,
  item_status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS station_tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  ticket_number TEXT NOT NULL,
  station TEXT NOT NULL, -- 'kitchen' | 'bar'
  status TEXT DEFAULT 'pending', -- 'pending' | 'preparing' | 'ready' | 'completed'
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE
);

-- 7. Inventory & Ingredients
CREATE TABLE IF NOT EXISTS ingredient_categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT,
  current_stock REAL DEFAULT 0.0,
  base_unit TEXT NOT NULL, -- 'kg', 'L', 'pcs'
  reorder_level REAL DEFAULT 10.0,
  cost_per_unit REAL DEFAULT 0.0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ingredient_categories(id)
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity_required REAL NOT NULL,
  unit TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES pos_products(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

-- 8. Expenses & Financial Logs
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  recorded_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pos_orders_date ON pos_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_products_cat ON pos_products(category_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_barcode ON pos_products(barcode);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
