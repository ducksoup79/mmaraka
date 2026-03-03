-- =====================================================
-- MarketPlace Database Schema
-- =====================================================

DROP TABLE IF EXISTS advert_list CASCADE;
DROP TABLE IF EXISTS error_report CASCADE;
DROP TABLE IF EXISTS service_listing CASCADE;
DROP TABLE IF EXISTS service CASCADE;
DROP TABLE IF EXISTS product_listing CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS product_category CASCADE;
DROP TABLE IF EXISTS client CASCADE;
DROP TABLE IF EXISTS client_role CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS currency CASCADE;

-- CURRENCY
CREATE TABLE currency (
    currency_id        SERIAL PRIMARY KEY,
    currency_full_name VARCHAR(100) NOT NULL,
    currency_short     VARCHAR(10) NOT NULL
);

-- LOCATION
CREATE TABLE location (
    location_id     SERIAL PRIMARY KEY,
    location_name   VARCHAR(100) NOT NULL,
    currency_id     INT NOT NULL REFERENCES currency(currency_id),
    location_lat    DECIMAL(10, 7) NOT NULL,
    location_long   DECIMAL(10, 7) NOT NULL,
    location_radius DECIMAL(10, 3) NOT NULL  -- km radius from town centre
);

-- CLIENT ROLE
CREATE TABLE client_role (
    client_role_id   SERIAL PRIMARY KEY,
    client_role      VARCHAR(50) NOT NULL,
    sub_price        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    listing_priority INT NOT NULL DEFAULT 0
);

-- CLIENT
CREATE TABLE client (
    client_id               SERIAL PRIMARY KEY,
    username                VARCHAR(50) UNIQUE NOT NULL,
    first_name              VARCHAR(100),
    last_name               VARCHAR(100),
    password_hash           VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    whatsapp                VARCHAR(30),
    country_code            VARCHAR(10) DEFAULT '+267',
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    join_date               TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login              TIMESTAMP,
    location_id             INT REFERENCES location(location_id),
    client_role_id          INT NOT NULL REFERENCES client_role(client_role_id),
    client_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin                BOOLEAN NOT NULL DEFAULT FALSE,
    verify_token            VARCHAR(255),
    verify_token_expiry     TIMESTAMP,
    reset_token             VARCHAR(255),
    reset_token_expiry      TIMESTAMP,
    refresh_token           VARCHAR(500),
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PRODUCT CATEGORY
CREATE TABLE product_category (
    category_id   SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    -- legacy column name used in some queries
    product_category VARCHAR(100) GENERATED ALWAYS AS (category_name) STORED
);

-- PRODUCT
CREATE TABLE product (
    product_id          SERIAL PRIMARY KEY,
    product_name        VARCHAR(150),
    product_description TEXT,
    product_image_path  VARCHAR(500),
    product_price       DECIMAL(10, 2) NOT NULL,
    category_id         INT NOT NULL REFERENCES product_category(category_id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PRODUCT LISTING
CREATE TABLE product_listing (
    listing_id              SERIAL PRIMARY KEY,
    product_id              INT NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    client_id               INT NOT NULL REFERENCES client(client_id),
    buyer_id                INT REFERENCES client(client_id),
    status                  VARCHAR(20) NOT NULL DEFAULT 'avail'
                                CHECK (status IN ('avail','sold','dormant')),
    listing_date            TIMESTAMP NOT NULL DEFAULT NOW(),
    listing_expires_at      TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
    product_position        INT NOT NULL DEFAULT 200,
    listing_reinstate_count INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SERVICE
CREATE TABLE service (
    service_id          SERIAL PRIMARY KEY,
    client_id           INT NOT NULL REFERENCES client(client_id),
    service_logo_path   VARCHAR(500),
    service_name        VARCHAR(150) NOT NULL,
    service_description TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SERVICE LISTING
CREATE TABLE service_listing (
    service_listing_id       SERIAL PRIMARY KEY,
    service_id               INT NOT NULL REFERENCES service(service_id) ON DELETE CASCADE,
    service_position         INT NOT NULL DEFAULT 200,
    service_status           BOOLEAN NOT NULL DEFAULT TRUE,
    service_listing_date     TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ADVERT LIST (Diamond tier rotating banner ads)
CREATE TABLE advert_list (
    advert_list_id SERIAL PRIMARY KEY,
    service_id     INT NOT NULL REFERENCES service(service_id) ON DELETE CASCADE,
    service_clicks INT NOT NULL DEFAULT 0,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ERROR REPORTS
CREATE TABLE error_report (
    report_id   SERIAL PRIMARY KEY,
    client_id   INT REFERENCES client(client_id),
    subject     VARCHAR(255),
    description TEXT NOT NULL,
    resolved    BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_product_listing_status   ON product_listing(status);
CREATE INDEX idx_product_listing_client   ON product_listing(client_id);
CREATE INDEX idx_product_listing_expires  ON product_listing(listing_expires_at);
CREATE INDEX idx_service_listing_status   ON service_listing(service_status);
CREATE INDEX idx_client_email             ON client(email);
CREATE INDEX idx_client_username          ON client(username);
