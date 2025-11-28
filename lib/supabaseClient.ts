import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getAccessToken() {
  try {
    // First verify we have a valid user (this ensures we're authenticated)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError || !userData.user) {
      console.error("❌ No authenticated user found:", userError?.message || "User is null")
      return null
    }
    
    console.log("✅ User authenticated:", userData.user.id)
    
    // Get the session - but be careful: getSession() might return anon key if session is stale
    let { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error("❌ Error getting session:", error.message)
      // Try refreshing to get a fresh session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshData.session) {
        console.error("❌ Failed to refresh session:", refreshError?.message)
        return null
      }
      data = refreshData
      console.log("✅ Session refreshed after error")
    }
    
    // Check if session exists and has a valid token
    if (!data.session) {
      console.warn("⚠️ No session found - attempting to refresh...")
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshData.session) {
        console.error("❌ Failed to refresh session:", refreshError?.message)
        return null
      }
      data = refreshData
    }
    
    // Check if token is expired (with 5 minute buffer)
    const expiresAt = data.session.expires_at
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
      if (expiresIn < 300) { // Less than 5 minutes remaining
        console.log("🔄 Token expiring soon, refreshing session...")
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error("❌ Error refreshing session:", refreshError.message)
          // Still try to use the existing token
        } else if (refreshData.session) {
          data = refreshData
          console.log("✅ Session refreshed")
        }
      }
    }
    
    const token = data.session?.access_token || null
    if (!token) {
      console.warn("⚠️ No access token in session - user may not be logged in")
      return null
    }
    
    // Basic validation - check if it looks like a JWT
    const tokenParts = token.split(".")
    if (tokenParts.length !== 3) {
      console.error("❌ Token doesn't appear to be a valid JWT")
      return null
    }
    
    // CRITICAL: Validate token payload to ensure it's a user token, not anon key
    try {
      const payload = JSON.parse(atob(tokenParts[1]))
      console.log("🔍 Token payload check:", {
        hasSub: !!payload.sub,
        sub: payload.sub,
        role: payload.role,
        aud: payload.aud,
      })
      
      if (!payload.sub) {
        console.error("❌ Token missing 'sub' claim - this is likely an anon key, not a user token")
        console.error("   Token details:", { role: payload.role, aud: payload.aud, iss: payload.iss })
        console.error("   User ID from getUser():", userData.user.id)
        console.error("   This means the session is stale or invalid. User needs to log in again.")
        
        // Try to force a session refresh
        console.log("🔄 Attempting to force session refresh...")
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshData.session) {
          console.error("❌ Failed to refresh session:", refreshError?.message)
          return null
        }
        
        // Check the refreshed token
        const refreshedToken = refreshData.session.access_token
        const refreshedParts = refreshedToken.split(".")
        if (refreshedParts.length === 3) {
          const refreshedPayload = JSON.parse(atob(refreshedParts[1]))
          if (refreshedPayload.sub && refreshedPayload.role !== "anon") {
            console.log("✅ Refreshed token is valid:", { sub: refreshedPayload.sub, role: refreshedPayload.role })
            return refreshedToken
          }
        }
        
        return null
      }
      
      if (payload.role === "anon") {
        console.error("❌ Token is anon key, not a user access token")
        console.error("   This means the user session is invalid. User needs to log in again.")
        return null
      }
      
      // Verify the sub matches the user ID
      if (payload.sub !== userData.user.id) {
        console.error("❌ Token sub claim doesn't match user ID")
        console.error("   Token sub:", payload.sub, "User ID:", userData.user.id)
        return null
      }
      
      console.log("✅ Token validated - has sub claim:", payload.sub, "role:", payload.role, "matches user:", payload.sub === userData.user.id)
    } catch (decodeErr) {
      console.error("❌ Failed to decode token payload:", decodeErr)
      return null // Don't send invalid tokens
    }
    
    console.log("✅ Access token retrieved (length:", token.length, ", expires in:", expiresAt ? `${Math.floor((expiresAt - Math.floor(Date.now() / 1000)) / 60)} minutes` : "unknown", ")")
    
    return token
  } catch (err) {
    console.error("❌ Exception getting access token:", err)
    return null
  }
}