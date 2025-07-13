import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    // Handle error (user not logged in, etc.)
    return null
  }
  return data.session?.access_token || null
}