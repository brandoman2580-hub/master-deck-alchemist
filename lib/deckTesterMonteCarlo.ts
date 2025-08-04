export type Card = {
  id: string;
  name: string;
  isComboPiece?: boolean; // Mark cards critical to combos
};

export type Deck = {
  id: string;
  name: string;
  mainDeck: Card[];
  extraDeck?: Card[];
  sideDeck?: Card[];
  mode?: string;
};

export type SimulationResult = {
  gamesSimulated: number;
  wins: number;
  losses: number;
  winRate: number; // %
  avgTurnLength: number;
  firstHandComboRate: number;
  comboHitRate: number;
  comboDrawMatrix: { [cardId: string]: { [cardId: string]: number } }; // For Heatmap/Matrices
};

// Helper: Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Simulate one game between deckA and deckB (simplified, Monte Carlo style)
function simulateGame(deckA: Deck, deckB: Deck): {
  win: boolean; // true if deckA wins
  turnLength: number;
  firstHandCombo: boolean;
  comboHit: boolean;
  comboPiecesDrawn: string[];
  opponentCombo: boolean;
} {
  // Shuffle both decks' main decks
  const shuffledA = shuffle(deckA.mainDeck);
  const shuffledB = shuffle(deckB.mainDeck);

  // Player A draws
  const handA = shuffledA.slice(0, 5);
  const comboPiecesInHandA = handA.filter(c => c.isComboPiece);

  const nextDrawsA = shuffledA.slice(5, 8);
  const comboPiecesDrawnA = handA.concat(nextDrawsA).filter(c => c.isComboPiece);

  // Player B draws (simulate opening—a bit simpler)
  const handB = shuffledB.slice(0, 5);
  const comboPiecesInHandB = handB.filter(c => c.isComboPiece);

  // For each, check combo criteria
  const aFirstHandCombo = comboPiecesInHandA.length > 0;
  const bFirstHandCombo = comboPiecesInHandB.length > 0;
  const aComboHit = comboPiecesDrawnA.length >= 2;
  const bComboHit = handB.concat(shuffledB.slice(5, 8)).filter(c => c.isComboPiece).length >= 2;

  // WIN LOGIC (tweak for your true business rules!)
  // Example: favor the player with more combos hit; randomize if tied
  let win: boolean;
  if (aComboHit && !bComboHit) win = true;
  else if (!aComboHit && bComboHit) win = false;
  else win = Math.random() > 0.5; // tie, choose randomly

  // Random turn length
  const turnLength = Math.floor(Math.random() * 6) + 3;

  return {
    win,
    turnLength,
    firstHandCombo: aFirstHandCombo,
    comboHit: aComboHit,
    comboPiecesDrawn: comboPiecesDrawnA.map(c => c.id),
    opponentCombo: bFirstHandCombo,
  };
}

// Main Monte Carlo simulation loop
export function runDeckSimulation(
  deckA: Deck,
  deckB: Deck,
  simulations: number = 100
): SimulationResult {
  let wins = 0;
  let totalTurnLength = 0;
  let firstHandComboCount = 0;
  let comboHitCount = 0;
  const comboDrawMatrix: { [cardId: string]: { [cardId: string]: number } } = {};

  for (let i = 0; i < simulations; i++) {
    const res = simulateGame(deckA, deckB);
    if (res.win) wins++;
    totalTurnLength += res.turnLength;
    if (res.firstHandCombo) firstHandComboCount++;
    if (res.comboHit) comboHitCount++;

    // Build heatmap/matrix: card pairings
    const unique = Array.from(new Set(res.comboPiecesDrawn));
    unique.forEach(cardA => {
      if (!comboDrawMatrix[cardA]) comboDrawMatrix[cardA] = {};
      unique.forEach(cardB => {
        if (cardA !== cardB) {
          comboDrawMatrix[cardA][cardB] = (comboDrawMatrix[cardA][cardB] || 0) + 1;
        }
      });
    });
  }

  return {
    gamesSimulated: simulations,
    wins,
    losses: simulations - wins,
    winRate: (wins / simulations) * 100,
    avgTurnLength: totalTurnLength / simulations,
    firstHandComboRate: (firstHandComboCount / simulations) * 100,
    comboHitRate: (comboHitCount / simulations) * 100,
    comboDrawMatrix,
  };
}

// Usage example:
//
// import { runDeckSimulation } from "./deckTesterMonteCarlo";
// const result = runDeckSimulation(deckA, deckB, 200);
// // result.winRate, result.avgTurnLength, result.comboDrawMatrix => Ready for charts!
