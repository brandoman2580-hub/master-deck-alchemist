# Monitoring & Observability Guide

## Overview

This guide covers monitoring, logging, and observability for the Recommendation Agent system.

---

## Key Metrics

### 1. Consistency Metrics

#### JSON Parse Success Rate
**Target**: > 95% (Goal: 99%)

**Query**:
```sql
SELECT 
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message LIKE '%JSON%' OR error_message LIKE '%parse%' THEN 1 ELSE 0 END) as json_errors,
  ROUND(100.0 * (1 - SUM(CASE WHEN error_message LIKE '%JSON%' OR error_message LIKE '%parse%' THEN 1 ELSE 0 END)::float / COUNT(*)), 2) as success_rate
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### Schema Validation Success Rate
**Target**: > 98% (Goal: 100%)

**Query**:
```sql
SELECT 
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message LIKE '%schema%' OR error_message LIKE '%validation%' THEN 1 ELSE 0 END) as validation_errors,
  ROUND(100.0 * (1 - SUM(CASE WHEN error_message LIKE '%schema%' OR error_message LIKE '%validation%' THEN 1 ELSE 0 END)::float / COUNT(*)), 2) as success_rate
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### Card ID Validation Success Rate
**Target**: 100%

**Query**:
```sql
-- Check for recommendations with invalid card IDs
SELECT 
  COUNT(*) as total_recommendations,
  COUNT(DISTINCT recommendation_id) as unique_requests
FROM recommendation_logs
WHERE error_message LIKE '%cardId%' OR error_message LIKE '%invalid card%'
  AND created_at > NOW() - INTERVAL '7 days';
```

### 2. Quality Metrics

#### Recommendation Accuracy
**Target**: All recommended cards exist in cardPool

**Query**:
```sql
-- This is enforced server-side, but we can check logs
SELECT 
  COUNT(*) as requests_with_candidates,
  AVG(candidate_count) as avg_candidates,
  AVG(final_candidate_count) as avg_final_candidates
FROM recommendation_logs
WHERE candidate_count > 0
  AND created_at > NOW() - INTERVAL '7 days';
```

#### Banlist Compliance
**Target**: 100% of banned cards marked correctly

**Query**:
```sql
-- Check telemetry for banned card recommendations
SELECT 
  COUNT(*) as total_feedback,
  SUM(CASE WHEN accepted = false THEN 1 ELSE 0 END) as rejected_count
FROM recommendation_telemetry
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### Confidence Distribution
**Query**:
```sql
-- Analyze confidence scores (requires storing in logs)
SELECT 
  CASE 
    WHEN confidence >= 0.6 THEN 'High (Apply Allowed)'
    WHEN confidence <= 0.45 THEN 'Low (Investigate)'
    ELSE 'Medium (Review)'
  END as confidence_level,
  COUNT(*) as count
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY confidence_level;
```

### 3. Performance Metrics

#### Response Time (P95)
**Target**: < 5 seconds

**Query**:
```sql
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_response_time,
  AVG(duration_ms) as avg_response_time,
  MAX(duration_ms) as max_response_time
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '7 days'
  AND duration_ms IS NOT NULL;
```

#### Token Usage
**Target**: < 1500 tokens per request

**Query**:
```sql
SELECT 
  AVG(tokens_used) as avg_tokens,
  MAX(tokens_used) as max_tokens,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY tokens_used) as p95_tokens
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '7 days'
  AND tokens_used IS NOT NULL;
```

#### Error Rate
**Target**: < 1%

**Query**:
```sql
SELECT 
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as error_count,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END)::float / COUNT(*), 2) as error_rate
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

### 4. User Experience Metrics

#### Feedback Submission Rate
**Query**:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as feedback_count,
  COUNT(DISTINCT user_id) as unique_users
FROM recommendation_telemetry
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Acceptance Rate
**Query**:
```sql
SELECT 
  SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as accepted_count,
  SUM(CASE WHEN NOT accepted THEN 1 ELSE 0 END) as rejected_count,
  ROUND(100.0 * SUM(CASE WHEN accepted THEN 1 ELSE 0 END)::float / COUNT(*), 2) as acceptance_rate
FROM recommendation_telemetry
WHERE created_at > NOW() - INTERVAL '30 days';
```

#### Apply Button Usage
**Query**:
```sql
-- Track when users apply recommendations (requires client-side tracking)
-- This would be in application analytics, not database
```

---

## Logging

### Edge Function Logs

#### Access Logs
1. Go to: **Supabase Dashboard** → **Edge Functions** → **recommendation-agent** → **Logs**
2. Filter by:
   - Time range
   - Log level (error, warn, info)
   - Search terms

#### Key Log Messages

**Success Indicators**:
- `✅ User authenticated: [user-id]`
- `✅ Card data fetch successful: [count] cards returned`
- `✅ Recommendation received: [details]`

**Warning Indicators**:
- `⚠️ No card docs available`
- `⚠️ No candidates found`
- `⚠️ Individual fetches also returned 0 cards`

**Error Indicators**:
- `❌ Error fetching card data`
- `❌ Cannot access cards table`
- `❌ No valid numeric IDs to fetch`

### Structured Logging

The Edge Function logs structured JSON for observability:

