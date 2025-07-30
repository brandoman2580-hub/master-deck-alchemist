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
  win: boolean;
  turnLength: number;
  firstHandCombo: boolean;
  comboHit: boolean;
  comboPiecesDrawn: string[];
} {
  const shuffledA = shuffle(deckA.mainDeck);

  // Draw 5-card opening hand
  const handA = shuffledA.slice(0, 5);
  const comboPiecesInHand = handA.filter(c => c.isComboPiece);

  // Simulate 3 more draws (simplified turns)
  const nextDraws = shuffledA.slice(5, 8);
  const comboPiecesDrawn = handA.concat(nextDraws).filter(c => c.isComboPiece);

  // Metrics for this game
  const firstHandCombo = comboPiecesInHand.length > 0;
  const comboHit = comboPiecesDrawn.length > comboPiecesInHand.length;
  const win = comboPiecesDrawn.length >= 2; // Win if 2+ combos seen by turn 3
  const turnLength = Math.floor(Math.random() * 6) + 3; // Turn count 3-8

  return {
    win,
    turnLength,
    firstHandCombo,
    comboHit,
    comboPiecesDrawn: comboPiecesDrawn.map(c => c.id),
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
