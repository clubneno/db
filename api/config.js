module.exports = (req, res) => {
  // Send Supabase configuration to frontend
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY
  });
};