```json
{
  "level": "info",
  "timestamp": "2024-12-09T15:30:00Z",
  "recommendation_id": "uuid-here",
  "user_id": "user-uuid",
  "question": "What engines work well?",
  "candidate_count": 30,
  "final_candidate_count": 25,
  "tokens_used": 1245,
  "cost_usd": 0.000336,
  "response_version": "2.0",
  "duration_ms": 2341,
  "confidence": 0.85
}
```

---

## Alerts & Notifications

### Critical Alerts

Set up alerts for:

1. **High Error Rate**
   - Condition: Error rate > 5%
   - Action: Notify team immediately
   - Query: See "Error Rate" metric above

2. **Slow Response Time**
   - Condition: P95 response time > 10s
   - Action: Investigate performance
   - Query: See "Response Time" metric above

3. **Schema Validation Failures**
   - Condition: Validation failures > 10%
   - Action: Check LLM responses
   - Query: See "Schema Validation Success Rate" metric above

4. **Database Connection Errors**
   - Condition: Any database connection error
   - Action: Check database status
   - Monitor: Edge Function logs

5. **Groq API Errors**
   - Condition: Groq API returns error
   - Action: Check API key and quota
   - Monitor: Edge Function logs

### Warning Alerts

1. **Low Confidence Recommendations**
   - Condition: > 50% of recommendations have confidence < 0.45
   - Action: Review search and LLM prompts

2. **High Token Usage**
   - Condition: Average tokens > 1500
   - Action: Optimize prompts or reduce card count

3. **Low Feedback Rate**
   - Condition: < 10% of recommendations receive feedback
   - Action: Improve UI/UX for feedback submission

---

## Dashboards

### Recommended Dashboard Views

#### 1. Overview Dashboard
- Total requests (last 24h, 7d, 30d)
- Error rate
- Average response time
- Success rate

#### 2. Performance Dashboard
- Response time distribution
- Token usage trends
- Cost per request
- Throughput (requests/minute)

#### 3. Quality Dashboard
- Confidence distribution
- Acceptance rate
- Feedback trends
- Recommendation quality metrics

#### 4. Error Dashboard
- Error rate over time
- Error types breakdown
- Failed requests by reason
- Recovery time

---

## Database Queries for Monitoring

### Daily Summary
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
  ROUND(AVG(duration_ms), 2) as avg_duration_ms,
  ROUND(AVG(tokens_used), 0) as avg_tokens,
  ROUND(SUM(cost_usd)::numeric, 4) as total_cost_usd
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Top Errors
```sql
SELECT 
  error_message,
  COUNT(*) as error_count,
  MAX(created_at) as last_occurrence
FROM recommendation_logs
WHERE error_message IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY error_count DESC
LIMIT 10;
```

### User Activity
```sql
SELECT 
  user_id,
  COUNT(*) as request_count,
  MAX(created_at) as last_request
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY request_count DESC
LIMIT 20;
```

### Feedback Analysis
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_feedback,
  SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as accepted,
  SUM(CASE WHEN NOT accepted THEN 1 ELSE 0 END) as rejected,
  ROUND(100.0 * SUM(CASE WHEN accepted THEN 1 ELSE 0 END)::float / COUNT(*), 2) as acceptance_rate
FROM recommendation_telemetry
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Cost Monitoring

### Groq API Costs
**Estimated Cost**: ~$0.0003 per request

**Query**:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as request_count,
  ROUND(SUM(cost_usd)::numeric, 4) as total_cost,
  ROUND(AVG(cost_usd)::numeric, 6) as avg_cost_per_request
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '30 days'
  AND cost_usd IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Monthly Cost Estimate
```sql
SELECT 
  COUNT(*) as total_requests,
  ROUND(SUM(cost_usd)::numeric, 2) as total_cost_usd,
  ROUND(AVG(cost_usd)::numeric, 6) as avg_cost_per_request
FROM recommendation_logs
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
  AND cost_usd IS NOT NULL;
```

---

## Troubleshooting Queries

### Find Failed Requests
```sql
SELECT 
  recommendation_id,
  user_id,
  question,
  error_message,
  created_at
FROM recommendation_logs
WHERE error_message IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

### Find Slow Requests
```sql
SELECT 
  recommendation_id,
  user_id,
  question,
  duration_ms,
  tokens_used,
  created_at
FROM recommendation_logs
WHERE duration_ms > 5000  -- > 5 seconds
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY duration_ms DESC
LIMIT 50;
```

### Find Requests with No Candidates
```sql
SELECT 
  recommendation_id,
  user_id,
  question,
  candidate_count,
  final_candidate_count,
  created_at
FROM recommendation_logs
WHERE candidate_count = 0
  OR final_candidate_count = 0
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Best Practices

1. **Monitor Daily**: Check error rates and performance daily
2. **Set Alerts**: Configure alerts for critical metrics
3. **Review Weekly**: Analyze trends and patterns weekly
4. **Optimize Monthly**: Review costs and optimize based on usage
5. **Document Issues**: Keep a log of issues and resolutions

---

## Tools & Integrations

### Supabase Dashboard
- Edge Function logs
- Database queries
- Real-time monitoring

### External Monitoring (Optional)
- **Datadog**: For advanced monitoring
- **Sentry**: For error tracking
- **Grafana**: For custom dashboards
- **PagerDuty**: For alerting

---

## Support

For monitoring issues:
1. Check Supabase Dashboard logs
2. Review database queries above
3. Check Edge Function deployment status
4. Verify environment variables

