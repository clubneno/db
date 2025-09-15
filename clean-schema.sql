-- Clean database schema for Supabase (handles existing objects)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users full access to products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users full access to categories" ON categories;
DROP POLICY IF EXISTS "Allow authenticated users full access to goals" ON goals;
DROP POLICY IF EXISTS "Allow authenticated users full access to flavors" ON flavors;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    handle VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price VARCHAR(50),
    subscription_price VARCHAR(50),
    image VARCHAR(1000),
    link VARCHAR(1000),
    category VARCHAR(255),
    primary_goal VARCHAR(255),
    vendor VARCHAR(255),
    eu_allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    is_sub_category BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES goals(id),
    is_sub_goal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Flavors table
CREATE TABLE IF NOT EXISTS flavors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_primary_goal ON products(primary_goal);
CREATE INDEX IF NOT EXISTS idx_products_eu_allowed ON products(eu_allowed);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE flavors ENABLE ROW LEVEL SECURITY;

-- Create fresh policies
CREATE POLICY "Allow authenticated users full access to products" ON products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to categories" ON categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to goals" ON goals
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to flavors" ON flavors
    FOR ALL TO authenticated USING (true) WITH CHECK (true);