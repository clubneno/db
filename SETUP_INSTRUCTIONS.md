# Database Setup Instructions

## Step 1: Apply Database Schema

You need to apply the database schema directly in Supabase Dashboard:

1. Go to your Supabase Dashboard: https://app.supabase.com/project/baqdzabfkhtgnxzhoyax
2. Navigate to the SQL Editor (left sidebar)
3. Create a new query and paste the following SQL:

```sql
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_primary_goal ON products(primary_goal);
CREATE INDEX IF NOT EXISTS idx_products_eu_allowed ON products(eu_allowed);

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
```

4. Click "RUN" to execute the SQL

## Step 2: Run Migration Script

Once the tables are created, run the migration script:

```bash
SUPABASE_URL="https://baqdzabfkhtgnxzhoyax.supabase.co" SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWR6YWJma2h0Z254emhveWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxNjk4OSwiZXhwIjoyMDczNDkyOTg5fQ.SZmjBrkLRJ0jjNEiRUgXl2mLuTOqzU78t9abfojWixU" node migrate-products-only.js
```

## Current Issue

The database tables haven't been created yet, which is why the migration scripts are failing with "Could not find table" errors. You need to create the tables first using the SQL editor in Supabase Dashboard.