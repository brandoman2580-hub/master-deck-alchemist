import { createBrowserClient } from "@supabase/ssr";
import process from "node:process";

/**
 * Browser Supabase client.
 *
 * `@supabase/ssr` keeps the session in cookies, so this browser client and the
 * server client in `utils/supabase/server.ts` share one source of truth. It
 * replaces the legacy `lib/supabaseClient.ts`, which used a localStorage-backed
 * `@supabase/supabase-js` client plus a hand-rolled JWT refresh.
 *
 * Do not add module-level memoisation here: `createBrowserClient` already caches
 * a singleton, but only when `isBrowser()`. Caching unconditionally would reuse
 * one client across requests on the server and leak session state between users.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Access token for direct Edge Function calls.
 *
 * `@supabase/ssr` refreshes the session automatically, so the legacy hand-rolled
 * JWT inspection is unnecessary. No session yields `null`, which callers turn
 * into an anonymous request.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

