import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ywpozasjoahmgxctczer.supabase.co';
const supabaseAnonKey = 'sb_publishable_74hCnAXjXNB_feB6Rjrygg_IGx1vz0x';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
