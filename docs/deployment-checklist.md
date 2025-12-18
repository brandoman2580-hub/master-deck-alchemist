# Deployment Checklist - Recommendation Agent

## Pre-Deployment

### ✅ Code Review
- [ ] All tests passing (Phase 5)
- [ ] No linter errors
- [ ] Code reviewed and approved
- [ ] All TODOs addressed or documented

### ✅ Database Migrations
- [ ] `recommendation_telemetry` table created
- [ ] Migrations tested locally
- [ ] Migration SQL reviewed
- [ ] RLS policies configured correctly
- [ ] Indexes created for performance

**Migration File**: `supabase/migrations/20251209151219_create_recommendation_telemetry.sql`

**Verify Migration**:
```sql
-- Check table exists
SELECT * FROM recommendation_telemetry LIMIT 1;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'recommendation_telemetry';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'recommendation_telemetry';
```

### ✅ Environment Variables
- [ ] `GROQ_API_KEY` set in Supabase Edge Function secrets
- [ ] `MODEL_NAME` set (optional, defaults to `llama-3.3-70b-versatile`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in client deployment
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in client deployment

**Verify Edge Function Secrets**:
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verify `GROQ_API_KEY` is present
3. Verify `MODEL_NAME` is set (if custom)

---

## Deployment Steps

### Step 1: Deploy Database Migration

#### Option A: Using Supabase CLI (Recommended)
```bash
# Link to project (if not already linked)
supabase link --project-ref your-project-ref

# Apply migration
supabase db push

# Verify migration
supabase migration list
```

#### Option B: Using Supabase Dashboard
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20251209151219_create_recommendation_telemetry.sql`
3. Paste and execute
4. Verify table created: `SELECT * FROM recommendation_telemetry LIMIT 1;`

### Step 2: Deploy Edge Functions

```bash
# Deploy recommendation-agent
supabase functions deploy recommendation-agent

# Deploy recommendation-feedback
supabase functions deploy recommendation-feedback

# Verify deployment
supabase functions list
```

**Verify in Dashboard**:
1. Go to Edge Functions → `recommendation-agent`
2. Check "Deployments" tab for latest version
3. Verify status is "Active"

### Step 3: Update Client Application

#### For Vercel/Next.js
```bash
# Build and deploy
npm run build
vercel deploy --prod

# Or push to main branch (if auto-deploy enabled)
git push origin main
```

#### Verify Client Environment Variables
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Verify:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Post-Deployment Verification

### ✅ Functional Tests

#### 1. Test Recommendation Agent
```bash
curl -X POST https://your-project.supabase.co/functions/v1/recommendation-agent \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What engines work well with my deck?",
    "format": "MASTER_DUEL",
    "explainTo": "novice"
  }'
```

**Expected**: Response with `schemaVersion: "1.0.0"` and valid recommendations

#### 2. Test Feedback Endpoint
```bash
curl -X POST https://your-project.supabase.co/functions/v1/recommendation-feedback \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deckFingerprint": "test-fingerprint",
    "suggestionId": "test-suggestion-1",
    "accepted": true
  }'
```

**Expected**: `{"success": true, "telemetry_id": "..."}`

#### 3. Verify Telemetry Storage
```sql
SELECT * FROM recommendation_telemetry 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected**: Records appear after submitting feedback

### ✅ Integration Tests

1. **Test in UI**:
   - [ ] Open recommendation agent in app
   - [ ] Submit a question
   - [ ] Verify recommendations appear
   - [ ] Test "Apply" button (if confidence >= 0.6)
   - [ ] Test "Investigate" button (if confidence <= 0.45)
   - [ ] Submit feedback (accept/reject)
   - [ ] Verify feedback appears in database

2. **Test Edge Cases**:
   - [ ] Empty deck (should show error)
   - [ ] Invalid deck size (< 40 or > 60 cards)
   - [ ] No cards found (should show investigate message)
   - [ ] Banned card recommendation (should be marked)

### ✅ Performance Tests

1. **Response Time**:
   - [ ] Average response time < 5 seconds
   - [ ] P95 response time < 5 seconds
   - [ ] No timeouts

