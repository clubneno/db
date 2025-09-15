-- Momentous Product Analyzer Database Schema
-- PostgreSQL Schema for production deployment

-- Main products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    handle VARCHAR(255) UNIQUE NOT NULL,
    price DECIMAL(10,2),
    subscription_price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    main_image TEXT,
    link TEXT,
    description TEXT,
    full_description TEXT,
    category VARCHAR(255),
    primary_goal VARCHAR(255),
    product_type VARCHAR(100),
    vendor VARCHAR(255),
    availability VARCHAR(100),
    tags_string TEXT,
    benefits TEXT,
    ingredients TEXT,
    usage TEXT,
    rating DECIMAL(3,2),
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- EU/Business specific fields
    eu_notification_status VARCHAR(100) DEFAULT 'Not started',
    eu_allowed VARCHAR(10) DEFAULT 'yes',
    hs_code VARCHAR(50),
    hs_code_description TEXT,
    duty_rate DECIMAL(5,2),
    size VARCHAR(100),
    servings INTEGER,
    intake_frequency VARCHAR(100),
    reorder_period INTEGER,
    nutraceuticals_regular_price DECIMAL(10,2),
    nutraceuticals_subscription_price DECIMAL(10,2),
    clubneno_regular_price DECIMAL(10,2),
    clubneno_subscription_price DECIMAL(10,2)
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_order INTEGER DEFAULT 0
);

-- Product categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product-category relationship
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(product_id, category_id)
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product-goal relationship
CREATE TABLE IF NOT EXISTS product_goals (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    UNIQUE(product_id, goal_id)
);

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    variant_id BIGINT UNIQUE NOT NULL,
    title VARCHAR(255),
    price DECIMAL(10,2),
    subscription_price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    available BOOLEAN DEFAULT true
);

-- Flavors table
CREATE TABLE IF NOT EXISTS flavors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product flavors with additional data
CREATE TABLE IF NOT EXISTS product_flavors (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    flavor_id INTEGER REFERENCES flavors(id) ON DELETE CASCADE,
    sku VARCHAR(255),
    hs_code VARCHAR(50),
    duty_rate DECIMAL(5,2),
    eu_notification_status VARCHAR(100) DEFAULT 'Not started',
    notes TEXT,
    external_link TEXT,
    ingredients TEXT,
    UNIQUE(product_id, flavor_id)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product-tag relationship
CREATE TABLE IF NOT EXISTS product_tags (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(product_id, tag_id)
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_scraped_at ON products(scraped_at);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_flavors_product_id ON product_flavors(product_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);