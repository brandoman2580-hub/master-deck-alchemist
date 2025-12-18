# Environment Variables Documentation

## Overview

This document lists all environment variables required for the Recommendation Agent and related services.

---

## Client-Side Environment Variables

### Required Variables

These variables must be set in your Next.js application (`.env.local` or deployment environment):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Usage:**
- `NEXT_PUBLIC_SUPABASE_URL`: Base URL for Supabase API calls
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous key for client-side Supabase operations

**Where Used:**
- `lib/supabaseClient.ts` - Supabase client initialization
- `lib/api/recommendationAgent.ts` - Recommendation API calls
- `lib/api/recommendationFeedback.ts` - Feedback API calls

---

## Edge Function Environment Variables

### Required Variables

These variables must be set in Supabase Dashboard → Edge Functions → Settings → Secrets:

```bash
# Supabase Configuration (Auto-provided by Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Groq API Configuration
GROQ_API_KEY=your-groq-api-key-here

# Model Configuration (Optional)
MODEL_NAME=llama-3.3-70b-versatile
```

### Variable Descriptions

#### `SUPABASE_URL`
- **Type**: String (URL)
- **Required**: Yes
- **Description**: Your Supabase project URL
- **Auto-provided**: Yes (Supabase automatically provides this)
- **Example**: `https://izshwywgfaozmisedwxm.supabase.co`

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: String
- **Required**: Yes
- **Description**: Service role key with full database access (bypasses RLS)
- **Auto-provided**: Yes (Supabase automatically provides this)
- **Security**: ⚠️ **NEVER expose this key client-side**
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### `GROQ_API_KEY`
- **Type**: String
- **Required**: Yes
- **Description**: API key for Groq LLM service
- **Where to get**: [Groq Console](https://console.groq.com/)
- **Example**: `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### `MODEL_NAME`
- **Type**: String
- **Required**: No (defaults to `llama-3.3-70b-versatile`)
- **Description**: Groq model to use for recommendations
- **Options**:
  - `llama-3.3-70b-versatile` (default, recommended)
  - `llama-3.1-70b-versatile`
  - `mixtral-8x7b-32768`
- **Example**: `llama-3.3-70b-versatile`

---

## Setting Environment Variables

### For Local Development

1. **Client-side variables** (`.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. **Edge Function variables** (Supabase Dashboard):
   - Go to: Project Settings → Edge Functions → Secrets
   - Add each variable:
     - `GROQ_API_KEY` = `your-groq-key`
     - `MODEL_NAME` = `llama-3.3-70b-versatile` (optional)

### For Production Deployment

#### Supabase Dashboard
1. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
2. Add/update the following secrets:
   - `GROQ_API_KEY` (required)
   - `MODEL_NAME` (optional, defaults to `llama-3.3-70b-versatile`)

#### Vercel/Next.js Deployment
1. Navigate to your project settings
2. Go to **Environment Variables**
3. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Verification

### Verify Client Variables
```typescript
// In your Next.js app
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
```

### Verify Edge Function Variables
```bash
# Test Edge Function (will show error if vars missing)
curl -X POST https://your-project.supabase.co/functions/v1/recommendation-agent \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}'
```

Check Edge Function logs in Supabase Dashboard for any missing variable errors.

---

## Security Notes

### ⚠️ Never Commit Secrets
- Add `.env.local` to `.gitignore`
- Never commit `.env` files
- Use environment variable management in deployment platforms

### ⚠️ Service Role Key
- `SUPABASE_SERVICE_ROLE_KEY` has full database access
- Only use in Edge Functions (server-side)
- Never expose to client-side code

### ⚠️ API Keys
- Rotate keys regularly
- Use different keys for development and production
- Monitor API usage for unexpected activity

---

## Troubleshooting

### "Missing Supabase configuration" Error
- **Cause**: `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set
- **Fix**: These are auto-provided by Supabase. If missing, check Edge Function deployment.

### "GROQ_API_KEY not configured" Error
- **Cause**: `GROQ_API_KEY` not set in Edge Function secrets
- **Fix**: Add `GROQ_API_KEY` in Supabase Dashboard → Edge Functions → Secrets

### "Missing env.NEXT_PUBLIC_SUPABASE_URL" Error
- **Cause**: Client-side environment variable not set
- **Fix**: Add `NEXT_PUBLIC_SUPABASE_URL` to `.env.local` or deployment environment

---

## Example `.env.local` (Client-Side)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://izshwywgfaozmisedwxm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6c2h3eXdnZmFvem1pc2VkeHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4NzY1MjAsImV4cCI6MjA0OTQ1MjUyMH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Example Supabase Edge Function Secrets

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MODEL_NAME=llama-3.3-70b-versatile
```

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided by Supabase and do not need to be set manually.

