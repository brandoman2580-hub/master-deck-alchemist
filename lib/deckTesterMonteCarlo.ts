export type Card = {
  id: string;
  name: string;
  isComboPiece?: boolean;
  effectType?: "search" | "draw" | "negate" | "removal" | "extender";
  comboValue?: number; // How much it advances a combo (0=not a combo, 1=piece, >1=core)
};

export type Deck = {
  id: string;
  name: string;
  mainDeck: Card[];
  extraDeck?: Card[];
  sideDeck?: Card[];
  mode?: "TCG" | "Master Duel";
};

export type GameOutcome =
  | "combo_win"
  | "opponent_combo_loss"
  | "brick_loss"
  | "grind_win"
  | "grind_loss"
  | "negated_loss"
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
  firstHandComboRate: number;
  opponentFirstHandComboRate: number;
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

// Emulate realistic brick-hand logic
function isBrick(hand: Card[], minComboScore: number = 3): boolean {
  const score = hand.reduce((acc, c) => acc + (c.comboValue ?? 0), 0);
  return score < minComboScore;
}

// Simulate one full duel with turn-by-turn logic
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
  // Choose mode defaults
  const mode = deckA.mode || deckB.mode || "Master Duel";
  const startingHandA = mode === "TCG" ? 5 : 5;
  const startingHandB = startingHandA + (mode === "Master Duel" ? 1 : 0); // Master Duel gives +1 draw if going second

  let shuffledA = shuffle(deckA.mainDeck);
  let shuffledB = shuffle(deckB.mainDeck);

  const handA = shuffledA.splice(0, startingHandA);
  const handB = shuffledB.splice(0, startingHandB);

  const brickA = isBrick(handA);
  const brickB = isBrick(handB);

  let comboGaugeA = handA.reduce((acc, c) => acc + (c.comboValue ?? 0), 0);
  let comboGaugeB = handB.reduce((acc, c) => acc + (c.comboValue ?? 0), 0);

  const hasComboA = comboGaugeA >= 5;
  const hasComboB = comboGaugeB >= 5;

  const firstHandComboA = hasComboA;
  const firstHandComboB = hasComboB;

  // Synergy analysis for opening hand
  const synergyCards = handA.filter(c => c.isComboPiece).map(c => c.name).sort();
  const openingHandSig = handA.map(c => c.name).sort().join(" | ");

  // If either deck bricks totally, fast resolve
  if (brickA && !brickB)
    return {
      win: false, outcome: "brick_loss", turnLength: 1,
      brick: true, opponentBrick: false, firstHandComboA, firstHandComboB, synergyCards, openingHandSig
    };
  if (brickB && !brickA)
    return {
      win: true, outcome: "combo_win", turnLength: 1,
      brick: false, opponentBrick: true, firstHandComboA, firstHandComboB, synergyCards, openingHandSig
    };

  // Track "negates" the opponent can use to disrupt combo
  let oppNegateAvailable = handB.filter(c => c.effectType === "negate").length;
  let playerNegateAvailable = handA.filter(c => c.effectType === "negate").length;

  const maxTurns = 6;
  let turnCount = 1;
  let winner: "A" | "B" | null = null;
  let outcome: GameOutcome = "draw";

  while (!winner && turnCount <= maxTurns) {
    // Each player draws one card
    const drawA = shuffledA.shift(); if (drawA) { handA.push(drawA); comboGaugeA += drawA.comboValue ?? 0; }
    const drawB = shuffledB.shift(); if (drawB) { handB.push(drawB); comboGaugeB += drawB.comboValue ?? 0; }

    // Simulate effect resolution for A on their turn:
    // Searchers: add a missing combo piece from deck
    const searchersA = handA.filter(c => c.effectType === "search");
    for (const _ of searchersA) {
      // Find highest-value missing combo piece
      const missing = shuffledA.find(card => (card.isComboPiece && !handA.includes(card)));
      if (missing) {
        handA.push(missing);
        comboGaugeA += missing.comboValue ?? 1;
        shuffledA = shuffledA.filter(c => c.id !== missing.id);
      }
    }
    // Draw cards: just draw 1 extra from deck (per spell)
    const drawersA = handA.filter(c => c.effectType === "draw");
    for (const _ of drawersA) {
      const extraDraw = shuffledA.shift();
      if (extraDraw) {
        handA.push(extraDraw);
        comboGaugeA += extraDraw.comboValue ?? 0;
      }
    }
    // Extenders: add a little bit of combo gauge to help OTK lines
    comboGaugeA += handA.filter(c => c.effectType === "extender").length * 0.5;

    // Opponent responds with negates/removal
    if (comboGaugeA >= 5 && oppNegateAvailable > 0) {
      // Negate the combo (simulate handtrap, effect veiler, etc.)
      comboGaugeA -= 2;
      oppNegateAvailable--; // Each negate is 1 use
      outcome = "negated_loss";
      winner = "B";
      break;
    } else if (comboGaugeA >= 5) {
      winner = "A";
      outcome = "combo_win";
      break;
    }

    // Repeat for opponent's play (much faster for speed)
    // (Assume negates only usable going second, simplify opponent logic)
    // Simulate effect resolution for B
    const searchersB = handB.filter(c => c.effectType === "search");
    for (const _ of searchersB) {
      const missing = shuffledB.find(card => (card.isComboPiece && !handB.includes(card)));
      if (missing) {
        handB.push(missing);
        comboGaugeB += missing.comboValue ?? 1;
        shuffledB = shuffledB.filter(c => c.id !== missing.id);
      }
    }
    const drawersB = handB.filter(c => c.effectType === "draw");
    for (const _ of drawersB) {
      const extraDraw = shuffledB.shift();
      if (extraDraw) {
        handB.push(extraDraw);
        comboGaugeB += extraDraw.comboValue ?? 0;
      }
    }
    comboGaugeB += handB.filter(c => c.effectType === "extender").length * 0.5;

    if (comboGaugeB >= 5 && playerNegateAvailable > 0) {
      comboGaugeB -= 2;
      playerNegateAvailable--;
      outcome = "grind_win"; // You survived their combo push
      winner = "A";
      break;
    } else if (comboGaugeB >= 5) {
      winner = "B";
      outcome = "opponent_combo_loss";
      break;
    }

    // If neither assembles combo, go to next turn
    turnCount++;
  }

  // Determine "grind" outcomes — if nobody OTKs or combos, decide on points
  if (!winner) {
    if (comboGaugeA > comboGaugeB) {
      winner = "A";
      outcome = "grind_win";
    } else if (comboGaugeB > comboGaugeA) {
      winner = "B";
      outcome = "grind_loss";
    } else {
      outcome = "draw";
    }
  }

  return {
    win: winner === "A",
    outcome,
    turnLength: turnCount,
    brick: brickA,
    opponentBrick: brickB,
    firstHandComboA,
    firstHandComboB,
    synergyCards,
    openingHandSig
  };
}

