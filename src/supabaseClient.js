import { createClient } from "@supabase/supabase-js";

// These are the PUBLIC project URL and PUBLISHABLE (anon) key — safe to
// ship in frontend code by design. Never put the "secret" key here.
const SUPABASE_URL = "https://jttiovnkwqpxbybavrdf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-dedf0esZBw0KwoPr06WIA_T95inDLQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
