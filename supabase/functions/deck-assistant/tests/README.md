# Deck Assistant Tests

## Running Tests

### Unit Tests

```bash
# Self-query tests
deno test --allow-net --allow-env --allow-read tests/self-query.test.ts

# RAG retrieval tests
deno test --allow-net --allow-env --allow-read tests/rag-retrieval.test.ts

# Integration tests (structure validation only)
deno test --allow-net --allow-env --allow-read tests/integration.test.ts

# Response generator tests
deno test --allow-net --allow-env --allow-read tests/response-generator.test.ts

# All unit tests
deno test --allow-net --allow-env --allow-read tests/
```

**Note:** Tests automatically load environment variables from `.env.local`, `.env.test`, or `.env` files in the project root.

### Full Integration Tests (Requires API Keys)

**Prerequisites:**
- Set environment variables:
  - `GROQ_API_KEY` - For LLM calls (Groq API key)
  - `SUPABASE_URL` - Your Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key

**Run with:**

```bash
# Linux/Mac
bash tests/run-integration-tests.sh

# Windows PowerShell
.\tests\run-integration-tests.ps1

# Or directly with Deno
deno test --allow-net --allow-env --allow-read tests/integration-full.test.ts
```

**What it tests:**
- ✅ Supabase connection
- ✅ Database queries (decks, cards)
- ✅ Structured query generation with real LLM
- ✅ Deck analysis with real cards
- ✅ Full chat flow (embedding → query → retrieval)
- ✅ Conversation management (create, sequence)

## Test Structure

### `self-query.test.ts`
Tests for structured query generation:
- Specific query handling
- Vague query clarification
- Intent classification
- Conversation history integration
- Filter extraction
- Deck exclusion logic

### `rag-retrieval.test.ts`
Tests for RAG retrieval:
- Structured query validation
- Deck embedding dimensions
- Deck analysis structure
- (Full integration tests require Supabase connection)

### `integration.test.ts`
Tests for end-to-end flow:
- Chat flow structure
- Request/response format validation
- Clarification handling
- (Full integration tests require test infrastructure)

## Environment Variables Required

- `GROQ_API_KEY` - For LLM calls (Groq API key) in self-query tests
- `SUPABASE_URL` - For integration tests
- `SUPABASE_SERVICE_ROLE_KEY` - For integration tests

### Loading Environment Variables

Tests automatically load environment variables from `.env` files in the project root:
1. `.env.local` (highest priority, typically gitignored)
2. `.env.test` (test-specific variables)
3. `.env` (default)

You can also set environment variables directly:
```bash
# PowerShell
$env:GROQ_API_KEY = "your-key"
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-key"

# Bash
export GROQ_API_KEY="your-key"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
```

## Mock Data

Tests use mock data for:
- Deck analysis
- Structured queries
- Deck embeddings
- Conversation history

## Future Enhancements

- Add full integration tests with Supabase connection
- Add mock Supabase client for unit tests
- Add performance benchmarks
- Add error handling tests
