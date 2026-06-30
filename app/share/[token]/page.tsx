"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDeckShare } from "@/lib/api/deckShare";
import { useDeck } from "@/context/deck-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye, Edit2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useCardStore } from "@/store/cardStore";
import type { DeckCard, DeckType } from "@/types/types";
import Image from "next/image";
import { DeckCostDisplay } from "@/components/deck-builder/deck-cost-display";
import { resolveCardImageUrl } from "@/lib/card-image-url";
import { useMasterDuelRarity } from "@/hooks/useMasterDuelRarity";

function SharePageDeckCost({ deck }: { deck: DeckType }) {
  const deckMode = deck.mode ?? "Master Duel";
  const cardIds = [
    ...deck.mainDeck,
    ...deck.extraDeck,
    ...deck.sideDeck,
  ].map((c) => c.id);
  const mdRarityMap = useMasterDuelRarity(cardIds, deckMode);
  return (
    <DeckCostDisplay
      deck={deck}
      deckMode={deckMode}
      mdRarityMap={mdRarityMap}
    />
  );
}

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { setCurrentDeck } = useDeck();
  const cardList = useCardStore((state) => state.cardList);
  
  const [status, setStatus] = useState<"loading" | "preview" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [previewDeck, setPreviewDeck] = useState<DeckType | null>(null);
  const [customDeckName, setCustomDeckName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    async function loadShare() {
      if (!token) {
        setStatus("error");
        setErrorMessage("Invalid share link");
        return;
      }

      try {
        const result = await getDeckShare(token);

        if (result.success && result.deck) {
          // Convert the shared deck format to DeckType format
          // Load full card data from card store using cardId
          const findCardById = (cardId: number) => {
            return cardList.find((c) => c.id === cardId);
          };

          const mapToDeckCard = (card: { cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }): DeckCard => {
            const fullCard = findCardById(card.cardId);
            if (fullCard) {
              // Ensure all required fields are properly initialized
              // Handle null, undefined, or invalid card_images
              const safeCardImages = (fullCard.card_images != null && Array.isArray(fullCard.card_images) && fullCard.card_images.length > 0)
                ? fullCard.card_images
                : [];
              const safeCardPrices = (fullCard.card_prices != null && Array.isArray(fullCard.card_prices))
                ? fullCard.card_prices
                : [];
              const safeMiscInfo: [{ md_rarity: string }] = (fullCard.misc_info != null && Array.isArray(fullCard.misc_info) && fullCard.misc_info.length > 0 && fullCard.misc_info[0] != null)
                ? [{ md_rarity: fullCard.misc_info[0].md_rarity || "" }]
                : [{ md_rarity: "" }];
              const safeCardSets = (fullCard.card_sets != null && typeof fullCard.card_sets === 'object' && !Array.isArray(fullCard.card_sets))
                ? fullCard.card_sets
                : {
                    set_name: "",
                    set_code: "",
                    set_rarity: "",
                    set_rarity_code: "",
                    set_price: "",
                  };

              return {
                ...fullCard,
                deckInstanceId: card.deckInstanceId || uuidv4(),
                card_images: safeCardImages,
                card_prices: safeCardPrices,
                misc_info: safeMiscInfo,
                card_sets: safeCardSets,
              };
            }
            // Fallback: create minimal card if not found in store
            return {
              id: card.cardId,
              deckInstanceId: card.deckInstanceId || uuidv4(),
              name: card.name,
              type: card.type || "",
              desc: card.desc || "",
              race: "",
              misc_info: [{ md_rarity: "" }],
              card_sets: {
                set_name: "",
                set_code: "",
                set_rarity: "",
                set_rarity_code: "",
                set_price: "",
              },
              card_images: [],
              card_prices: [],
            };
          };

          const deckData = {
            id: uuidv4(),
            name: result.deck.name || "Imported Deck",
            mainDeck: result.deck.mainDeck.map(mapToDeckCard),
            extraDeck: result.deck.extraDeck.map(mapToDeckCard),
            sideDeck: result.deck.sideDeck.map(mapToDeckCard),
            mode: result.deck.mode,
            isPinned: false,
          };

          setPreviewDeck(deckData);
          setCustomDeckName(result.deck.name || "Imported Deck");
          setStatus("preview");
        } else {
          setStatus("error");
          setErrorMessage("Failed to load deck");
        }
      } catch (error) {
        // Error loading share
        setStatus("error");
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load deck share. The link may be expired or invalid.");
        }
      }
    }

    loadShare();
  }, [token, setCurrentDeck, router, cardList]);

  function handleImport() {
    if (!previewDeck) return;

    const finalDeckName = customDeckName.trim() || previewDeck.name || "Imported Deck";
    const deckToImport: DeckType = {
      ...previewDeck,
      name: finalDeckName,
    };

    setCurrentDeck(deckToImport);
    setStatus("success");

    // Redirect to deck builder immediately
    router.push("/deck-builder");
  }

  function getCardImageUrl(card: DeckCard): string | null {
    const url = resolveCardImageUrl(card.id, card.card_images, {
      preferSmall: false,
    });
    return url === "/placeholder.svg" ? null : url;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="bg-white/10 border border-white/20 backdrop-blur-xl p-8 max-w-md w-full">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Loading deck...</h2>
            <p className="text-sm text-white/70 text-center">
              Please wait while we load the deck from the share link.
            </p>
          </div>
        )}

        {status === "preview" && previewDeck && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Preview Deck</h2>
            </div>

            {/* Deck Name Editor */}
            <div className="space-y-2">
              <Label htmlFor="deck-name">Deck Name</Label>
              <div className="flex gap-2">
                <Input
                  id="deck-name"
                  value={customDeckName}
                  onChange={(e) => setCustomDeckName(e.target.value)}
                  onFocus={() => setIsEditingName(true)}
                  className="bg-white/5 border-white/20 text-white"
                  placeholder="Enter deck name"
                />
                {isEditingName && (
                  <Button
                    onClick={() => setIsEditingName(false)}
                    size="icon"
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Deck Info */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{previewDeck.mainDeck.length}</div>
                <div className="text-white/70 mt-1">Main Deck</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{previewDeck.extraDeck.length}</div>
                <div className="text-white/70 mt-1">Extra Deck</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-cyan-400">{previewDeck.sideDeck.length}</div>
                <div className="text-white/70 mt-1">Side Deck</div>
              </div>
            </div>

            {/* Deck Mode */}
            <div className="text-sm text-white/70">
              <span className="font-medium">Mode:</span> {previewDeck.mode}
            </div>

            {/* Deck Cost */}
            <SharePageDeckCost deck={previewDeck} />

            {/* Card Preview - Show first few cards */}
            {previewDeck.mainDeck.length > 0 && (
              <div className="space-y-2">
                <Label>Preview Cards</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {previewDeck.mainDeck.slice(0, 8).map((card, idx) => {
                    const imageUrl = getCardImageUrl(card);
                    return (
                      <div
                        key={`${card.deckInstanceId}-${idx}`}
                        className="flex-shrink-0 w-12 h-16 relative rounded overflow-hidden bg-white/5 border border-white/10"
                      >
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={card.name}
                            fill
                            className="object-contain"
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-white/50">
                            {card.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {previewDeck.mainDeck.length > 8 && (
                    <div className="flex-shrink-0 w-12 h-16 flex items-center justify-center bg-white/5 border border-white/10 rounded text-xs text-white/50">
                      +{previewDeck.mainDeck.length - 8}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => router.push("/deck-builder")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                className="flex-1"
              >
                Import Deck
              </Button>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <h2 className="text-xl font-semibold text-white">Deck loaded successfully!</h2>
            <p className="text-sm text-white/70 text-center">
              {customDeckName && `"${customDeckName}" has been loaded into your deck builder.`}
            </p>
            <div className="w-full max-w-xs mt-4">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
            </div>
            <p className="text-xs text-white/50 text-center">
              Redirecting to deck builder...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-red-400" />
            <h2 className="text-xl font-semibold text-white">Failed to load deck</h2>
            <div className="flex items-start gap-2 bg-red-500/20 border border-red-500/50 rounded-lg p-3 w-full">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/90 text-left">
                {errorMessage || "The share link may be expired, invalid, or the deck may have been deleted."}
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => router.push("/deck-builder")}
                className="flex-1"
              >
                Go to Deck Builder
              </Button>
              <Button
                onClick={() => router.push("/")}
                className="flex-1"
              >
                Go Home
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
