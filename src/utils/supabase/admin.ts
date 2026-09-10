import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

let client: SupabaseClient | null = null;

export const createAdminClient = (): SupabaseClient => {
  if (!client) client = createClient(supabaseUrl, supabaseKey);
  return client;
};
