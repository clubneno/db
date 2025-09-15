-- Fix price columns to be numeric and add currency columns

-- First drop existing price columns if they exist
ALTER TABLE products DROP COLUMN IF EXISTS price;
ALTER TABLE products DROP COLUMN IF EXISTS subscription_price;

-- Add new price columns with proper numeric types and currency
ALTER TABLE products ADD COLUMN price_amount DECIMAL(10,2);
ALTER TABLE products ADD COLUMN price_currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE products ADD COLUMN subscription_price_amount DECIMAL(10,2);
ALTER TABLE products ADD COLUMN subscription_currency VARCHAR(3) DEFAULT 'USD';

-- Keep the original price strings for display purposes
ALTER TABLE products ADD COLUMN price_display VARCHAR(50);
ALTER TABLE products ADD COLUMN subscription_price_display VARCHAR(50);