import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ia3ZnbHV1bmJua3R6dWx6amZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDkzMjgsImV4cCI6MjEwMzQyNTMyOH0.ALbCN61Orm58EW7VhfXFnBxeyW3ILiOkuan8n5-cs5U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'hotelnozap_sb_session',
  },
});
