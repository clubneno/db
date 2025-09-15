-- Fix column types that were created incorrectly

-- First, let's check what types the columns currently have
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'public';

-- Change price columns from numeric to text/varchar to accommodate $ symbols
ALTER TABLE products ALTER COLUMN price TYPE VARCHAR(50);
ALTER TABLE products ALTER COLUMN subscription_price TYPE VARCHAR(50);

-- Make sure other text columns are correct types
ALTER TABLE products ALTER COLUMN description TYPE TEXT;
ALTER TABLE products ALTER COLUMN image TYPE VARCHAR(1000);
ALTER TABLE products ALTER COLUMN link TYPE VARCHAR(1000);
ALTER TABLE products ALTER COLUMN category TYPE VARCHAR(255);
ALTER TABLE products ALTER COLUMN primary_goal TYPE VARCHAR(255);