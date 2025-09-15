const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
let supabase;

const getSupabase = () => {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
};

// Raw SQL query helper (for complex queries)
const rawQuery = async (query, params = []) => {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      query: query, 
      params: params 
    });
    
    if (error) throw error;
    return { rows: data };
  } catch (error) {
    console.error('Supabase query error:', error);
    throw error;
  }
};

// Initialize database (create tables)
const initializeDatabase = async () => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    console.log('📋 Initializing Supabase database schema...');
    
    // Note: For Supabase, you typically run the schema.sql in the Supabase dashboard
    // or use migrations. For now, we'll log instructions.
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Database schema ready. To initialize:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the schema.sql file contents');
    console.log('✅ Schema file location:', schemaPath);
    
    return { initialized: true, schemaPath };
  } catch (error) {
    console.error('❌ Error preparing database schema:', error);
    throw error;
  }
};

// Health check
const healthCheck = async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist
      throw error;
    }
    
    return { healthy: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Supabase health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

module.exports = {
  getSupabase,
  rawQuery,
  initializeDatabase,
  healthCheck
};