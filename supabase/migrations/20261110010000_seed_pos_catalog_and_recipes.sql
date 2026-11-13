-- ============================================================================
-- POS CATALOG & RECIPE SEEDING MIGRATION
-- Populates authoritative products, categories, ingredients, and recipe items
-- ============================================================================

-- 1. Ensure Categories
INSERT INTO public.pos_categories (id, name, sort_order, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Specialty Coffee', 1, true),
  ('a1000000-0000-0000-0000-000000000002', 'Artisan Teas', 2, true),
  ('a1000000-0000-0000-0000-000000000003', 'Bakery & Pastries', 3, true),
  ('a1000000-0000-0000-0000-000000000004', 'Breakfast & Brunch', 4, true),
  ('a1000000-0000-0000-0000-000000000005', 'Gourmet Burgers', 5, true),
  ('a1000000-0000-0000-0000-000000000006', 'Fresh Salads & Bowls', 6, true),
  ('a1000000-0000-0000-0000-000000000007', 'Sides & Starters', 7, true),
  ('a1000000-0000-0000-0000-000000000008', 'Cold Pressed Juices', 8, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 2. Baseline Ingredients
INSERT INTO public.ingredients (
  id, sku, name, dimension, base_unit, default_purchase_unit,
  current_stock_base, par_level_base, reorder_level_base, reorder_qty_base,
  is_perishable, is_active, is_archived, version
) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'ING-BEA-01', 'Single Origin Arabica Beans', 'weight', 'g', 'kg', 45000, 50000, 10000, 20000, false, true, false, 1),
  ('b1000000-0000-0000-0000-000000000002', 'ING-MLK-01', 'Fresh Farm Dairy Milk', 'volume', 'ml', 'L', 62000, 80000, 20000, 40000, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000003', 'ING-OAT-01', 'Barista Edition Oat Milk', 'volume', 'ml', 'L', 34000, 40000, 12000, 20000, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000004', 'ING-BEEF-01', 'Prime Angus Beef Mince', 'weight', 'g', 'kg', 28000, 40000, 8000, 15000, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000005', 'ING-CHK-01', 'Free Range Chicken Breast', 'weight', 'g', 'kg', 35000, 40000, 10000, 20000, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000006', 'ING-AVO-01', 'Fresh Hass Avocado', 'weight', 'g', 'kg', 24500, 30000, 6000, 12000, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000007', 'ING-POT-01', 'Idaho Russet Potatoes', 'weight', 'g', 'kg', 80000, 100000, 25000, 50000, false, true, false, 1),
  ('b1000000-0000-0000-0000-000000000008', 'ING-EGG-01', 'Pasture Raised Free Range Eggs', 'count', 'pcs', 'pcs', 240, 300, 60, 120, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000009', 'ING-BUN-01', 'Artisan Brioche Burger Buns', 'count', 'pcs', 'pcs', 95, 120, 30, 60, true, true, false, 1),
  ('b1000000-0000-0000-0000-000000000010', 'ING-CHD-01', 'Aged Cheddar Cheese Blocks', 'weight', 'g', 'kg', 16000, 20000, 5000, 10000, true, true, false, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  current_stock_base = EXCLUDED.current_stock_base,
  reorder_level_base = EXCLUDED.reorder_level_base;

-- 3. Products (Authoritative Catalog)
INSERT INTO public.pos_products (
  id, name, sku, price, cost, stock, category_id, station, department_override,
  image, description, temperature, dietary_tags, active, track_stock, is_archived, sort_order
) VALUES
  -- Coffee (Bar)
  ('c1000000-0000-0000-0000-000000000001', 'Espresso Single Origin', 'SKU-COF-001', 450, 120, 120, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/latte-coffee.png', 'Rich crema with notes of dark cocoa and citrus blossom.', 'hot', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 1),
  ('c1000000-0000-0000-0000-000000000002', 'Double Ristretto', 'SKU-COF-002', 550, 150, 95, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/latte-coffee.png', 'Short extracted double shot offering intense sweet body.', 'hot', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 2),
  ('c1000000-0000-0000-0000-000000000003', 'Velvet Flat White', 'SKU-COF-003', 750, 220, 80, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/latte-coffee.png', 'Silky micro-foam poured over a double ristretto shot.', 'hot', ARRAY['Vegetarian'], true, true, false, 3),
  ('c1000000-0000-0000-0000-000000000004', 'Classic Cappuccino', 'SKU-COF-004', 750, 210, 110, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/latte-coffee.png', 'Balanced espresso, steamed milk, and dense foam with chocolate dust.', 'hot', ARRAY['Vegetarian'], true, true, false, 4),
  ('c1000000-0000-0000-0000-000000000005', 'Salted Caramel Latte', 'SKU-COF-005', 900, 280, 65, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/latte-coffee.png', 'Espresso with steamed milk, house-made salted caramel syrup.', 'hot', ARRAY['Vegetarian'], true, true, false, 5),
  ('c1000000-0000-0000-0000-000000000006', 'Iced Vanilla Bean Latte', 'SKU-COF-006', 950, 290, 75, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/iced-tea.png', 'Madagascar vanilla, double shot espresso over crystal ice cubes.', 'cold', ARRAY['Vegetarian'], true, true, false, 6),
  ('c1000000-0000-0000-0000-000000000007', 'Cold Brew Reserve', 'SKU-COF-007', 850, 200, 45, 'a1000000-0000-0000-0000-000000000001', 'bar', 'Coffee Bar', '/iced-tea.png', 'Steeped slowly for 16 hours; crisp, low acidity, naturally sweet.', 'cold', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 7),

  -- Teas (Bar)
  ('c1000000-0000-0000-0000-000000000008', 'Ceremonial Matcha Latte', 'SKU-TEA-001', 950, 320, 60, 'a1000000-0000-0000-0000-000000000002', 'bar', 'Coffee Bar', '/iced-tea.png', 'Organic Uji Kyoto green tea whisked with oat milk.', 'hot', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 8),
  ('c1000000-0000-0000-0000-000000000009', 'Highland Ceylon Black Tea', 'SKU-TEA-002', 350, 70, 150, 'a1000000-0000-0000-0000-000000000002', 'bar', 'Coffee Bar', '/iced-tea.png', 'Single-estate Nuwara Eliya whole leaf golden pekoe.', 'hot', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 9),

  -- Bakery & Pastries (Kitchen)
  ('c1000000-0000-0000-0000-000000000010', 'French Almond Butter Croissant', 'SKU-BAK-001', 550, 140, 45, 'a1000000-0000-0000-0000-000000000003', 'kitchen', 'Juice & Food', '/apple-pie-slice.png', 'Flaky butter pastry layered with almond cream & toasted flakes.', 'none', ARRAY['Vegetarian'], true, true, false, 10),
  ('c1000000-0000-0000-0000-000000000011', 'Belgian Chocolate Fudge Brownie', 'SKU-BAK-002', 650, 180, 40, 'a1000000-0000-0000-0000-000000000003', 'kitchen', 'Juice & Food', '/chocolate-brownie.png', 'Warm fudgy dark chocolate square dusted with sea salt flakes.', 'none', ARRAY['Vegetarian'], true, true, false, 11),

  -- Breakfast & Brunch (Kitchen)
  ('c1000000-0000-0000-0000-000000000012', 'Avocado Toast with Poached Eggs', 'SKU-BRN-001', 1800, 520, 50, 'a1000000-0000-0000-0000-000000000004', 'kitchen', 'Juice & Food', '/vibrant-mixed-salad.png', 'Smashed Hass avocado, two pasture-raised poached eggs, sourdough toast.', 'none', ARRAY['Vegetarian'], true, true, false, 12),
  ('c1000000-0000-0000-0000-000000000013', 'Amazonian Acai Super Bowl', 'SKU-BRN-002', 1900, 580, 35, 'a1000000-0000-0000-0000-000000000004', 'kitchen', 'Juice & Food', '/ice-cream-sundae.png', 'Pure organic acai blend topped with chia seeds, banana, house granola.', 'none', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 13),

  -- Gourmet Burgers (Kitchen)
  ('c1000000-0000-0000-0000-000000000014', 'Prime Angus Cheeseburger', 'SKU-BGR-001', 2400, 780, 65, 'a1000000-0000-0000-0000-000000000005', 'kitchen', 'Juice & Food', '/classic-beef-burger.png', '200g prime Angus beef patty, aged cheddar, pickles, house relish on brioche.', 'none', ARRAY[]::text[], true, true, false, 14),
  ('c1000000-0000-0000-0000-000000000015', 'Crispy Buttermilk Chicken Burger', 'SKU-BGR-002', 2200, 680, 55, 'a1000000-0000-0000-0000-000000000005', 'kitchen', 'Juice & Food', '/classic-beef-burger.png', 'Fried spiced chicken breast, creamy coleslaw, chipotle mayo, brioche.', 'none', ARRAY[]::text[], true, true, false, 15),

  -- Sides & Starters (Kitchen)
  ('c1000000-0000-0000-0000-000000000016', 'Crispy Truffle Parmesan Fries', 'SKU-SID-001', 1400, 350, 90, 'a1000000-0000-0000-0000-000000000007', 'kitchen', 'Juice & Food', '/crispy-french-fries.png', 'Hand-cut Idaho russet potato fries tossed in white truffle oil & aged parmesan.', 'none', ARRAY['Vegetarian', 'Gluten-Free'], true, true, false, 16),
  ('c1000000-0000-0000-0000-000000000017', 'Artisan Mozzarella Sticks', 'SKU-SID-002', 1300, 360, 50, 'a1000000-0000-0000-0000-000000000007', 'kitchen', 'Juice & Food', '/crispy-french-fries.png', 'Herb-crusted melted mozzarella served with warm marinara dipping sauce.', 'none', ARRAY['Vegetarian'], true, true, false, 17),

  -- Cold Pressed Juices (Bar)
  ('c1000000-0000-0000-0000-000000000018', 'Sunburst Orange & Ginger Press', 'SKU-JUC-001', 800, 200, 80, 'a1000000-0000-0000-0000-000000000008', 'bar', 'Coffee Bar', '/glass-of-orange-juice.png', '100% freshly pressed Valencia oranges with a warming touch of ginger.', 'cold', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 18),
  ('c1000000-0000-0000-0000-000000000019', 'Tropical Passionfruit Cooler', 'SKU-JUC-002', 850, 210, 65, 'a1000000-0000-0000-0000-000000000008', 'bar', 'Coffee Bar', '/glass-of-orange-juice.png', 'Fresh passionfruit pulp, pineapple, mint leaves, sparkling spring water.', 'cold', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 19),
  ('c1000000-0000-0000-0000-000000000020', 'Pure Sparkling Mineral Water', 'SKU-JUC-003', 400, 90, 120, 'a1000000-0000-0000-0000-000000000008', 'bar', 'Coffee Bar', '/bottled-water.png', 'Natural carbonated mineral spring water in glass bottle 500ml.', 'cold', ARRAY['Vegan', 'Gluten-Free'], true, true, false, 20)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  cost = EXCLUDED.cost,
  stock = EXCLUDED.stock,
  station = EXCLUDED.station,
  category_id = EXCLUDED.category_id,
  image = EXCLUDED.image,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  track_stock = EXCLUDED.track_stock,
  is_archived = false;

-- 4. Recipe Linkages
-- Links products to their raw ingredient bill of materials
INSERT INTO public.recipe_items (id, product_id, ingredient_id, quantity_base)
VALUES
  -- Espresso Single: 18g beans
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 18),
  -- Double Ristretto: 36g beans
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 36),
  -- Flat White: 18g beans, 180ml milk
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 18),
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 180),
  -- Classic Cappuccino: 18g beans, 180ml milk
  ('d1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 18),
  ('d1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 180),
  -- Prime Angus Cheeseburger: 200g beef, 1 bun, 40g cheddar
  ('d1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000004', 200),
  ('d1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000009', 1),
  ('d1000000-0000-0000-0000-000000000009', 'c1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000010', 40),
  -- Avocado Toast: 150g avocado, 2 eggs
  ('d1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000006', 150),
  ('d1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000008', 2),
  -- Truffle Parmesan Fries: 300g potatoes
  ('d1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000007', 300)
ON CONFLICT (id) DO UPDATE SET
  quantity_base = EXCLUDED.quantity_base;
