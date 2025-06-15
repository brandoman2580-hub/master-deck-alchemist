import { Card } from "./card"

export type NormalizedDeck = {
    mainDeck: string[];
    extraDeck: string[];
    sideDeck: string[];
};

export type DeckType = {
    mainDeck: Card[]
    extraDeck: Card[]
    sideDeck: Card[]
}

type DeckListByCategory = {
    Monster?: string[]
    Spell?: string[]
    Trap?: string[]
}

export type CountedCard = {
    name: string
    count: number
}

// Acceptable import formats
export type DeckFormat1 = { // { Monster, Spell, Trap, Extra, Side }
    Monster?: string[]
    Spell?: string[]
    Trap?: string[]
    Extra?: string[]
    Side?: string[]
}

export type DeckFormat2 = { // { mainDeck: { Monster, Spell, Trap }, extraDeck, sideDeck }
    mainDeck: DeckListByCategory
    extraDeck?: string[]
    sideDeck?: string[]
}

export type DeckFormat3 = { // { mainDeck: string[] | CountedCard[], extraDeck, sideDeck }
    mainDeck?: (string | CountedCard)[]
    extraDeck?: (string | CountedCard)[]
    sideDeck?: (string | CountedCard)[]
}

export type DeckFormat4 = { // { main, extra, side }
    main?: string[]
    extra?: string[]
    side?: string[]
}

export type ImportedDeck = DeckFormat1 | DeckFormat2 | DeckFormat3 | DeckFormat4

export type BanStatus = "Forbidden" | "Limited" | "Semi-Limited" | "Unlimited" | undefined;