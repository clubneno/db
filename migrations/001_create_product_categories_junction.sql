-- Migration: Create product_categories junction table for many-to-many relationship
-- Run this in your Supabase SQL Editor

-- Create junction table for many-to-many relationship between products and categories
CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, category_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);

-- Optional: Enable RLS (Row Level Security) if needed
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (adjust as needed)
CREATE POLICY "Allow all operations on product_categories" ON product_categories
    FOR ALL USING (true) WITH CHECK (true);

-- Migrate existing data from products.category to junction table
-- This will create entries in product_categories for existing category assignments
INSERT INTO product_categories (product_id, category_id)
SELECT 
    p.id as product_id,
    c.id as category_id
FROM products p
JOIN categories c ON c.name = p.category
WHERE p.category IS NOT NULL AND p.category != '';

-- After migration is complete and tested, you can optionally remove the category column:
-- ALTER TABLE products DROP COLUMN category;