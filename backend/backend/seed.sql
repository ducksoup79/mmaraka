-- =====================================================
-- MarketPlace Seed Data
-- =====================================================

-- CURRENCIES
INSERT INTO currency (currency_full_name, currency_short) VALUES
    ('Botswana Pula',        'BWP'),
    ('South African Rand',   'ZAR');

-- LOCATIONS (Botswana, currency_id=1)
INSERT INTO location (location_name, currency_id, location_lat, location_long, location_radius) VALUES
    ('Maun',        1, -19.9833300,  23.4166700, 15.0),
    ('Kasane',      1, -17.8000000,  25.1500000, 10.0),
    ('Gaborone',    1, -24.6541700,  25.9086100, 25.0),
    ('Francistown', 1, -21.1661100,  27.5158300, 20.0);

-- CLIENT ROLES  (listing_priority: Diamond=3 highest, Basic=1 lowest)
INSERT INTO client_role (client_role, sub_price, listing_priority) VALUES
    ('Basic',   0.00,   1),
    ('Silver',  50.00,  2),
    ('Diamond', 100.00, 3),
    ('Admin',   0.00,   0);

-- PRODUCT CATEGORIES (12)
INSERT INTO product_category (category_name) VALUES
    ('Vehicles'),
    ('Electronics'),
    ('Appliances'),
    ('Furniture'),
    ('Clothing & Accessories'),
    ('Books & Stationery'),
    ('Sports & Outdoors'),
    ('Kitchen & Dining'),
    ('Building & Hardware'),
    ('Toys & Games'),
    ('Garden & Outdoor'),
    ('Boats & Watercraft');

-- ADMIN ACCOUNT (password set by setup.js)
INSERT INTO client (
    username, password_hash, email,
    active, client_verified, client_role_id, is_admin, country_code
) VALUES (
    'admin',
    '$ADMIN_PASSWORD_HASH$',
    'admin@marketplace.com',
    TRUE, TRUE,
    (SELECT client_role_id FROM client_role WHERE client_role = 'Admin'),
    TRUE,
    '+267'
);