export function runDeckSimulation(
  deckA: Deck,
  deckB: Deck,
  simulations: number = 100
): SimulationResult {
  let wins = 0,
    losses = 0,
    draws = 0,
    totalTurnLength = 0,
    bricks = 0,
    oppBricks = 0;
  let firstHandCombo = 0,
    firstHandComboOpp = 0;
  const outcomeCounts: Record<GameOutcome, number> = {
    combo_win: 0,
    opponent_combo_loss: 0,
    brick_loss: 0,
    grind_win: 0,
    grind_loss: 0,
    negated_loss: 0,
    draw: 0,
  };

  const synergy: { [a: string]: { [b: string]: number } } = {};
  const openerCounts: Record<string, number> = {};

  // Track combos in first hands for rate
  for (let i = 0; i < simulations; i++) {
    const res = simulateGame(deckA, deckB);
    totalTurnLength += res.turnLength;

    if (res.win) wins++;
    else losses++;

    if (res.outcome === "draw") draws++;
    if (res.brick) bricks++;
    if (res.opponentBrick) oppBricks++;
    if (res.firstHandComboA) firstHandCombo++;
    if (res.firstHandComboB) firstHandComboOpp++;
    outcomeCounts[res.outcome]++;

    // Opening hand synergy
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
    openerCounts[res.openingHandSig] =
      (openerCounts[res.openingHandSig] || 0) + 1;
  }

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
    brickRate: (bricks / simulations) * 100,
    opponentBrickRate: (oppBricks / simulations) * 100,
    firstHandComboRate: (firstHandCombo / simulations) * 100,
    opponentFirstHandComboRate: (firstHandComboOpp / simulations) * 100,
    outcomeCounts,
    topOpeners,
    synergy,
  };
}
