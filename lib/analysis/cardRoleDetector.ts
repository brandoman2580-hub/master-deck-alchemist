import { Card } from "@/types/card";

export type CardRole = 
  | 'starter' 
  | 'extender' 
  | 'interruption' 
  | 'board_breaker' 
  | 'end_board_piece'
  | 'generic';

/**
 * Detect the role(s) a card plays in a deck based on its description
 */
export function detectCardRole(card: Card): CardRole[] {
  const roles: CardRole[] = [];
  const desc = (card.desc || "").toLowerCase();
  
  // Starter detection: cards that search/summon from deck
  if (
    desc.includes('search') || 
    (desc.includes('add') && desc.includes('deck')) ||
    (desc.includes('special summon') && desc.includes('deck'))
  ) {
    roles.push('starter');
  }
  
  // Extender detection: cards that continue combos
  if (
    (desc.includes('special summon') && (desc.includes('hand') || desc.includes('gy'))) ||
    desc.includes('send to') ||
    desc.includes('mill') ||
    (desc.includes('discard') && desc.includes('draw'))
  ) {
    roles.push('extender');
  }
  
  // Interruption detection: hand traps, quick effects that negate
  if (
    ((desc.includes('negate') || desc.includes('destroy')) && 
     (desc.includes('quick effect') || desc.includes('opponent'))) ||
    (desc.includes('hand') && desc.includes('quick effect'))
  ) {
    roles.push('interruption');
  }
  
  // Board breaker detection: cards that clear opponent's board
  if (
    desc.includes('destroy all') || 
    desc.includes('banish all') || 
    desc.includes('return all') ||
    desc.includes('send all') ||
    (desc.includes('destroy') && desc.includes('opponent'))
  ) {
    roles.push('board_breaker');
  }
  
  // Boss monster detection: high ATK, protection effects
  if (
    ((desc.includes('cannot be') || desc.includes('unaffected')) && 
     card.type.includes('Monster')) ||
    (card.atk && Number(card.atk) >= 2500 && desc.includes('negate'))
  ) {
    roles.push('end_board_piece');
  }
  
  // Return generic if no roles detected
  return roles.length > 0 ? roles : ['generic'];
}

/**
 * Count cards by role in a deck section
 */
export function countCardsByRole(
  cards: Card[],
  role: CardRole
): number {
  return cards.filter(card => detectCardRole(card).includes(role)).length;
}
