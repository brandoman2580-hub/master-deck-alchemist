# Deck Tester Agent - Detailed Implementation Plan

## Overview
The Deck Tester Agent will provide AI-powered matchup analysis, strategic insights, and duel simulation predictions. Unlike the existing Monte Carlo simulation (which uses statistical probability), this agent will use AI reasoning to analyze how decks interact, predict outcomes, and provide actionable strategic advice.

## Architecture

### 1. Backend: Deno Edge Function
**Location**: `supabase/functions/deck-tester-agent/index.ts`

**Purpose**: 
- Analyze deck matchups using AI
- Simulate duels with AI reasoning
- Provide strategic insights and predictions
- Track token usage and costs

**Input Schema** (`DeckTesterAgentRequest`):
```typescript
{
  deck_a: {
    id: string;
    name: string;
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
    mode: DeckMode;
  };
  deck_b: {
    id: string;
    name: string;
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
    mode: DeckMode;
  };
  test_type: "matchup_analysis" | "duel_simulation" | "strategic_insights";
  num_simulations?: number; // For duel simulation mode (max 20)
  context?: string; // User's specific question or context
  banlist_format: "MASTER_DUEL" | "TCG";
}
```

**Output Schema** (`DeckTesterAgentResponse`):
```typescript
{
  analysis: string; // Overall matchup analysis
  predicted_win_rate: number; // 0-100
  matchup_assessment: {
    deck_a_advantages: string[];
    deck_b_advantages: string[];
    key_factors: string[];
    difficulty_
      "very_favorable" | "favorable" | "even" | "unfavorable" | "very_unfavorable";
  };
  strategic_insights: {
    going_first_strategy: string;
    going_second_strategy: string;
    key_plays: string[];
    disruption_points: string[];
  };
  simulation_results?: {
    games_simulated: number;
    wins_deck_a: number;
    wins_deck_b: number;
    draws: number;
    avg_turn_length: number;
    common_outcomes: Array<{
      outcome: string;
      frequency: number;
      explanation: string;
    }>;
  };
  estimated_cost: {
    tokens_used: number;
    cost_usd: number;
  };
}
```

**Key Functions**:
- `loadBanlist()` - Load Master Duel or TCG banlist
- `findRelatedCards()` - Find cards that interact with both decks
- `buildMatchupPrompt()` - Construct detailed AI prompt for matchup analysis
- `buildSimulationPrompt()` - Construct prompt for duel simulation
- `sanitizeAiResponse()` - Clean AI output to prevent hallucinated cards
- `validateCardNames()` - Ensure all mentioned cards exist in database

**AI Prompt Structure**:
1. Deck A composition (main, extra, side)
2. Deck B composition (main, extra, side)
3. Banlist restrictions
4. Format (Master Duel vs TCG)
5. Test type specific instructions
6. Request structured JSON response

### 2. Frontend API Client
**Location**: `lib/api/deckTesterAgent.ts`

**Functions**:
- `analyzeMatchup(request: DeckTesterAgentRequest): Promise<DeckTesterAgentResponse>`
- `simulateDuels(request: DeckTesterAgentRequest): Promise<DeckTesterAgentResponse>`
- `getStrategicInsights(request: DeckTesterAgentRequest): Promise<DeckTesterAgentResponse>`
- `getSideDeckAdvice(request: DeckTesterAgentRequest): Promise<DeckTesterAgentResponse>`

**Features**:
- Authentication token handling
- Error handling and retries
- Request/response type safety

### 3. Frontend UI Component
**Location**: `components/ai-agents/deck-tester-agent.tsx`

