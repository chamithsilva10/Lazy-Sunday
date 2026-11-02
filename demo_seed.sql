-- ============================================================================
-- POS DEMO SQL SEED DATA
-- Pre-populates standalone SQLite / SQL database with rich mock data
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

-- 3. Categories
INSERT OR REPLACE INTO pos_categories (id, name, sort_order, is_active) VALUES
('cat-1', 'Specialty Coffee', 1, 1),
('cat-2', 'Artisan Teas', 2, 1),
('cat-3', 'Bakery & Pastries', 3, 1),
('cat-4', 'Breakfast & Brunch', 4, 1),
('cat-5', 'Gourmet Burgers', 5, 1),
('cat-6', 'Fresh Salads & Bowls', 6, 1),
('cat-7', 'Sides & Starters', 7, 1),
('cat-8', 'Cold Pressed Juices', 8, 1);

-- 4. Products
INSERT OR REPLACE INTO pos_products (id, name, sku, barcode, category_id, category_name, price, cost_price, stock, station, department, image, description, temperature, dietary_tags) VALUES
('prod-101', 'Espresso Single Origin', 'SKU-COF-001', '890100100001', 'cat-1', 'Specialty Coffee', 450, 120, 120, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Rich crema with notes of dark cocoa and citrus blossom.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-102', 'Double Ristretto', 'SKU-COF-002', '890100100002', 'cat-1', 'Specialty Coffee', 550, 150, 95, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Short extracted double shot offering intense sweet body.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-103', 'Velvet Flat White', 'SKU-COF-003', '890100100003', 'cat-1', 'Specialty Coffee', 750, 220, 80, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Silky micro-foam poured over a double ristretto shot.', 'hot', '["Vegetarian"]'),
('prod-104', 'Classic Cappuccino', 'SKU-COF-004', '890100100004', 'cat-1', 'Specialty Coffee', 750, 210, 110, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Balanced espresso, steamed milk, and dense foam with chocolate dust.', 'hot', '["Vegetarian"]'),
('prod-105', 'Salted Caramel Latte', 'SKU-COF-005', '890100100005', 'cat-1', 'Specialty Coffee', 900, 280, 65, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Espresso with steamed milk, house-made salted caramel syrup.', 'hot', '["Vegetarian"]'),
('prod-106', 'Iced Vanilla Bean Latte', 'SKU-COF-006', '890100100006', 'cat-1', 'Specialty Coffee', 950, 290, 75, 'bar', 'Coffee Bar', '/iced-tea.png', 'Madagascar vanilla, double shot espresso over crystal ice cubes.', 'cold', '["Vegetarian"]'),
('prod-107', 'Cold Brew Reserve (16hr Steep)', 'SKU-COF-007', '890100100007', 'cat-1', 'Specialty Coffee', 850, 200, 45, 'bar', 'Coffee Bar', '/iced-tea.png', 'Steeped slowly for 16 hours; crisp, low acidity, naturally sweet.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-108', 'Mocha Belgian Chocolate', 'SKU-COF-008', '890100100008', 'cat-1', 'Specialty Coffee', 1100, 350, 50, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Ghirardelli Belgian dark chocolate sauce with rich espresso & milk.', 'hot', '["Vegetarian"]'),
('prod-109', 'Ceremonial Matcha Latte', 'SKU-TEA-001', '890100100009', 'cat-2', 'Artisan Teas', 950, 320, 60, 'bar', 'Coffee Bar', '/iced-tea.png', 'Organic Uji Kyoto green tea whisked with oat milk.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-110', 'Highland Ceylon Black Tea', 'SKU-TEA-002', '890100100010', 'cat-2', 'Artisan Teas', 350, 70, 150, 'bar', 'Coffee Bar', '/iced-tea.png', 'Single-estate Nuwara Eliya whole leaf golden pekoe.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-113', 'French Almond Butter Croissant', 'SKU-BAK-001', '890100100013', 'cat-3', 'Bakery & Pastries', 750, 240, 35, 'kitchen', 'Juice & Food', '/apple-pie-slice.png', 'Flaky European cultured butter pastry loaded with almond frangipane.', 'none', '["Vegetarian"]'),
('prod-114', 'Belgian Chocolate Fudge Brownie', 'SKU-BAK-002', '890100100014', 'cat-3', 'Bakery & Pastries', 650, 180, 40, 'kitchen', 'Juice & Food', '/chocolate-brownie.png', 'Warm fudgy dark chocolate square dusted with sea salt flakes.', 'none', '["Vegetarian"]'),
('prod-115', 'New York Vanilla Cheesecake', 'SKU-BAK-003', '890100100015', 'cat-3', 'Bakery & Pastries', 850, 260, 25, 'kitchen', 'Juice & Food', '/cheesecake-slice.png', 'Creamy baked cheesecake with a buttery graham cracker crust.', 'none', '["Vegetarian"]'),
('prod-117', 'Avocado Toast with Poached Eggs', 'SKU-BRN-001', '890100100017', 'cat-4', 'Breakfast & Brunch', 1800, 520, 50, 'kitchen', 'Juice & Food', '/vibrant-mixed-salad.png', 'Smashed Hass avocado, two pasture-raised poached eggs, sourdough toast.', 'none', '["Vegetarian"]'),
('prod-118', 'Royal Eggs Benedict', 'SKU-BRN-002', '890100100018', 'cat-4', 'Breakfast & Brunch', 2100, 650, 45, 'kitchen', 'Juice & Food', '/vibrant-mixed-salad.png', 'English muffins, hickory smoked bacon, soft poached eggs, hollandaise.', 'none', '[]'),
('prod-119', 'Fluffy Buttermilk Pancake Stack', 'SKU-BRN-003', '890100100019', 'cat-4', 'Breakfast & Brunch', 1600, 400, 40, 'kitchen', 'Juice & Food', '/ice-cream-sundae.png', 'Triple stack pancakes, organic maple syrup, fresh berries, whipped butter.', 'none', '["Vegetarian"]'),
('prod-122', 'Prime Angus Cheeseburger', 'SKU-BGR-001', '890100100022', 'cat-5', 'Gourmet Burgers', 2400, 780, 65, 'kitchen', 'Juice & Food', '/classic-beef-burger.png', '200g prime Angus beef patty, aged cheddar, pickles, house relish on brioche.', 'none', '[]'),
('prod-123', 'Crispy Buttermilk Chicken Burger', 'SKU-BGR-002', '890100100023', 'cat-5', 'Gourmet Burgers', 2200, 680, 55, 'kitchen', 'Juice & Food', '/classic-beef-burger.png', 'Fried spiced chicken breast, creamy coleslaw, chipotle mayo, brioche.', 'none', '[]'),
('prod-125', 'Smoked Bacon & BBQ Stack', 'SKU-BGR-004', '890100100025', 'cat-5', 'Gourmet Burgers', 2600, 850, 45, 'kitchen', 'Juice & Food', '/classic-beef-burger.png', 'Angus beef, double crispy bacon, smoked cheddar, crispy onion rings, BBQ sauce.', 'none', '[]'),
('prod-126', 'Mediterranean Grilled Chicken Salad', 'SKU-SLD-001', '890100100026', 'cat-6', 'Fresh Salads & Bowls', 1950, 580, 40, 'kitchen', 'Juice & Food', '/vibrant-mixed-salad.png', 'Herb-marinated chicken breast, Kalamata olives, feta, cherry tomatoes, lemon vinaigrette.', 'none', '["Gluten-Free"]'),
('prod-127', 'Pacific Salmon Poke Bowl', 'SKU-SLD-002', '890100100027', 'cat-6', 'Fresh Salads & Bowls', 2600, 900, 35, 'kitchen', 'Juice & Food', '/vibrant-mixed-salad.png', 'Sashimi grade salmon cubes, edamame, sushi rice, wakame, sesame soy dressing.', 'none', '["Gluten-Free"]'),
('prod-129', 'Crispy Truffle Parmesan Fries', 'SKU-SID-001', '890100100029', 'cat-7', 'Sides & Starters', 1400, 350, 90, 'kitchen', 'Juice & Food', '/crispy-french-fries.png', 'Hand-cut Idaho russet potato fries tossed in white truffle oil & aged parmesan.', 'none', '["Vegetarian","Gluten-Free"]'),
('prod-130', 'Garlic Parmesan Chicken Wings', 'SKU-SID-002', '890100100030', 'cat-7', 'Sides & Starters', 1800, 580, 60, 'kitchen', 'Juice & Food', '/crispy-chicken-wings.png', 'Crispy fried jumbo wings tossed in roasted garlic butter and aged parmesan.', 'none', '["Gluten-Free"]'),
('prod-133', 'Green Cleanse Vitality Juice', 'SKU-JUC-001', '890100100033', 'cat-8', 'Cold Pressed Juices', 850, 220, 70, 'bar', 'Coffee Bar', '/glass-of-orange-juice.png', 'Cold-pressed green apple, celery, cucumber, kale, and fresh lime.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-134', 'Sunburst Orange & Ginger Press', 'SKU-JUC-002', '890100100034', 'cat-8', 'Cold Pressed Juices', 800, 200, 80, 'bar', 'Coffee Bar', '/glass-of-orange-juice.png', '100% freshly pressed Valencia oranges with a warming touch of ginger.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-135', 'Tropical Passionfruit Cooler', 'SKU-JUC-003', '890100100035', 'cat-8', 'Cold Pressed Juices', 850, 210, 65, 'bar', 'Coffee Bar', '/glass-of-orange-juice.png', 'Fresh passionfruit pulp, pineapple, mint leaves, sparkling spring water.', 'cold', '["Vegan","Gluten-Free"]');

-- 5. Tables
INSERT OR REPLACE INTO pos_tables (id, name, capacity, status, section) VALUES
('tbl-1', 'Table 1', 2, 'available', 'Indoor'),
('tbl-2', 'Table 2', 4, 'occupied', 'Indoor'),
('tbl-3', 'Table 3', 4, 'available', 'Indoor'),
('tbl-4', 'Table 4', 6, 'available', 'Indoor'),
('tbl-5', 'Table 5', 2, 'available', 'Indoor'),
('tbl-6', 'Table 6', 4, 'available', 'Indoor'),
('tbl-7', 'Terrace 1', 2, 'available', 'Terrace'),
('tbl-8', 'Terrace 2', 4, 'occupied', 'Terrace'),
('tbl-9', 'Terrace 3', 4, 'available', 'Terrace'),
('tbl-10', 'Terrace 4', 6, 'reserved', 'Terrace'),
('tbl-11', 'VIP Lounge', 8, 'available', 'VIP Lounge'),
('tbl-12', 'Bar Counter 1', 1, 'available', 'Bar'),
('tbl-13', 'Bar Counter 2', 1, 'available', 'Bar'),
('tbl-14', 'Bar Counter 3', 1, 'available', 'Bar');

-- 6. Customers
INSERT OR REPLACE INTO customers (id, name, phone, email, address, notes, credit_limit, current_credit, loyalty_points, vip, total_orders, total_spent) VALUES
('cust-1', 'Sarah Jenkins', '+94 77 123 4567', 'sarah.j@example.com', '12 Beach Road, Hiriketiya', 'Prefers oat milk in coffee.', 25000, 3500, 340, 1, 28, 42500),
('cust-2', 'David De Silva', '+94 71 987 6543', 'david.desilva@example.com', '45 Ocean View Lane, Dikwella', 'Enjoys prime angus burger and flat white.', 15000, 0, 180, 0, 14, 24600),
('cust-3', 'Elena Rostova', '+94 76 555 4321', 'elena.rostova@example.com', 'Villa 3, Coral Reef Grove', 'Remote worker, frequently books Terrace.', 30000, 8200, 520, 1, 41, 68900),
('cust-4', 'Liam O''Connor', '+94 70 333 7788', 'liam.oc@example.com', 'Sunset Point Road, Hiriketiya', 'Surf instructor, large groups for brunch.', 20000, 0, 210, 0, 19, 31200),
('cust-5', 'Ananya Patel', '+94 77 888 9911', 'ananya.p@example.com', '7 Temple View Crest', 'Strict vegetarian, loves Matcha and Acai.', 15000, 0, 290, 1, 22, 36400);

-- 7. Orders & Items
INSERT OR REPLACE INTO pos_orders (id, order_number, receipt_number, table_name, cashier_name, department, order_type, subtotal, service_charge, service_charge_rate, discount, tax, total, payment_method, cash_received, change_amount, status, payment_status, kitchen_status, bar_status, customer_name, customer_id, created_at) VALUES
('ord-mock-001', 'DEMO-1001', 'RC-DEMO-1001', 'Table 2', 'Alex Rivera', 'Juice & Food', 'dine_in', 7700, 770, 0.1, 0, 0, 8470, 'card', 8470, 0, 'paid', 'paid', 'served', 'served', 'David De Silva', 'cust-2', datetime('now', '-2 hours')),
('ord-mock-002', 'DEMO-1002', 'RC-DEMO-1002', 'Takeaway', 'Alex Rivera', 'Coffee Bar', 'takeaway', 1700, 0, 0, 0, 0, 1700, 'cash', 2000, 300, 'paid', 'paid', 'served', 'served', 'Walk-in Guest', NULL, datetime('now', '-1 hours')),
('ord-mock-003', 'DEMO-1003', 'RC-DEMO-1003', 'Terrace 2', 'Alex Rivera', 'Juice & Food', 'dine_in', 3600, 360, 0.1, 360, 0, 3600, 'split', 2000, 0, 'paid', 'paid', 'served', 'served', 'Elena Rostova', 'cust-3', datetime('now', '-30 minutes')),
('ord-mock-004', 'DEMO-1004', 'RC-DEMO-1004', 'Table 4', 'Alex Rivera', 'Juice & Food', 'dine_in', 10950, 1095, 0.1, 0, 0, 12045, 'card', 12045, 0, 'paid', 'paid', 'served', 'served', 'Liam O''Connor', 'cust-4', datetime('now', '-1 days')),
('ord-mock-005', 'DEMO-1005', 'RC-DEMO-1005', 'Takeaway', 'Elena Rostova', 'Coffee Bar', 'takeaway', 2200, 0, 0, 0, 0, 2200, 'qr', 2200, 0, 'paid', 'paid', 'served', 'served', 'Walk-in Guest', NULL, datetime('now', '-2 days'));

INSERT OR REPLACE INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, line_total, station, category) VALUES
('item-1', 'ord-mock-001', 'prod-122', 'Prime Angus Cheeseburger', 2400, 2, 4800, 'kitchen', 'Gourmet Burgers'),
('item-2', 'ord-mock-001', 'prod-129', 'Crispy Truffle Parmesan Fries', 1400, 1, 1400, 'kitchen', 'Sides & Starters'),
('item-3', 'ord-mock-001', 'prod-103', 'Velvet Flat White', 750, 2, 1500, 'bar', 'Specialty Coffee'),
('item-4', 'ord-mock-002', 'prod-106', 'Iced Vanilla Bean Latte', 950, 1, 950, 'bar', 'Specialty Coffee'),
('item-5', 'ord-mock-002', 'prod-113', 'French Almond Butter Croissant', 750, 1, 750, 'kitchen', 'Bakery & Pastries'),
('item-6', 'ord-mock-003', 'prod-117', 'Avocado Toast with Poached Eggs', 1800, 1, 1800, 'kitchen', 'Breakfast & Brunch'),
('item-7', 'ord-mock-003', 'prod-109', 'Ceremonial Matcha Latte', 950, 1, 950, 'bar', 'Artisan Teas'),
('item-8', 'ord-mock-003', 'prod-133', 'Green Cleanse Vitality Juice', 850, 1, 850, 'bar', 'Cold Pressed Juices');

-- 8. Station Tickets
INSERT OR REPLACE INTO station_tickets (id, order_id, ticket_number, station, status, notes) VALUES
('tkt-1', 'ord-mock-001', 'KOT-DEMO-1001', 'kitchen', 'completed', 'Table: Table 2'),
('tkt-2', 'ord-mock-001', 'BOT-DEMO-1001', 'bar', 'completed', 'Table: Table 2'),
('tkt-3', 'ord-mock-002', 'BOT-DEMO-1002', 'bar', 'completed', 'Takeaway'),
('tkt-4', 'ord-mock-003', 'KOT-DEMO-1003', 'kitchen', 'completed', 'Table: Terrace 2'),
('tkt-5', 'ord-mock-003', 'BOT-DEMO-1003', 'bar', 'completed', 'Table: Terrace 2');
