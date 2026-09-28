# Strategist edge tests

## Architecture

**Live gateway:** `supabase/functions/strategist/index.ts` → `coach-response.ts`.

**NOT LIVE (do not extend for production):** `prompts.ts`, `response-generator.ts`, and the `deck-assistant/` twin (`../deck-assistant/NOT_LIVE.md`).

Jest golden evals for modes / grounding / tone live in the app repo:

- `__tests__/engine/strategist-golden-modes.test.ts`
- `__tests__/engine/strategist-phase4-modes.test.ts`
- `__tests__/engine/strategist-facts-brain.test.ts`
- `__tests__/engine/strategist-grounding.test.ts`

---

# Deck Assistant Tests (legacy Deno suite)

Comprehensive test suite for the Deck Assistant edge function, covering unit tests, integration tests, and full end-to-end tests.

## Setup

- **Deno**: Version 1.28+ (required for edge function tests)
- **Environment Variables**: See [Environment Setup](#environment-setup)

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Environment Setup](#environment-setup)
- [Test Types](#test-types)
- [Test Data](#test-data)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)
- [Contributing](#contributing)

---

## Overview

The Deck Assistant test suite validates the core functionality of the deck assistant edge function, including:

- **Structured Query Generation**: Converting natural language queries into structured database queries
- **RAG Retrieval**: Vector similarity search and card retrieval
- **Deck Analysis**: Analyzing deck composition and generating insights
- **Response Generation**: Creating user-friendly responses with recommendations
- **Conversation Management**: Handling multi-turn conversations and context

### Test Coverage

- ✅ Unit tests for individual components
- ✅ Integration tests for component interactions
- ✅ Full integration tests with real API calls
- ✅ Error handling and edge cases
- ✅ Schema validation

---

## Test Structure

```
tests/
├── self-query.test.ts          # Structured query generation tests
├── rag-retrieval.test.ts       # RAG retrieval and vector search tests
├── integration.test.ts          # Component integration tests
├── integration-full.test.ts    # Full E2E tests with real APIs
├── response-generator.test.ts   # Response generation tests
├── load-env.ts                 # Environment variable loader
├── run-integration-tests.sh     # Shell script for running integration tests
├── run-integration-tests.ps1    # PowerShell script for running integration tests
└── run-integration-with-env.ps1 # PowerShell script with environment loading
```

### Test Files Explained

#### `self-query.test.ts`
Tests the structured query generation system that converts natural language into database queries:
- Specific query handling (e.g., "cards that work with Blue-Eyes")
- Vague query clarification (e.g., "what should I add?")
- Intent classification (recommendation, clarification, ratio suggestions)
- Conversation history integration
- Filter extraction (archetype, type, attribute filters)
- Deck exclusion logic

#### `rag-retrieval.test.ts`
Tests the RAG (Retrieval-Augmented Generation) system:
- Structured query validation
- Deck embedding dimensions and format
- Deck analysis structure validation
- Vector similarity search (requires Supabase connection for full tests)

#### `integration.test.ts`
Tests component integration and end-to-end flow structure:
- Chat flow structure validation
- Request/response format validation
- Clarification handling
- Error response handling

#### `integration-full.test.ts`
Full integration tests that require real API keys and database connections:
- Supabase connection validation
- Database queries (decks, cards)
- Structured query generation with real LLM (Groq)
- Deck analysis with real cards
- Full chat flow (embedding → query → retrieval → response)
- Conversation management (create, sequence, history)

#### `response-generator.test.ts`
Tests the response generation system:
- Response format validation
- Recommendation structure
- Clarification question generation
- Error message formatting

---

## Running Tests

### Prerequisites

- **Deno**: Version 1.28+ (required for edge function tests)
- **Environment Variables**: See [Environment Setup](#environment-setup)

### Unit Tests (No API Keys Required)

Run individual test files:

```bash
# Self-query tests
deno test --allow-net --allow-env --allow-read tests/self-query.test.ts

# RAG retrieval tests
deno test --allow-net --allow-env --allow-read tests/rag-retrieval.test.ts

# Integration tests (structure validation only)
deno test --allow-net --allow-env --allow-read tests/integration.test.ts

# Response generator tests
deno test --allow-net --allow-env --allow-read tests/response-generator.test.ts
```

Run all unit tests:

```bash
deno test --allow-net --allow-env --allow-read tests/
```

**Note:** Unit tests use mock data and don't require API keys or database connections.

### Full Integration Tests (Requires API Keys)

Full integration tests require real API keys and database access. These tests make actual API calls and should be run sparingly.

**Prerequisites:**
- `GROQ_API_KEY` - For LLM calls
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key with database access

**Run with scripts:**

```bash
# Linux/Mac
bash tests/run-integration-tests.sh

# Windows PowerShell
.\tests\run-integration-tests.ps1

# Windows PowerShell (with environment loading)
.\tests\run-integration-with-env.ps1
```

**Run directly with Deno:**

```bash
deno test --allow-net --allow-env --allow-read tests/integration-full.test.ts
```

**What full integration tests cover:**
- ✅ Supabase connection validation
- ✅ Database queries (decks, cards)
- ✅ Structured query generation with real LLM
- ✅ Deck analysis with real cards
- ✅ Full chat flow (embedding → query → retrieval → response)
- ✅ Conversation management (create, sequence, history)

---

## Environment Setup

### Required Environment Variables

#### For Unit Tests
No environment variables required - unit tests use mock data.

#### For Full Integration Tests

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GROQ_API_KEY` | Groq API key for LLM calls | Yes | `gsk_xxxxxxxxxxxx` |
| `SUPABASE_URL` | Supabase project URL | Yes | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Yes | `eyJhbGci...` |

### Loading Environment Variables

Tests automatically load environment variables from `.env` files in the project root (in order of priority):

1. `.env.local` (highest priority, typically gitignored)
2. `.env.test` (test-specific variables)
3. `.env` (default)

### Setting Environment Variables Manually

#### PowerShell (Windows)

```powershell
$env:GROQ_API_KEY = "your-groq-api-key"
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

#### Bash (Linux/Mac)

```bash
export GROQ_API_KEY="your-groq-api-key"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Environment Variable Security

⚠️ **Never commit API keys to version control**

- Add `.env.local` to `.gitignore`
- Use environment variable management in CI/CD
- Rotate keys regularly
- Use different keys for development and production

---

## Test Types

### Unit Tests

**Purpose**: Test individual components in isolation with mock data.

**Characteristics**:
- Fast execution (< 1 second)
- No external dependencies
- Use mock data and functions
- Test specific functionality

**Example**:
```typescript
Deno.test("self-query - specific query", () => {
  const query = generateStructuredQuery("cards that work with Blue-Eyes");
  assertEquals(query.intent, "recommendation");
  assertExists(query.filters);
});
```

### Integration Tests

**Purpose**: Test component interactions and data flow.

**Characteristics**:
- Moderate execution time (1-5 seconds)
- May use mock external services
- Test component integration
- Validate data structures

**Example**:
```typescript
Deno.test("integration - chat flow structure", () => {
  const response = await processChatMessage({
    deckId: "test-deck",
    userQuery: "what should I add?",
  });
  assertExists(response.type);
  assertExists(response.conversation_id);
});
```

### Full Integration Tests

**Purpose**: Test complete system with real APIs and database.

**Characteristics**:
- Slower execution (5-30 seconds)
- Require real API keys
- Make actual API calls
- Test end-to-end flows

**Example**:
```typescript
Deno.test("integration-full - real deck analysis", async () => {
  const analysis = await analyzeDeck(testDeck);
  assertExists(analysis.summary);
  assertExists(analysis.recommendations);
});
```

---

## Test Data

### Mock Data

Unit tests use mock data defined in test files:

- **Mock Decks**: Sample deck structures for testing
- **Mock Cards**: Sample card data for testing
- **Mock Embeddings**: Sample vector embeddings
- **Mock Conversations**: Sample conversation history

### Test Database

Full integration tests require a test database with:

- **Cards Table**: Populated with card data
- **Decks Table**: Sample decks for testing
- **Card Embeddings**: Vector embeddings for cards
- **Conversations Table**: For conversation management tests

### Creating Test Data

Before running full integration tests, ensure your test database has:

1. **Cards**: At least a few cards for testing
2. **Decks**: At least one test deck
3. **Embeddings**: Card embeddings for vector search tests

You can use the seed scripts in `scripts/` to populate test data:

```bash
npm run seed:metadata
```

---

## Troubleshooting

### Common Issues

#### "Missing environment variables"

**Error**: `Missing required environment variables: GROQ_API_KEY`

**Solution**: 
1. Check that `.env.local` or `.env.test` exists in project root
2. Verify environment variables are set correctly
3. Use `load-env.ts` to debug environment loading

#### "Supabase connection failed"

**Error**: `Failed to connect to Supabase`

**Solution**:
1. Verify `SUPABASE_URL` is correct
2. Check `SUPABASE_SERVICE_ROLE_KEY` is valid
3. Ensure Supabase project is accessible
4. Check network connectivity

#### "Groq API rate limit"

**Error**: `Rate limit exceeded`

**Solution**:
1. Wait before retrying (rate limits reset periodically)
2. Reduce test frequency
3. Use mock data for unit tests instead

#### "Test timeout"

**Error**: `Test timed out after 30000ms`

**Solution**:
1. Increase timeout in test configuration
2. Check network connectivity
3. Verify API endpoints are responding
4. Consider using unit tests instead of full integration tests

### Debug Mode

Enable verbose logging:

```bash
deno test --allow-net --allow-env --allow-read tests/ --log-level=debug
```

### Skipping Tests

Skip tests that require API keys:

```typescript
Deno.test({
  name: "integration-full - real API test",
  ignore: !hasRequiredEnv, // Skip if env vars not set
  fn: async () => {
    // Test code
  },
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deck Assistant Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.40.0
      
      - name: Run unit tests
        run: deno test --allow-net --allow-env --allow-read tests/
        env:
          # Unit tests don't need API keys
      
      - name: Run integration tests (if API keys available)
        if: ${{ secrets.GROQ_API_KEY != '' }}
        run: deno test --allow-net --allow-env --allow-read tests/integration-full.test.ts
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Environment Variables in CI/CD

Store sensitive environment variables as secrets:

- **GitHub Actions**: Repository Settings → Secrets
- **GitLab CI**: CI/CD → Variables
- **CircleCI**: Project Settings → Environment Variables

---

## Contributing

### Adding New Tests

1. **Choose the right test type**:
   - Unit test for isolated components
   - Integration test for component interactions
   - Full integration test for E2E flows

2. **Follow naming conventions**:
   - Test files: `*.test.ts`
   - Test names: Descriptive and specific
   - Group related tests with `Deno.test()` blocks

3. **Use appropriate assertions**:
   - `assertEquals()` for equality checks
   - `assertExists()` for existence checks
   - `assert()` for custom conditions

4. **Mock external dependencies**:
   - Use mock data for unit tests
   - Avoid real API calls in unit tests
   - Only use real APIs in full integration tests

### Test Best Practices

- ✅ Write tests before fixing bugs
- ✅ Keep tests independent and isolated
- ✅ Use descriptive test names
- ✅ Test edge cases and error conditions
- ✅ Keep tests fast and reliable
- ✅ Clean up test data after tests

### Code Coverage

Aim for high test coverage:

- **Unit Tests**: > 80% coverage
- **Integration Tests**: Cover critical paths
- **Full Integration Tests**: Cover main user flows

---

## Additional Resources

- [Deno Testing Documentation](https://deno.land/manual/testing)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Groq API Documentation](https://console.groq.com/docs)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review test logs for error messages
3. Check environment variable configuration
4. Verify API keys are valid and not expired

---

**Last Updated**: January 2026
