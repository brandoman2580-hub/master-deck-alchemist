/**
 * Archetype Knowledge Base
 * Contains knowledge about popular Yu-Gi-Oh! archetypes including key mechanics, related terms, and core cards
 */

export interface ArchetypeKnowledge {
  name: string;
  keyMechanics: string[];
  relatedTerms: string[];
  coreCards: string[];
  playstyle?: "Combo" | "Midrange" | "Control" | "Stun" | "Beatdown";
}

/**
 * Archetype knowledge base with 20+ popular archetypes
 */
export const ARCHETYPE_KNOWLEDGE: ArchetypeKnowledge[] = [
  {
    name: "Branded",
    keyMechanics: ["Fusion", "Fallen of Albaz", "Despia", "Bystial"],
    relatedTerms: ["Fusion Summon", "Albaz", "Despia", "Bystial", "Branded Fusion", "Mirrorjade"],
    coreCards: ["Fallen of Albaz", "Branded Fusion", "Despian Tragedy", "Mirrorjade the Iceblade Dragon"],
    playstyle: "Midrange",
  },
  {
    name: "Snake-Eye",
    keyMechanics: ["Fire", "Synchro", "Link", "Poplar"],
    relatedTerms: ["Snake-Eye", "Fire", "Poplar", "Diabellstar", "Synchro", "Link"],
    coreCards: ["Snake-Eye Poplar", "Diabellstar the Black Witch", "Snake-Eye Ash"],
    playstyle: "Combo",
  },
  {
    name: "Kashtira",
    keyMechanics: ["Xyz", "Banish", "Zone Lock"],
    relatedTerms: ["Kashtira", "Xyz", "Banish", "Zone Lock", "Shangri-Ira", "Unicorn"],
    coreCards: ["Kashtira Unicorn", "Kashtira Shangri-Ira", "Kashtira Birth"],
    playstyle: "Control",
  },
  {
    name: "Tearlaments",
    keyMechanics: ["Fusion", "Mill", "Graveyard"],
    relatedTerms: ["Tearlaments", "Fusion", "Mill", "Graveyard", "Kitkallos", "Havnis"],
    coreCards: ["Tearlaments Kitkallos", "Tearlaments Havnis", "Tearlaments Reinoheart"],
    playstyle: "Combo",
  },
  {
    name: "Spright",
    keyMechanics: ["Level 2", "Xyz", "Link"],
    relatedTerms: ["Spright", "Level 2", "Xyz", "Link", "Gigantic", "Elf"],
    coreCards: ["Spright Blue", "Spright Starter", "Spright Gigantic", "I:P Masquerena"],
    playstyle: "Combo",
  },
  {
    name: "Runick",
    keyMechanics: ["Quick-Play", "Banish", "Draw"],
    relatedTerms: ["Runick", "Quick-Play", "Banish", "Draw", "Hugin", "Fountain"],
    coreCards: ["Runick Fountain", "Runick Hugin", "Runick Slumber"],
    playstyle: "Control",
  },
  {
    name: "Purrely",
    keyMechanics: ["Xyz", "Quick-Play", "Draw"],
    relatedTerms: ["Purrely", "Xyz", "Quick-Play", "Draw", "Sleepy Memory", "Pretty Memory"],
    coreCards: ["Purrely", "Purrely Sleepy Memory", "Purrely Pretty Memory"],
    playstyle: "Combo",
  },
  {
    name: "Labrynth",
    keyMechanics: ["Trap", "Normal Trap", "Furniture"],
    relatedTerms: ["Labrynth", "Trap", "Normal Trap", "Furniture", "Lovely", "Welcome"],
    coreCards: ["Labrynth Archfiend", "Welcome Labrynth", "Lovely Labrynth"],
    playstyle: "Control",
  },
  {
    name: "Swordsoul",
    keyMechanics: ["Synchro", "Wyrm", "Token"],
    relatedTerms: ["Swordsoul", "Synchro", "Wyrm", "Token", "Mo Ye", "Chixiao"],
    coreCards: ["Swordsoul of Mo Ye", "Swordsoul Grandmaster - Chixiao", "Swordsoul Emergence"],
    playstyle: "Midrange",
  },
  {
    name: "Mathmech",
    keyMechanics: ["Cyberse", "Link", "Xyz", "Math"],
    relatedTerms: ["Mathmech", "Cyberse", "Link", "Xyz", "Circular", "Final Sigma"],
    coreCards: ["Mathmech Circular", "Mathmech Final Sigma", "Mathmech Diameter"],
    playstyle: "Combo",
  },
  {
    name: "Sky Striker",
    keyMechanics: ["Spell", "Link", "Widow Anchor"],
    relatedTerms: ["Sky Striker", "Spell", "Link", "Widow Anchor", "Raye", "Kagari"],
    coreCards: ["Sky Striker Ace - Raye", "Sky Striker Ace - Kagari", "Sky Striker Mecha - Widow Anchor"],
    playstyle: "Control",
  },
  {
    name: "Dragon Link",
    keyMechanics: ["Dragon", "Link", "Dark", "Combo"],
    relatedTerms: ["Dragon", "Link", "Dark", "Rokket", "Striker Dragon", "Borreload"],
    coreCards: ["Rokket Tracer", "Striker Dragon", "Borreload Savage Dragon"],
    playstyle: "Combo",
  },
  {
    name: "Pendulum Magician",
    keyMechanics: ["Pendulum", "Spellcaster", "Synchro", "Xyz"],
    relatedTerms: ["Pendulum", "Spellcaster", "Magician", "Astrograph", "Double Iris"],
    coreCards: ["Astrograph Sorcerer", "Double Iris Magician", "Harmonizing Magician"],
    playstyle: "Combo",
  },
  {
    name: "Eldlich",
    keyMechanics: ["Zombie", "Trap", "Golden Land"],
    relatedTerms: ["Eldlich", "Zombie", "Trap", "Golden Land", "Conquistador", "Huaquero"],
    coreCards: ["Eldlich the Golden Lord", "Eldlixir of Scarlet Sanguine", "Conquistador of the Golden Land"],
    playstyle: "Control",
  },
  {
    name: "Drytron",
    keyMechanics: ["Ritual", "Machine", "Fairy"],
    relatedTerms: ["Drytron", "Ritual", "Machine", "Fairy", "Alpha", "Mu Beta"],
    coreCards: ["Drytron Alpha Thuban", "Drytron Mu Beta Fafnir", "Megalith Phul"],
    playstyle: "Combo",
  },
  {
    name: "Virtual World",
    keyMechanics: ["Psychic", "Xyz", "Synchro", "Level 3/6/9"],
    relatedTerms: ["Virtual World", "Psychic", "Xyz", "Synchro", "Lulu", "Chuche"],
    coreCards: ["Virtual World Hime - Nyannyan", "Virtual World Gate - Chuche", "Virtual World Kyubi - Shenshen"],
    playstyle: "Combo",
  },
  {
    name: "Tri-Brigade",
    keyMechanics: ["Beast", "Beast-Warrior", "Winged Beast", "Link"],
    relatedTerms: ["Tri-Brigade", "Beast", "Beast-Warrior", "Winged Beast", "Fraktall", "Revolt"],
    coreCards: ["Tri-Brigade Fraktall", "Tri-Brigade Revolt", "Tri-Brigade Shuraig"],
    playstyle: "Midrange",
  },
  {
    name: "Dogmatika",
    keyMechanics: ["Ritual", "Spellcaster", "Extra Deck"],
    relatedTerms: ["Dogmatika", "Ritual", "Spellcaster", "Ecclesia", "Maximus", "Nadir"],
    coreCards: ["Dogmatika Ecclesia", "Dogmatika Maximus", "Dogmatika Nexus"],
    playstyle: "Control",
  },
  {
    name: "Floowandereeze",
    keyMechanics: ["Winged Beast", "Normal Summon", "Tribute"],
    relatedTerms: ["Floowandereeze", "Winged Beast", "Normal Summon", "Tribute", "Empen", "Robina"],
    coreCards: ["Floowandereeze & Robina", "Floowandereeze & Empen", "Floowandereeze and the Dreaming Town"],
    playstyle: "Stun",
  },
  {
    name: "Despia",
    keyMechanics: ["Fusion", "Dark", "Theater"],
    relatedTerms: ["Despia", "Fusion", "Dark", "Theater", "Quaeritis", "Ad Libitum"],
    coreCards: ["Despian Quaeritis", "Despian Tragedy", "Branded Opening"],
    playstyle: "Midrange",
  },
  {
    name: "Prank-Kids",
    keyMechanics: ["Link", "Fusion", "Effect"],
    relatedTerms: ["Prank-Kids", "Link", "Fusion", "Meow-Meow", "Dodo-Dodo", "Rocksies"],
    coreCards: ["Prank-Kids Meow-Meow-Mu", "Prank-Kids Dodo-Dodo-Duck", "Prank-Kids Rocksies"],
    playstyle: "Combo",
  },
];

/**
 * Find archetype knowledge by name (case-insensitive, partial match)
 */
export function findArchetypeKnowledge(archetypeName: string): ArchetypeKnowledge | undefined {
  const normalized = archetypeName.toLowerCase().trim();
  return ARCHETYPE_KNOWLEDGE.find(
    (arch) =>
      arch.name.toLowerCase() === normalized ||
      arch.name.toLowerCase().includes(normalized) ||
      normalized.includes(arch.name.toLowerCase()),
  );
}

/**
 * Get all related terms for an archetype
 */
export function getArchetypeTerms(archetypeName: string): string[] {
  const knowledge = findArchetypeKnowledge(archetypeName);
  if (!knowledge) return [];

  return [
    ...knowledge.keyMechanics,
    ...knowledge.relatedTerms,
    ...knowledge.coreCards,
  ];
}
