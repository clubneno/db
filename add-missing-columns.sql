-- Add missing columns to products table

-- Check current table structure first (run this in Supabase SQL editor)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'public';

-- Add missing columns if they don't exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS image VARCHAR(1000);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_price VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS link VARCHAR(1000);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS eu_allowed BOOLEAN DEFAULT false;