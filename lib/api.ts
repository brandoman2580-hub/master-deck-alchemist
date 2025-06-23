import { Card, CardSearchParams } from "@/types/card"
import { BanStatus } from "@/types/types"

const API_BASE_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php"

export async function searchCards(params: CardSearchParams): Promise<Card[]> {
  const queryParams = new URLSearchParams()

  if (params.name) queryParams.append("fname", params.name)
  if (params.type) queryParams.append("type", params.type)
  if (params.race) queryParams.append("race", params.race)
  if (params.attribute) queryParams.append("attribute", params.attribute)
  if (params.level) queryParams.append("level", params.level)
  if (params.atk) queryParams.append("atk", params.atk)
  if (params.def) queryParams.append("def", params.def)
  if (params.archetype) queryParams.append("archetype", params.archetype)
  if (params.misc) queryParams.append("misc", params.misc)

  // For effect search, we'll filter the results client-side

  const url = `${API_BASE_URL}?${queryParams.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    let cards = data.data as Card[]

    // Filter by effect text if provided
    if (params.effect && params.effect.trim() !== "") {
      const effectLower = params.effect.toLowerCase()
      cards = cards.filter((card) => card.desc.toLowerCase().includes(effectLower))
    }

    // Sort results if sort parameter is provided
    if (params.sort) {
      cards = sortCards(cards, params.sort, params.sortDirection || "asc")
    }

    return cards
  } catch (error) {
    console.error("Error fetching cards:", error)
    return []
  }
}

export async function getCardById(id: number): Promise<Card | null> {
  try {
    const response = await fetch(`${API_BASE_URL}?id=${id}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data[0] as Card
  } catch (error) {
    console.error("Error fetching card:", error)
    return null
  }
}

export async function getCardTypes(): Promise<string[]> {
  try {
    const response = await fetch("https://db.ygoprodeck.com/api/v7/cardtypes.php")
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.map((item: { type: string }) => item.type)
  } catch (error) {
    console.error("Error fetching card types:", error)
    return []
  }
}

export async function getCardRaces(): Promise<string[]> {
  try {
    const response = await fetch("https://db.ygoprodeck.com/api/v7/races.php")
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.map((item: { race: string }) => item.race)
  } catch (error) {
    console.error("Error fetching card races:", error)
    return []
  }
}

export async function getCardAttributes(): Promise<string[]> {
  try {
    const response = await fetch("https://db.ygoprodeck.com/api/v7/attributes.php")
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching card attributes:", error)
    return []
  }
}


function sortCards(cards: Card[], sortBy: string, direction: "asc" | "desc"): Card[] {
  return [...cards].sort((a, b) => {
    let valueA;
    let valueB;

    switch (sortBy) {
      case "name":
        valueA = a.name
        valueB = b.name
        break
      case "atk":
        valueA = a.atk || 0
        valueB = b.atk || 0
        break
      case "def":
        valueA = a.def || 0
        valueB = b.def || 0
        break
      case "level":
        valueA = a.level || 0
        valueB = b.level || 0
        break
      default:
        return 0
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return direction === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA)
    } else {
      return direction === "asc" ? (valueA as number) - (valueB as number) : (valueB as number) - (valueA as number)
    }
  })
}

export interface BanlistEntry {
  id: number;
  name: string;
  banStatus: BanStatus;
}

export async function getTCGBanlist(): Promise<Record<string, BanStatus>> {
  const url = "https://db.ygoprodeck.com/api/v7/cardinfo.php?banlist=TCG";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    const banlist: Record<string, BanStatus> = {};
    for (const card of data.data) {
      if (card.banlist_info && card.banlist_info.ban_tcg) {
        banlist[card.name] = card.banlist_info.ban_tcg as BanStatus;
      }
    }
    return banlist;
  } catch (error) {
    console.error("Error fetching Master Duel banlist:", error);
    return {};
  }
}