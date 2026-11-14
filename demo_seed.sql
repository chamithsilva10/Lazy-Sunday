-- ============================================================================
-- POS DEMO SQL SEED DATA - LAZY SUNDAY PURE 41-ITEM MENU
-- Pre-populates SQLite database with 13 categories and 41 products
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

-- 3. Categories (13 total)
INSERT OR REPLACE INTO pos_categories (id, name, sort_order, is_active) VALUES
('cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 1, 1),
('cat-cold-drinks', 'Cold Drinks', 2, 1),
('cat-meals', 'Meals', 3, 1),
('cat-salads', 'Salads', 4, 1),
('cat-bakery-desserts', 'Bakery & Desserts', 5, 1);

-- 4. Products (41 total: 26 Bar, 15 Kitchen)
INSERT OR REPLACE INTO pos_products (id, name, sku, barcode, category_id, category_name, price, cost_price, stock, station, department, image, description, temperature, dietary_tags) VALUES
('prod-101', 'Ristretto', 'LS-BAR-001', '890100100001', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 500, 120, 100, 'bar', 'Coffee Bar', '/uploads/prod_1794637814975_5gmi8.jpg', 'Short, concentrated espresso extraction with a sweet, rich profile.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-102', 'Espresso', 'LS-BAR-002', '890100100002', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 500, 120, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80', 'Full-bodied single origin espresso shot with thick golden crema.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-103', 'Long Black', 'LS-BAR-003', '890100100003', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 650, 140, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=600&q=80', 'Double shot espresso poured over hot or iced mineral water.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-104', 'Flat White', 'LS-BAR-004', '890100100004', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 750, 180, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=600&q=80', 'Velvety textured micro-foam over a double ristretto shot.', 'hot', '["Vegetarian"]'),
('prod-105', 'Cappuccino', 'LS-BAR-005', '890100100005', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 750, 180, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=600&q=80', 'Harmonious balance of espresso, steamed milk, and airy foam.', 'hot', '["Vegetarian"]'),
('prod-106', 'Latte', 'LS-BAR-006', '890100100006', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 800, 190, 100, 'bar', 'Coffee Bar', '/latte-coffee.png', 'Smooth espresso with gently steamed milk and a light foam cap.', 'hot', '["Vegetarian"]'),
('prod-107', 'Mocha', 'LS-BAR-007', '890100100007', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 950, 240, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=600&q=80', 'Espresso blended with artisanal dark chocolate and steamed milk.', 'hot', '["Vegetarian"]'),
('prod-108', 'V60 Pour Over', 'LS-BAR-008', '890100100008', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 1100, 280, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80', 'Single-origin pour over filter brew showcasing delicate florals and fruit notes.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-109', 'Matcha Latte', 'LS-BAR-009', '890100100009', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 950, 260, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', 'Ceremonial grade Japanese green tea whisked with silky steamed milk.', 'hot', '["Vegetarian"]'),
('prod-110', 'Chocolate', 'LS-BAR-010', '890100100010', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 900, 220, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=600&q=80', 'Rich melted cocoa crafted into decadent hot chocolate or iced chocolate.', 'hot', '["Vegetarian"]'),
('prod-111', 'Ceylon Breakfast', 'LS-BAR-011', '890100100011', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 400, 80, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80', 'High-grown Nuwara Eliya whole leaf black tea with robust malty character.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-112', 'Green Tea', 'LS-BAR-012', '890100100012', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 450, 90, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=600&q=80', 'Clean, fresh steamed whole-leaf green tea rich in antioxidants.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-113', 'Ginger & Lemongrass', 'LS-BAR-013', '890100100013', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 450, 90, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80', 'Soothing natural herbal infusion of sun-dried lemongrass stalks and spicy ginger.', 'hot', '["Vegan","Gluten-Free"]'),
('prod-114', 'Chai', 'LS-BAR-014', '890100100014', 'cat-coffee-hot-drinks', 'Coffee & Hot Drinks', 650, 160, 100, 'bar', 'Coffee Bar', 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=600&q=80', 'Aromatic black tea brewed with crushed cardamoms, cinnamon, cloves, and milk.', 'hot', '["Vegetarian"]'),
('prod-115', 'Mango Matcha', 'LS-BAR-015', '890100100015', 'cat-cold-drinks', 'Cold Drinks', 1050, 300, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', 'Chilled tropical mango puree layered with iced ceremonial matcha.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-116', 'King Coconut', 'LS-BAR-016', '890100100016', 'cat-cold-drinks', 'Cold Drinks', 450, 100, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80', 'Naturally sweet, isotonic fresh Sri Lankan thambili water served chilled.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-117', 'House Lime Soda', 'LS-BAR-017', '890100100017', 'cat-cold-drinks', 'Cold Drinks', 650, 120, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', 'Freshly squeezed garden lime with bubbly soda water and pure cane syrup.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-118', 'House Pineapple & Mint Soda', 'LS-BAR-018', '890100100018', 'cat-cold-drinks', 'Cold Drinks', 750, 160, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80', 'Crushed sweet pineapple and muddled garden mint topped with sparkling soda.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-119', 'Passion Soda', 'LS-BAR-019', '890100100019', 'cat-cold-drinks', 'Cold Drinks', 750, 160, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', 'Tangy tropical passionfruit pulp, lime, and crisp sparkling soda.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-120', 'Mango Smoothie', 'LS-BAR-020', '890100100020', 'cat-cold-drinks', 'Cold Drinks', 950, 250, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80', 'Thick, creamy blend of ripe tropical mangoes, banana, and chilled coconut milk.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-121', 'Peanut Butter Shake', 'LS-BAR-021', '890100100021', 'cat-cold-drinks', 'Cold Drinks', 1100, 320, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', 'Roasted artisanal peanut butter, banana, dairy milk, and dark honey.', 'cold', '["Vegetarian"]'),
('prod-122', 'Pani Dodang & Sea Salt', 'LS-BAR-022', '890100100022', 'cat-cold-drinks', 'Cold Drinks', 750, 200, 100, 'bar', 'Bar & Beverages', '/glass-of-orange-juice.png', 'Indigenous sweet orange infused with a subtle touch of natural sea salt.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-123', 'Ginger Lemonade', 'LS-BAR-023', '890100100023', 'cat-cold-drinks', 'Cold Drinks', 750, 200, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80', 'Fiery organic Sri Lankan ginger balanced with zesty lemon and sparkling spring water.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-124', 'Peach & Mango Iced Tea', 'LS-BAR-024', '890100100024', 'cat-cold-drinks', 'Cold Drinks', 800, 220, 100, 'bar', 'Bar & Beverages', '/iced-tea.png', 'Cold brewed Ceylon black tea with natural orchard peach and luscious mango.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-125', 'Salted Coconut & Lime Sparkling', 'LS-BAR-025', '890100100025', 'cat-cold-drinks', 'Cold Drinks', 800, 220, 100, 'bar', 'Bar & Beverages', 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=600&q=80', 'Refreshing sparkling king coconut nectar with tangy lime and pinch of sea salt.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-126', 'Sparkling Water', 'LS-BAR-026', '890100100026', 'cat-cold-drinks', 'Cold Drinks', 500, 110, 100, 'bar', 'Bar & Beverages', '/bottled-water.png', 'Pure chilled carbonated mineral spring water with crisp effervescence.', 'cold', '["Vegan","Gluten-Free"]'),
('prod-127', 'Creamy Mushrooms', 'LS-KIT-027', '890100100027', 'cat-meals', 'Meals', 1800, 450, 100, 'kitchen', 'Kitchen Meals', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', 'Sautéed button & oyster mushrooms in garlic herb cream, served with Sourdough or Hashbrowns.', 'none', '["Vegetarian"]'),
('prod-128', 'Bacon and Eggs', 'LS-KIT-028', '890100100028', 'cat-meals', 'Meals', 1900, 500, 100, 'kitchen', 'Kitchen Meals', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80', 'Crispy smoked bacon with two eggs (Scrambled / Fried) and choice of Sourdough or Hashbrowns.', 'none', '[]'),
('prod-129', 'Sri Lankan Chili Scramble', 'LS-KIT-029', '890100100029', 'cat-meals', 'Meals', 1750, 420, 100, 'kitchen', 'Kitchen Meals', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80', 'Soft eggs scrambled with green chilies, shallots, curry leaves, and toasted sourdough.', 'none', '["Vegetarian"]'),
('prod-130', 'Pancakes', 'LS-KIT-030', '890100100030', 'cat-meals', 'Meals', 1600, 380, 100, 'kitchen', 'Kitchen Meals', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80', 'Golden buttermilk pancake stack served with fresh tropical fruit, whipped butter, and kithul treacle.', 'none', '["Vegetarian"]'),
('prod-131', 'Grilled Chicken Sandwich', 'LS-KIT-031', '890100100031', 'cat-meals', 'Meals', 1950, 520, 100, 'kitchen', 'Kitchen Meals', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', 'Herb-marinated chicken breast, garlic aioli, tomato, and baby greens on sourdough with Fries or Salad.', 'none', '[]'),
('prod-132', 'Hashbrown-Crust Bacon & Egg Quiche', 'LS-KIT-032', '890100100032', 'cat-meals', 'Meals', 1850, 480, 100, 'kitchen', 'Kitchen Meals', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', 'Golden shredded potato crust filled with savory smoked bacon, eggs, and aged cheddar with Fries or Salad.', 'none', '[]'),
('prod-133', 'Roast Vegetable Salad', 'LS-KIT-033', '890100100033', 'cat-salads', 'Salads', 1750, 420, 100, 'kitchen', 'Kitchen Salads', '/vibrant-mixed-salad.png', 'Oven-roasted pumpkin, sweet potato, bell peppers, mixed greens, toasted pumpkin seeds, and balsamic glaze.', 'none', '["Vegan","Gluten-Free"]'),
('prod-134', 'Pesto Pasta Salad', 'LS-KIT-034', '890100100034', 'cat-salads', 'Salads', 1850, 460, 100, 'kitchen', 'Kitchen Salads', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', 'Fusilli pasta tossed in fresh basil cashew pesto, cherry tomatoes, baby spinach, and parmesan shavings.', 'none', '["Vegetarian"]'),
('prod-135', 'Chickpea Salad', 'LS-KIT-035', '890100100035', 'cat-salads', 'Salads', 1650, 380, 100, 'kitchen', 'Kitchen Salads', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80', 'Crisp cucumbers, spiced chickpeas, Kalamata olives, fresh herbs, and zesty lemon tahini dressing.', 'none', '["Vegan","Gluten-Free"]'),
('prod-136', 'Savoury Muffin', 'LS-KIT-036', '890100100036', 'cat-bakery-desserts', 'Bakery & Desserts', 650, 160, 100, 'kitchen', 'Bakery & Desserts', 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80', 'Freshly baked savory muffin loaded with baby spinach, sweet corn, and crumbled feta cheese.', 'none', '["Vegetarian"]'),
('prod-137', 'Banana Chocolate Chip Muffin', 'LS-KIT-037', '890100100037', 'cat-bakery-desserts', 'Bakery & Desserts', 600, 150, 100, 'kitchen', 'Bakery & Desserts', 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80', 'Moist ripe banana muffin baked with dark Belgian chocolate chips and cinnamon crumble.', 'none', '["Vegetarian"]'),
('prod-138', 'Sweet Scone with Tropical Jam & Cream', 'LS-KIT-038', '890100100038', 'cat-bakery-desserts', 'Bakery & Desserts', 650, 160, 100, 'kitchen', 'Bakery & Desserts', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 'Traditional butter scone served warm with house-made tropical passion-mango jam and clotted cream.', 'none', '["Vegetarian"]'),
('prod-139', 'Cheese Scone with Karipincha Butter', 'LS-KIT-039', '890100100039', 'cat-bakery-desserts', 'Bakery & Desserts', 650, 160, 100, 'kitchen', 'Bakery & Desserts', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 'Golden sharp cheddar cheese scone served with fragrant house-whipped curry leaf (karipincha) butter.', 'none', '["Vegetarian"]'),
('prod-140', 'Oaty Ginger Slice', 'LS-KIT-040', '890100100040', 'cat-bakery-desserts', 'Bakery & Desserts', 750, 180, 100, 'kitchen', 'Bakery & Desserts', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 'Toasted rolled oats and golden syrup slice topped with spicy candied ginger icing.', 'none', '["Vegetarian"]'),
('prod-141', 'Chocolate Brownie with Ice Cream', 'LS-KIT-041', '890100100041', 'cat-bakery-desserts', 'Bakery & Desserts', 850, 220, 100, 'kitchen', 'Bakery & Desserts', '/chocolate-brownie.png', 'Warm fudgy dark chocolate brownie dusted with cocoa, paired with a scoop of vanilla bean ice cream.', 'none', '["Vegetarian"]');

-- 5. Tables
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

-- 6. Clean Orders & Items (Clean State - 0 initial orders)
DELETE FROM order_items;
DELETE FROM station_tickets;
DELETE FROM pos_orders;
