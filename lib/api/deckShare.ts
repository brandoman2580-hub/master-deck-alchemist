import { DeckType } from "@/types/types";
import type { DeckCard } from "@/types/types";
import { getAccessToken } from "@/lib/supabaseClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL must be defined");
}

export interface CreateDeckShareRequest {
  deck: {
    name: string;
    mainDeck: Array<{ cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }> | DeckType["mainDeck"];
    extraDeck: Array<{ cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }> | DeckType["extraDeck"];
    sideDeck: Array<{ cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }> | DeckType["sideDeck"];
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

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-deck-share`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Failed to create share",
    }));
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