2. **Error Rate**:
   - [ ] Error rate < 1%
   - [ ] No 500 errors
   - [ ] Authentication errors handled gracefully

3. **Resource Usage**:
   - [ ] Memory usage stable
   - [ ] No memory leaks
   - [ ] Database connections managed properly

---

## Monitoring Setup

### ✅ Edge Function Logs

1. **Access Logs**:
   - Go to Supabase Dashboard → Edge Functions → `recommendation-agent` → Logs
   - Monitor for:
     - Errors
     - Warnings
     - Performance metrics

2. **Key Metrics to Monitor**:
   - Request count
   - Error rate
   - Response time
   - Token usage
   - Cost per request

### ✅ Database Monitoring

1. **Telemetry Table**:
```sql
-- Check feedback submission rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as feedback_count,
  SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as accepted_count,
  SUM(CASE WHEN NOT accepted THEN 1 ELSE 0 END) as rejected_count
FROM recommendation_telemetry
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

2. **Recommendation Logs**:
```sql
-- Check recommendation success rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed
FROM recommendation_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### ✅ Error Alerts

Set up alerts for:
- [ ] Error rate > 5%
- [ ] Response time > 10s (p95)
- [ ] Schema validation failures > 10%
- [ ] Database connection errors
- [ ] Groq API errors

---

## Rollback Plan

If issues are detected:

### Immediate Rollback (0-5 minutes)
1. **Revert Edge Function**:
```bash
# List deployments
supabase functions list recommendation-agent

# Deploy previous version
supabase functions deploy recommendation-agent --version PREVIOUS_VERSION
```

2. **Disable Feature** (if needed):
   - Add feature flag in client code
   - Disable recommendation agent UI

### Short-term Fix (5-30 minutes)
1. Check Edge Function logs for errors
2. Verify environment variables
3. Check database connectivity
4. Review recent code changes

### Long-term Fix (30+ minutes)
1. Identify root cause
2. Fix issues in development
3. Re-test thoroughly
4. Re-deploy with fixes

---

## Success Criteria

### ✅ Deployment Successful If:
- [ ] All Edge Functions deployed successfully
- [ ] Database migrations applied
- [ ] Environment variables set correctly
- [ ] Functional tests pass
- [ ] Integration tests pass
- [ ] Performance metrics acceptable
- [ ] No critical errors in logs
- [ ] Telemetry working correctly

### ✅ Production Ready If:
- [ ] Error rate < 1%
- [ ] Response time < 5s (p95)
- [ ] Schema validation success rate > 95%
- [ ] Card ID validation success rate = 100%
- [ ] Monitoring and alerts configured
- [ ] Rollback plan tested

---

## Post-Deployment Tasks

### Week 1
- [ ] Monitor error rates daily
- [ ] Review Edge Function logs daily
- [ ] Check telemetry data collection
- [ ] Gather user feedback
- [ ] Monitor API costs (Groq)

### Week 2-4
- [ ] Analyze recommendation quality
- [ ] Review feedback acceptance rates
- [ ] Optimize performance if needed
- [ ] Update documentation based on findings

---

## Support & Troubleshooting

### Common Issues

1. **"Authentication required" Error**
   - Check access token is valid
   - Verify user is logged in
   - Check token expiration

2. **"No candidate cards found"**
   - Check card search is working
   - Verify database has cards
   - Check hybrid search configuration

3. **"Invalid JSON" Error**
   - Check LLM response format
   - Review salvage retry logic
   - Check system prompt

4. **Telemetry Not Recording**
   - Verify `recommendation_telemetry` table exists
   - Check RLS policies
   - Verify `deckFingerprint` is included in requests

### Getting Help

1. Check Edge Function logs in Supabase Dashboard
2. Review `meta.diagnostic` in error responses
3. Check `recommendation_logs` table
4. Review test results from Phase 5

---

## Deployment Sign-Off

**Deployed By**: _________________  
**Date**: _________________  
**Version**: 1.0.0  
**All Checks Passed**: ☐ Yes ☐ No  
**Ready for Production**: ☐ Yes ☐ No

**Notes**:
_________________________________________________
_________________________________________________
_________________________________________________

