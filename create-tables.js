const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
    try {
        console.log('🚀 Creating database tables...');

        // Create products table with basic structure first
        const createProductsSQL = `
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
        );`;

        console.log('🔄 Creating products table...');
        const { data: productsData, error: productsError } = await supabase.rpc('sql', {
            query: createProductsSQL
        });

        if (productsError) {
            console.error('❌ Error creating products table:', productsError);
        } else {
            console.log('✅ Products table created successfully');
        }

        // Create categories table
        const createCategoriesSQL = `
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            parent_id INTEGER REFERENCES categories(id),
            is_sub_category BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW()
        );`;

        console.log('🔄 Creating categories table...');
        const { data: categoriesData, error: categoriesError } = await supabase.rpc('sql', {
            query: createCategoriesSQL
        });

        if (categoriesError) {
            console.error('❌ Error creating categories table:', categoriesError);
        } else {
            console.log('✅ Categories table created successfully');
        }

        // Create goals table
        const createGoalsSQL = `
        CREATE TABLE IF NOT EXISTS goals (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            parent_id INTEGER REFERENCES goals(id),
            is_sub_goal BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW()
        );`;

        console.log('🔄 Creating goals table...');
        const { data: goalsData, error: goalsError } = await supabase.rpc('sql', {
            query: createGoalsSQL
        });

        if (goalsError) {
            console.error('❌ Error creating goals table:', goalsError);
        } else {
            console.log('✅ Goals table created successfully');
        }

        // Create flavors table
        const createFlavorsSQL = `
        CREATE TABLE IF NOT EXISTS flavors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );`;

        console.log('🔄 Creating flavors table...');
        const { data: flavorsData, error: flavorsError } = await supabase.rpc('sql', {
            query: createFlavorsSQL
        });

        if (flavorsError) {
            console.error('❌ Error creating flavors table:', flavorsError);
        } else {
            console.log('✅ Flavors table created successfully');
        }

        console.log('🎉 All tables created successfully!');

    } catch (error) {
        console.error('💥 Table creation failed:', error);
    }
}

createTables();