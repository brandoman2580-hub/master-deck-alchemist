import type { DeckType } from "@/types/deck";
import type { DeckCard } from "@/types/deck";
import { getAccessToken } from "@/lib/supabaseClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL must be defined");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ShareDeckCard {
  cardId: number;
  deckInstanceId?: string;
  name: string;
  type?: string;
  desc?: string;
}

export interface CreateDeckShareRequest {
  deck: {
    name: string;
    mainDeck: Array<ShareDeckCard | DeckType["mainDeck"][number]>;
    extraDeck: Array<ShareDeckCard | DeckType["extraDeck"][number]>;
    sideDeck: Array<ShareDeckCard | DeckType["sideDeck"][number]>;
    mode: DeckType["mode"];
  };
  options?: {
    expiresInDays?: number;
    maxAccessCount?: number;
  };
}

export interface CreateDeckShareResponse {
  success: boolean;
  shareToken: string;
  shareUrl: string;
  expiresAt: string | null;
  maxAccessCount: number | null;
  createdAt: string;
}

export type DeckShareCardPayload = {
  cardId: number;
  deckInstanceId?: string;
  name: string;
  type?: string;
  desc?: string;
};

export function mapDeckCardToSharePayload(card: DeckCard): DeckShareCardPayload {
  return {
    cardId: card.id,
    deckInstanceId: card.deckInstanceId,
    name: card.name,
    type: card.type,
    desc: card.desc,
  };
}

export function toDeckShareRequest(
  deck: DeckType,
): CreateDeckShareRequest["deck"] {
  return {
    name: deck.name,
    mainDeck: deck.mainDeck.map(mapDeckCardToSharePayload),
    extraDeck: deck.extraDeck.map(mapDeckCardToSharePayload),
    sideDeck: deck.sideDeck.map(mapDeckCardToSharePayload),
    mode: deck.mode,
  };
}

export function getDeckShareFullUrl(shareUrl: string): string {
  if (/^https?:\/\//i.test(shareUrl)) {
    return shareUrl;
  }

  const path = shareUrl.startsWith("/") ? shareUrl : `/${shareUrl}`;
  const base =
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL ||
        process.env.PUBLIC_URL ||
        window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_URL) || "";

  return `${base}${path}`;
}

export interface GetDeckShareResponse {
  success: boolean;
  deck: {
    name: string;
    mainDeck: Array<{
      cardId: number;
      deckInstanceId?: string;
      name: string;
      type?: string;
      desc?: string;
    }>;
    extraDeck: Array<{
      cardId: number;
      deckInstanceId?: string;
      name: string;
      type?: string;
      desc?: string;
    }>;
    sideDeck: Array<{
      cardId: number;
      deckInstanceId?: string;
      name: string;
      type?: string;
      desc?: string;
    }>;
    mode: "Master Duel" | "TCG";
  };
  metadata: {
    deckName: string;
    deckMode: "Master Duel" | "TCG";
    createdAt: string;
    expiresAt: string | null;
    accessCount: number;
    maxAccessCount: number | null;
  } | null;
}

type LooseShareCard = {
  cardId?: number;
  id?: number;
  deckInstanceId?: string;
  name?: string;
  type?: string;
  desc?: string;
};

/**
 * Edge function expects `cardId`; archived/workshop decks store `id`.
 * Normalize either shape into the API payload.
 */
export function normalizeShareDeckCards(
  cards: Array<ShareDeckCard | DeckType["mainDeck"][number] | LooseShareCard>,
): ShareDeckCard[] {
  return cards.map((raw, index) => {
    const card = raw as LooseShareCard;
    const cardId = card.cardId ?? card.id;
    if (
      typeof cardId !== "number" ||
      !Number.isSafeInteger(cardId) ||
      cardId <= 0
    ) {
      throw new Error(
        `Cannot share deck: card at index ${index} is missing a valid id.`,
      );
    }

    const name =
      typeof card.name === "string" && card.name.trim().length > 0
        ? card.name.trim()
        : `Card ${cardId}`;

    const normalized: ShareDeckCard = { cardId, name };

    if (
      typeof card.deckInstanceId === "string" &&
      UUID_RE.test(card.deckInstanceId)
    ) {
      normalized.deckInstanceId = card.deckInstanceId;
    }
    if (typeof card.type === "string" && card.type.length > 0) {
      normalized.type = card.type;
    }
    if (typeof card.desc === "string" && card.desc.length > 0) {
      normalized.desc = card.desc;
    }

    return normalized;
  });
}

/**
 * Create a shareable link for a deck
 */
export async function createDeckShare(
  request: CreateDeckShareRequest,
): Promise<CreateDeckShareResponse> {
  const token = await getAccessToken();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Supabase Edge Functions require apikey header
  if (anonKey) {
    headers["apikey"] = anonKey;
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const payload = {
    deck: {
      name: request.deck.name,
      mainDeck: normalizeShareDeckCards(request.deck.mainDeck),
      extraDeck: normalizeShareDeckCards(request.deck.extraDeck),
      sideDeck: normalizeShareDeckCards(request.deck.sideDeck),
      mode: request.deck.mode,
    },
    options: request.options,
  };

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-deck-share`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      error: "Failed to create share",
    }))) as { error?: string; details?: unknown };
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get deck data from a share token
 */
export async function getDeckShare(
  token: string,
): Promise<GetDeckShareResponse> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Supabase Edge Functions require apikey header and Authorization header
  if (anonKey) {
    headers["apikey"] = anonKey;
    headers["Authorization"] = `Bearer ${anonKey}`;
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/get-deck-share/${token}`,
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Failed to retrieve share",
    }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Revoke a deck share (requires authentication)
 */
export async function revokeDeckShare(
  token: string,
): Promise<{ success: boolean }> {
  const userToken = await getAccessToken();
  if (!userToken) {
    throw new Error("Authentication required to revoke shares");
  }

  // Get user ID
  const { supabase } = await import("@/lib/supabaseClient");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/revoke_shared_deck`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        token,
        user_id: user.id,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Failed to revoke share",
    }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
