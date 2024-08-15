import { createClient } from "@supabase/supabase-js"

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Environment variable NEXT_PUBLIC_SUPABASE_URL is not defined")
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Environment variable SUPABASE_SERVICE_ROLE_KEY is not defined")
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export default supabaseAdmin