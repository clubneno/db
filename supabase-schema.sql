-- Supabase schema for Clubneno Product Database

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    handle VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    full_description TEXT,
    price VARCHAR(50),
    subscription_price VARCHAR(50),
    original_price VARCHAR(50),
    image VARCHAR(1000),
    images JSONB,
    link VARCHAR(1000),
    category VARCHAR(255),
    primary_goal VARCHAR(255),
    product_type VARCHAR(255),
    vendor VARCHAR(255),
    availability VARCHAR(255),
    tags_string TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    variants JSONB,
    
    -- Custom fields
    categories JSONB DEFAULT '[]',
    goals JSONB DEFAULT '[]',
    flavors JSONB DEFAULT '[]',
    eu_notification_status VARCHAR(255),
    skus JSONB DEFAULT '[]',
    hs_code VARCHAR(255),
    hs_code_description TEXT,
    duty_rate VARCHAR(255),
    product_name VARCHAR(500),
    eu_allowed BOOLEAN DEFAULT false,
    size VARCHAR(255),
    servings VARCHAR(255),
    intake_frequency VARCHAR(255),
    reorder_period VARCHAR(255),
    nutraceuticals_regular_price VARCHAR(50),
    nutraceuticals_subscription_price VARCHAR(50),
    clubneno_regular_price VARCHAR(50),
    clubneno_subscription_price VARCHAR(50),
    flavor_skus JSONB DEFAULT '[]',
    flavor_hs_codes JSONB DEFAULT '[]',
    flavor_duty_rates JSONB DEFAULT '[]',
    flavor_eu_notifications JSONB DEFAULT '[]',
    flavor_notes JSONB DEFAULT '[]',
    flavor_links JSONB DEFAULT '[]',
    flavor_ingredients JSONB DEFAULT '[]',
    
    -- Timestamps
    db_created_at TIMESTAMP DEFAULT NOW(),
    db_updated_at TIMESTAMP DEFAULT NOW()
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_primary_goal ON products(primary_goal);
CREATE INDEX IF NOT EXISTS idx_products_eu_allowed ON products(eu_allowed);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_goals_name ON goals(name);
CREATE INDEX IF NOT EXISTS idx_flavors_name ON flavors(name);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.db_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE flavors ENABLE ROW LEVEL SECURITY;

-- Policies to allow authenticated users to read and write
CREATE POLICY "Allow authenticated users full access to products" ON products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to categories" ON categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to goals" ON goals
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to flavors" ON flavors
    FOR ALL TO authenticated USING (true) WITH CHECK (true);