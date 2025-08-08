export type Card = {
  id: string;
  name: string;
  isComboPiece?: boolean;
};

export type Deck = {
  id: string;
  name: string;
  mainDeck: Card[];
  extraDeck?: Card[];
  sideDeck?: Card[];
  mode?: string;
};

export type GameOutcome =
  | "combo_win"
  | "luck_win"
  | "brick_loss"
  | "opponent_combo_loss"
  | "draw";

export interface SimulationResult {
  gamesSimulated: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgTurnLength: number;
  brickRate: number;
  opponentBrickRate: number;
  firstHandComboRate: number; // your deck
  opponentFirstHandComboRate: number; // opp deck
  outcomeCounts: Record<GameOutcome, number>;
  topOpeners: { combo: string; count: number }[];
  synergy: { [cardA: string]: { [cardB: string]: number } };
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Define what makes a hand a "brick"
function isBrick(hand: Card[]): boolean {
  // User: customize logic as desired!
  // Example: has no combo pieces, or all cards are vanillas
  return hand.filter(c => c.isComboPiece).length === 0;
}

// Simulate one duel
function simulateGame(deckA: Deck, deckB: Deck): {
  win: boolean;
  outcome: GameOutcome;
  turnLength: number;
  brick: boolean;
  opponentBrick: boolean;
  firstHandComboA: boolean;
  firstHandComboB: boolean;
  synergyCards: string[];
  openingHandSig: string;
} {
  const shuffledA = shuffle(deckA.mainDeck);
  const shuffledB = shuffle(deckB.mainDeck);

  const handA = shuffledA.slice(0, 5);
  const handB = shuffledB.slice(0, 5);

  const brickA = isBrick(handA);
  const brickB = isBrick(handB);

  const comboA = handA.filter(c => c.isComboPiece).length >= 2;
  const comboB = handB.filter(c => c.isComboPiece).length >= 2;

  let outcome: GameOutcome = "draw";
  let win = false;

  if (brickA && !brickB) {
    outcome = "brick_loss";
    win = false;
  } else if (!brickA && brickB) {
    outcome = "luck_win";
    win = true;
  } else if (comboA && !comboB) {
    outcome = "combo_win";
    win = true;
  } else if (!comboA && comboB) {
    outcome = "opponent_combo_loss";
    win = false;
  } else if (comboA && comboB) {
    // Both players combo, coinflip
    win = Math.random() > 0.5;
    outcome = win ? "combo_win" : "opponent_combo_loss";
  } else {
    win = Math.random() > 0.5;
    outcome = "draw";
  }

  const synergyCards = handA.filter(c => c.isComboPiece).map(c => c.name).sort();
  const openingHandSig = handA.map(c => c.name).sort().join(" | ");
  const turnLength = Math.floor(Math.random() * 6) + 3;

  return {
    win,
    outcome,
    turnLength,
    brick: brickA,
    opponentBrick: brickB,
    firstHandComboA: comboA,
    firstHandComboB: comboB,
    synergyCards,
    openingHandSig,
  };
}

export function runDeckSimulation(
  deckA: Deck,
  deckB: Deck,
  simulations: number = 100
): SimulationResult {
  let wins = 0, losses = 0, draws = 0, totalTurnLength = 0, bricks = 0, oppBricks = 0;
  let firstHandCombo = 0, firstHandComboOpp = 0;
  const outcomeCounts: Record<GameOutcome, number> = {
    combo_win: 0,
    luck_win: 0,
    brick_loss: 0,
    opponent_combo_loss: 0,
    draw: 0
  };

  const synergy: { [a: string]: { [b: string]: number } } = {};
  const openerCounts: Record<string, number> = {};

  for (let i = 0; i < simulations; i++) {
    const res = simulateGame(deckA, deckB);
    totalTurnLength += res.turnLength;

    if (res.win) wins++; else losses++;
    if (res.outcome === "draw") draws++;
    if (res.brick) bricks++;
    if (res.opponentBrick) oppBricks++;
    if (res.firstHandComboA) firstHandCombo++;
    if (res.firstHandComboB) firstHandComboOpp++;
    outcomeCounts[res.outcome]++;

    // Opening hand combos
    if (res.synergyCards.length > 1) {
      for (const a of res.synergyCards) {
        for (const b of res.synergyCards) {
          if (a !== b) {
            if (!synergy[a]) synergy[a] = {};
            synergy[a][b] = (synergy[a][b] || 0) + 1;
          }
        }
      }
    }

    // Top opener sigs
    openerCounts[res.openingHandSig] = (openerCounts[res.openingHandSig] || 0) + 1;
  }

  // Compute top 10 openers
  const topOpeners = Object.entries(openerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([combo, count]) => ({ combo, count }));

  return {
    gamesSimulated: simulations,
    wins,
    losses,
    draws,
    winRate: (wins / simulations) * 100,
    avgTurnLength: totalTurnLength / simulations,
    brickRate: bricks / simulations * 100,
    opponentBrickRate: oppBricks / simulations * 100,
    firstHandComboRate: (firstHandCombo / simulations) * 100,
    opponentFirstHandComboRate: (firstHandComboOpp / simulations) * 100,
    outcomeCounts,
    topOpeners,
    synergy
  };
}
