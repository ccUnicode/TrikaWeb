import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = () =>
  createClient(
    import.meta.env.SUPABASE_URL!,
    import.meta.env.SUPABASE_SERVICE_KEY!
  );
