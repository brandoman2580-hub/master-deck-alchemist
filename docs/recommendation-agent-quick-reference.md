# Recommendation Agent - Quick Reference Guide

## Quick Links

- **API Documentation**: [api/recommendation-agent.md](./api/recommendation-agent.md)
- **Environment Variables**: [environment-variables.md](./environment-variables.md)
- **Deployment Checklist**: [deployment-checklist.md](./deployment-checklist.md)
- **Monitoring Guide**: [monitoring-guide.md](./monitoring-guide.md)

---

## Quick Start

### 1. Client-Side Usage

```typescript
import { getRecommendations } from '@/lib/api/recommendationAgent';

const response = await getRecommendations({
  question: "What engines work well with my deck?",
  format: "MASTER_DUEL",
  explainTo: "novice",
  current_deck: {
    mainDeck: [...],
    extraDeck: [...],
    sideDeck: [...]
  }
});

// Check confidence
if (response.actions?.applyAllowed) {
  // Show "Apply" button
} else if (response.actions?.investigateRecommended) {
  // Show "Investigate" button
}

// Render recommendations
response.recommendations.forEach(rec => {
  // Render recommendation
});

// Render UI blocks
response.ui.forEach(block => {
  // Render based on block.type
});
```

### 2. Submit Feedback

```typescript
import { submitTelemetryFeedback } from '@/lib/api/recommendationFeedback';

await submitTelemetryFeedback({
  deckFingerprint: response.meta?.deckFingerprint,
  suggestionId: suggestion.suggestionId,
  accepted: true,
  deck: currentDeck, // Optional, will generate fingerprint if missing
});
```

---

## Common Patterns

### Check if Recommendation is Banned
```typescript
if (recommendation.banned) {
  // Show warning, disable apply, or use "note" action
}
```

### Handle Empty Recommendations
```typescript
if (response.recommendations.length === 0) {
  // Show UI blocks which contain helpful messages
  response.ui.forEach(block => renderUIBlock(block));
}
```

### Validate Response
```typescript
import { RecommenderZ } from '@/types/recommender';

const validated = RecommenderZ.safeParse(response);
if (!validated.success) {
  // Handle invalid response
}
```

---

## Environment Variables Quick Reference

### Client-Side (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Edge Function (Supabase Dashboard)
```
GROQ_API_KEY=your-groq-key
MODEL_NAME=llama-3.3-70b-versatile  # Optional
```

---

## Deployment Quick Steps

1. **Deploy Migration**:
   ```bash
   supabase db push
   ```

2. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy recommendation-agent
   supabase functions deploy recommendation-feedback
   ```

3. **Set Environment Variables**:
   - Supabase Dashboard → Edge Functions → Secrets
   - Add `GROQ_API_KEY`

4. **Verify**:
   - Test endpoint with curl
   - Check logs in Supabase Dashboard
   - Verify telemetry table

---

## Monitoring Quick Queries

### Check Error Rate
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END)::float / COUNT(*), 2) as error_rate
FROM recommendation_logs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Check Feedback Rate
```sql
SELECT 
  COUNT(*) as feedback_count,
  SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as accepted
FROM recommendation_telemetry
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Troubleshooting Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| "Authentication required" | Check user is logged in, token is valid |
| "No candidate cards found" | Check card search, verify database has cards |
| "Invalid JSON" | Check LLM response, review salvage retry |
| Telemetry not recording | Verify table exists, check RLS policies |
| Cards not loading | Check `master_duel_banned` column removed, verify `imageurl` removed |

---

## Support

- **API Docs**: See `docs/api/recommendation-agent.md`
- **Full Deployment Guide**: See `docs/deployment-checklist.md`
- **Monitoring**: See `docs/monitoring-guide.md`