**Features**:
- Toggleable panel (similar to Deck Builder Agent)
- Deck selection (user's deck vs opponent deck)
- Test type selector (matchup analysis, duel simulation, strategic insights, side deck advice)
- Results display:
  - Matchup assessment with visual indicators
  - Predicted win rate with confidence level
  - Strategic insights (going first/second)
  - Key plays and disruption points
  - Side deck recommendations (if applicable)
  - Simulation results (if applicable)
- Token usage display with progress bar
- Loading states and error handling
- Card previews for recommended cards
- "Add to Side Deck" functionality for recommendations

**UI Sections**:
1. **Header**: Title, token usage progress bar, test type selector
2. **Deck Selection**: Dropdowns for Deck A and Deck B
3. **Configuration**: Test type, number of simulations (if applicable), context input
4. **Results Display**:
   - Matchup Summary Card (win rate, difficulty, key factors)
   - Strategic Insights Card (going first/second strategies)
   - Key Plays Card (important plays and disruption points)
   - Side Deck Recommendations Card (if applicable)
   - Simulation Results Card (if applicable)

### 4. Integration with Existing Deck Tester Page
**Location**: `app/deck-tester/page.tsx`

**Integration Strategy**:
- **REPLACE** Monte Carlo simulation entirely with AI-powered Deck Tester Agent
- Remove all Monte Carlo simulation code (`lib/deckTesterMonteCarlo.ts`)
- Refactor existing deck tester page to use AI agent instead
- Maintain similar UI structure but powered by AI insights
- Keep chart visualizations but populate with AI-generated data

## Implementation Steps

### Phase 1: Backend Development
1. Create `supabase/functions/deck-tester-agent/index.ts`
2. Implement banlist loading (reuse from deck-builder-agent)
3. Implement card search and related card finding
4. Build AI prompt construction functions
5. Implement Groq API integration
6. Add response sanitization and validation
7. Add token usage tracking
8. Test with sample decks

### Phase 2: Type Definitions
1. Add `DeckTesterAgentRequest` and `DeckTesterAgentResponse` to `types/ai-agents.ts`
2. Add `MatchupAssessment`, `StrategicInsights`, `SideDeckRecommendations` types
3. Export types for frontend use

### Phase 3: Frontend API Client
1. Create `lib/api/deckTesterAgent.ts`
2. Implement all API functions
3. Add error handling
4. Add TypeScript types

### Phase 4: Frontend UI Component
1. Create `components/ai-agents/deck-tester-agent.tsx`
2. Implement deck selection UI
3. Implement test type selector
4. Implement results display sections
5. Add token usage progress bar
6. Add loading and error states
7. Add card preview integration
8. Add "Add to Side Deck" functionality

### Phase 5: Integration & Cleanup
1. Replace Monte Carlo simulation in `app/deck-tester/page.tsx` with AI agent
2. Remove `lib/deckTesterMonteCarlo.ts` file
3. Refactor existing components to work with AI data
4. Ensure proper authentication checks
5. Test end-to-end flow

### Phase 6: Testing & Refinement
1. Test with various deck matchups
2. Verify AI responses are accurate and useful
3. Optimize prompt engineering for better results
4. Refine UI/UX based on testing
5. Add caching for repeated analyses

## Key Considerations

### Authentication
- All requests require authenticated user
- Check authentication in edge function
- Show login prompt if user not authenticated

### Cost Management
- Display token usage prominently
- Cache results for identical deck pairs
- Allow users to see cost before running expensive simulations
- **Maximum 20 AI simulations** per request (enforced in frontend and backend)

### AI Prompt Engineering
- Provide detailed deck compositions
- Include banlist context
- Specify format rules (Master Duel vs TCG)
- Request structured JSON responses
- Include examples of good analysis

### Error Handling
- Handle API failures gracefully
- Validate deck data before sending
- Provide meaningful error messages
- Retry logic for transient failures

### Performance
- Debounce rapid deck selection changes
- Cache analyses per deck pair
- Lazy load AI agent component
- Optimize prompt size to reduce tokens

## Testing Scenarios

1. **Matchup Analysis**: Blue-Eyes vs Dark Magician
2. **Duel Simulation**: Combo deck vs Control deck
3. **Strategic Insights**: Going first vs going second analysis
4. **Side Deck Advice**: Meta matchup side deck recommendations
5. **Edge Cases**: Empty decks, invalid deck IDs, network failures

## Success Criteria

1. ✅ AI provides accurate matchup assessments
2. ✅ Strategic insights are actionable and relevant
3. ✅ Token usage is tracked and displayed
4. ✅ UI is responsive and intuitive
5. ✅ Integration with existing deck tester is seamless
6. ✅ Error handling is robust
7. ✅ Performance is acceptable (< 5s for analysis, < 30s for simulation)

## Next Steps After Approval

1. Implement backend edge function
2. Create type definitions
3. Build frontend API client
4. Develop UI component
5. Integrate with deck tester page
6. Test and refine

