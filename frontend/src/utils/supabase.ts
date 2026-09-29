import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ('https://ywpozasjoahmgxctczer.supabase.co') || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
