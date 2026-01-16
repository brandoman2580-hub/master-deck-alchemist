# Deck Assistant Testing Guide

## Testing in Supabase Edge Function Test Interface

### ✅ Detection Working

The edge function now **correctly detects** when you're using a service role key and returns a helpful error message:
- **Error**: "Service role key detected."
- **Status Code**: 401 (correct for authentication failures)
- **Message**: Clear instructions on how to fix it

### Common Issue: "Service role key detected"

When testing the `deck-assistant` edge function in Supabase's test interface, you may see this error. This happens because Supabase's test interface may automatically use the service role key, which cannot be validated as a user token.

### Solution: Use a User Access Token

**To test properly, you need a user access token:**

1. **Get a user access token from your app:**
   - Log in via your application
   - Get the `access_token` from the session
   - Use that token in the Authorization header

2. **In Supabase Test Interface:**
   - **Authorization Header**: `Bearer <user-access-token>`
   - **NOT**: `Bearer <service-role-key>` ❌

### Quick Steps to Get a User Access Token

**Method 1: Browser Console (Easiest)**

1. Open your app in the browser and log in
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run:
   ```javascript
   // If using Supabase client in your app
   const { data: { session } } = await supabase.auth.getSession();
   console.log("Access Token:", session?.access_token);
   ```
5. Copy the token from the console
6. Use it in Supabase test interface: `Bearer <paste-token-here>`

**Method 2: From Your App Code**

```typescript
import { supabase } from '@/lib/supabaseClient';

const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;
console.log("Access Token:", accessToken);
```

**Method 3: Create Test User**

```typescript
// In your app or a test script
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'test-password'
});
const accessToken = data.session?.access_token;
```

### Example Test Request

```json
{
  "action": "chat",
  "deck_id": "your-deck-uuid",
  "user_query": "I need more consistency"
}
```

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (user access token)
```

### Error Messages Explained

**"Service role key detected"** ✅ (This is working correctly!)
- The function detected you're using a service role key
- **Solution**: Use a user access token instead (see methods above)
- The error message includes step-by-step instructions

**"Authentication failed"**
- The token is invalid, expired, or not a user token
- **Solution**: Get a fresh user access token from a logged-in session

**"Invalid token: missing user identifier"**
- The token doesn't have a 'sub' claim (not a user token)
- **Solution**: Use a user access token, not an API key

### Best Practice

Always use a real user access token when testing. This ensures:
- ✅ Your edge function works correctly with real authentication
- ✅ RLS policies are properly tested
- ✅ User-specific data access is validated
- ✅ Production-like testing environment

### Troubleshooting

**If you still see "Service role key detected":**
1. Make sure you copied the **entire** access token (it's a long JWT string)
2. Make sure you included `Bearer ` prefix: `Bearer <token>`
3. Check that the token hasn't expired (tokens expire after some time)
4. Get a fresh token by logging out and back in

**If you see "Authentication failed" with a user token:**
1. Verify the token is from a logged-in session
2. Check that the token hasn't expired
3. Make sure you're using the `access_token`, not `refresh_token`
