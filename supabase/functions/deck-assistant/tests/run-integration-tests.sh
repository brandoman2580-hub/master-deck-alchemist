#!/bin/bash

# Integration Test Runner for Deck Assistant
# Run with: bash tests/run-integration-tests.sh

echo "🧪 Running Deck Assistant Integration Tests"
echo "============================================"
echo ""

# Check for required environment variables
if [ -z "$GROQ_API_KEY" ]; then
  echo "⚠️  Warning: GROQ_API_KEY not set"
  echo "   Some tests will be skipped"
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "⚠️  Warning: SUPABASE_URL not set"
  echo "   Some tests will be skipped"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not set"
  echo "   Some tests will be skipped"
fi

echo ""
echo "Running tests..."
echo ""

# Run integration tests
deno test --allow-net --allow-env --allow-read tests/integration-full.test.ts

echo ""
echo "✅ Integration tests completed"
