import { createClient } from "@supabase/supabase-js";

const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrlEnv) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}

export const supabaseUrl: string = supabaseUrlEnv;

if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getAccessToken() {
  try {
    // First verify we have a valid user (this ensures we're authenticated)
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      // User not authenticated - return null silently
      return null;
    }

    // Get the session - but be careful: getSession() might return anon key if session is stale
    let sessionData: Awaited<ReturnType<typeof supabase.auth.getSession>> =
      await supabase.auth.getSession();

    if (sessionData.error) {
      // Try refreshing to get a fresh session
      const refreshResult = await supabase.auth.refreshSession();
      if (refreshResult.error || !refreshResult.data.session) {
        return null;
      }
      sessionData = refreshResult as Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >;
    }

    // Check if session exists and has a valid token
    if (!sessionData.data.session) {
      const refreshResult = await supabase.auth.refreshSession();
      if (refreshResult.error || !refreshResult.data.session) {
        return null;
      }
      sessionData = refreshResult as Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >;
    }

    // Check if token is expired (with 5 minute buffer)
    if (!sessionData.data.session) {
      return null;
    }

    const expiresAt = sessionData.data.session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
      if (expiresIn < 300) {
        // Less than 5 minutes remaining - refresh session
        const refreshResult = await supabase.auth.refreshSession();
        if (!refreshResult.error && refreshResult.data.session) {
          sessionData = refreshResult as Awaited<
            ReturnType<typeof supabase.auth.getSession>
          >;
        }
      }
    }

    const token = sessionData.data.session?.access_token || null;
    if (!token) {
      return null;
    }

    // Basic validation - check if it looks like a JWT
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      return null;
    }

    // CRITICAL: Validate token payload to ensure it's a user token, not anon key
    try {
      const payload = JSON.parse(atob(tokenParts[1]));

      if (!payload.sub) {
        // Try to force a session refresh
        const refreshResult = await supabase.auth.refreshSession();
        if (refreshResult.error || !refreshResult.data.session) {
          return null;
        }

        // Check the refreshed token
        const refreshedToken = refreshResult.data.session.access_token;
        const refreshedParts = refreshedToken.split(".");
        if (refreshedParts.length === 3) {
          const refreshedPayload = JSON.parse(atob(refreshedParts[1]));
          if (refreshedPayload.sub && refreshedPayload.role !== "anon") {
            return refreshedToken;
          }
        }

        return null;
      }

      if (payload.role === "anon") {
        return null;
      }

      // Verify the sub matches the user ID
      if (payload.sub !== userData.user.id) {
        return null;
      }
    } catch {
      return null; // Don't send invalid tokens
    }

    return token;
  } catch {
    return null;
  }
}
