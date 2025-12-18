// lib/api/recommend.ts
export type RecommendPayload = {
    mainDeck: number[];
    extraDeck?: number[];
    sideDeck?: number[];
    format?: string;
    targetArchetype?: string;
    playstyle?: string;
    maxResults?: number;
  };
  
  export async function getRecommendations(payload: RecommendPayload) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recommend-deck`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Optionally add auth header if protecting function
          // Authorization: `Bearer ${supabase.auth.getSession().access_token}`
        },
        body: JSON.stringify(payload),
      },
    );
  
    if (!res.ok) {
      throw new Error(`Recommend error: ${await res.text()}`);
    }
  
    return res.json() as Promise<{
      recommendations: {
        id: number;
        name: string;
        archetype: string | null;
        type: string;
        role: string;
        stats: string;
        desc: string;
      }[];
      llm: {
        ranked_ids?: number[];
        summary?: string;
        per_card_notes?: Record<number, string>;
      };
    }>;
  }
  