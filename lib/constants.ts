import { FilterConfig } from "@/types/types";

export const FLOODGATE_CARDS = [
    "Skill Drain",
    "There Can Be Only One",
    "Gozen Match",
    "Rivalry of the Warlords",
    "Anti-Spell Fragrance",
    "Imperial Order",
    "Mistake",
    "Macro Cosmos",
    "Dimensional Fissure",
    "Mind Drain",
    "Soul Drain",
    "Summon Limit",
    "Barrier Statue of the Stormwinds", // Example of a Barrier Statue
    "Secret Village of the Spellcasters",
    "Thunder King Rai-Oh",
    "Jowgen the Spiritualist",
    "Banisher of the Light",
    "Banisher of the Radiance",
    "Floodgate Trap Hole"
];

export const ROGUE_ARCHETYPE_CARDS = [
    "Exodia",
    "Ghostrick",
    "Mayakashi",
    "Timelord",
    "Volcanic",
    "Gimmick Puppet",
    "Dark Magician", // Often rogue due to nostalgia and support
    "Blue-Eyes", // Similar, often not top-tier but popular
    "Toon",
    "Ojama",
    "Naturia", // Sometimes considered rogue/gimmicky
    "U.A.",
    "F.A.",
    "Exosister",
];

export const POWERFUL_ARCHETYPE_CARDS = [
    "Tearlaments",
    "Branded",
    "Kashtira",
    "Swordsoul",
    "Sky Striker",
    "Eldlich",
    "Drytron",
    "Tri-Brigade",
    "Spright",
    "Runick",
    "Mathmech",
    "Purrely",
    "Labrynth"
];

// --------- FILTERS ---------
const CARD_TYPES_FILTERS = [
  { value: "Effect Monster", label: "Effect" },
  { value: "Normal Monster", label: "Normal" },
  { value: "Fusion Monster", label: "Fusion" },
  { value: "Synchro Monster", label: "Synchro" },
  { value: "Xyz Monster", label: "Xyz" },
  { value: "Link Monster", label: "Link" },
  { value: "Spell Card", label: "Spell" },
  { value: "Trap Card", label: "Trap" },
];

const CARD_ATTRIBUTES_FILTERS = [
  { value: "DARK", label: "DARK" },
  { value: "LIGHT", label: "LIGHT" },
  { value: "EARTH", label: "EARTH" },
  { value: "WATER", label: "WATER" },
  { value: "FIRE", label: "FIRE" },
  { value: "WIND", label: "WIND" },
  { value: "DIVINE", label: "DIVINE" },
];

const CARD_ATK_RANGE_FILTERS = [
    { value: "lt1000", label: "< 1000" },
    { value: "lt2000", label: "1000+" },
    { value: "lt3000", label: "2000+" },
    { value: "lt4000", label: "3000+" },
    { value: "lt5000", label: "4000+" },
    { value: "?", label: "?" },
];

const CARD_DEF_RANGE_FILTERS = [
    { value: "lt1000", label: "< 1000" },
    { value: "lt2000", label: "1000+" },
    { value: "lt3000", label: "2000+" },
    { value: "lt4000", label: "3000+" },
    { value: "lt5000", label: "4000+" },
    { value: "?", label: "?" },
];

const CARD_RACE_FILTERS = [
    { value: "Beast", label: "Beast" },
    { value: "Beast-Warrior", label: "Beast-Warrior" },
    { value: "Dinosaur", label: "Dinosaur" },
    { value: "Divine-Beast", label: "Divine-Beast" },
    { value: "Dragon", label: "Dragon" },
    { value: "Fairy", label: "Fairy" },
    { value: "Fiend", label: "Fiend" },
    { value: "Insect", label: "Insect" },
    { value: "Machine", label: "Machine" },
    { value: "Plant", label: "Plant" },
    { value: "Psychic", label: "Psychic" },
    { value: "Pyro", label: "Pyro" },
    { value: "Reptile", label: "Reptile" },
    { value: "Rock", label: "Rock" },
    { value: "Sea Serpent", label: "Sea Serpent" },
    { value: "Spellcaster", label: "Spellcaster" },
    { value: "Thunder", label: "Thunder" },
    { value: "Warrior", label: "Warrior" },
    { value: "Winged Beast", label: "Winged Beast" },
    { value: "Wyrm", label: "Wyrm" },
    { value: "Zombie", label: "Zombie" },
];

const CARD_RARITY_FILTERS = [
    { value: "Normal", label: "N" },
    { value: "Uncommon", label: "U" },
    { value: "Rare", label: "R" },
    { value: "Ultra Rare", label: "UR" },
];

const CARD_LEVEL_FILTERS = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "5" },
    { value: "6", label: "6" },
    { value: "7", label: "7" },
    { value: "8", label: "8" },
    { value: "9", label: "9" },
    { value: "10", label: "10" },
    { value: "11", label: "11" },
    { value: "12", label: "12" },
];

export const ATK_RANGE_MAP: Record<string, [number, number]> = {
  lt1000: [0, 999],
  lt2000: [1000, 1999],
  lt3000: [2000, 2999],
  lt4000: [3000, 3999],
  lt5000: [4000, 5000],
};

export const DEF_RANGE_MAP: Record<string, [number, number]> = {
  lt1000: [0, 999],
  lt2000: [1000, 1999],
  lt3000: [2000, 2999],
  lt4000: [3000, 3999],
  lt5000: [4000, 5000],
};


// -------- FILTER CONFIGS --------

export const FILTER_CONFIGS: FilterConfig[] = [
  { label: "Card Type", key: "type", options: CARD_TYPES_FILTERS },
  { label: "Attribute", key: "attribute", options: CARD_ATTRIBUTES_FILTERS },
  { label: "ATK Range", key: "atkRange", options: CARD_ATK_RANGE_FILTERS },
  { label: "DEF Range", key: "defRange", options: CARD_DEF_RANGE_FILTERS },
  { label: "Race", key: "race", options: CARD_RACE_FILTERS },
  { label: "Rarity", key: "rarity", options: CARD_RARITY_FILTERS },
  { label: "Level", key: "level", options: CARD_LEVEL_FILTERS },
  { label: "Archetype", key: "archetype", options: [] },
];