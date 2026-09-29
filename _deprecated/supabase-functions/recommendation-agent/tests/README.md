# Recommendation Agent Phase 2 Tests

## Test Coverage

### Unit Tests (`recommend-v2.test.ts`)
- ✅ Request validation (22 tests)
  - Valid requests pass
  - Invalid formats/values are rejected
  - Deck structure validation
  - Deck legality checks (40-60 main cards)
  - JSON extraction from various formats
  - Response schema validation
  - Fingerprinting consistency

### Integration Tests (`integration.test.ts`)
- ✅ Response structure validation
- ✅ Deck legality enforcement
- ✅ Confidence gating logic
- ✅ Metadata inclusion

## Running Tests

```bash
# Run all Phase 2 tests
cd supabase/functions/recommendation-agent
deno test tests/recommend-v2.test.ts --allow-net --allow-env
deno test tests/integration.test.ts --allow-net --allow-env

# Run all tests
deno test tests/ --allow-net --allow-env
```

## Test Results

**Phase 2 Tests**: 22/22 passed ✅
**Integration Tests**: 4/4 passed ✅

**Total**: 26/26 tests passing

## Manual Testing

To manually test the Edge Function:

1. **Deploy the function** (if not already deployed):
   ```bash
   supabase functions deploy recommendation-agent
   ```

2. **Test with curl** (replace with your actual tokens):
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/recommendation-agent \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "question": "Find me some hand traps",
       "format": "MASTER_DUEL",
       "explainTo": "novice",
       "current_deck": {
         "main": [
           {"cardId": 123, "count": 3},
           {"cardId": 456, "count": 2}
         ],
         "extra": [],
         "side": []
       }
     }'
   ```

3. **Expected Response Format**:
   ```json
   {
     "schemaVersion": "1.0.0",
     "confidence": 0.0-1.0,
     "explainTo": "novice|intermediate|advanced",
     "summary": "string",
     "recommendations": [
       {
         "cardId": "string",
         "cardName": "string",
         "action": "add|remove|replace|tech|note",
         "reason": "string",
         "impactEst": -1.0 to 1.0,
         "synergyScore": 0.0 to 1.0,
         "evidence": ["string"],
         "banned": boolean
       }
     ],
     "ui": [
       {
         "id": "string",
         "type": "text|list|card|table|suggestion",
         "content": "string|string[]|object"
       }
     ],
     "actions": {
       "applyAllowed": boolean,
       "investigateRecommended": boolean
     },
     "meta": {
       "usedCardIds": [number],
       "deckFingerprint": "string",
       "recommendation_id": "string",
       "tokens_used": number,
       "cost_usd": number
     }
   }
   ```

## Test Scenarios

### ✅ Valid Scenarios
- Request with valid deck (40-60 main cards)
- Request with question only
- Request with user preferences
- Response with valid schema

### ❌ Invalid Scenarios (Should be Rejected)
- Deck with < 40 main cards
- Deck with > 60 main cards
- Invalid format value
- Invalid explainTo value
- Invalid recommendation action
- Response with confidence > 1.0
- Response with missing required fields

## Next Steps

After testing, proceed to:
1. **Phase 3**: Client Integration - Update client code to handle new response format
2. **Phase 4**: Feedback Endpoint - Implement telemetry collection
3. **Phase 5**: Performance Testing - Load testing and optimization

