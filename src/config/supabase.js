const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL; // Ambil dari Dashboard Supabase
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Ambil dari Dashboard Supabase

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;