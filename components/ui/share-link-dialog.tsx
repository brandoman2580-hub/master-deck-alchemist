"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, ExternalLink, Calendar, Users, QrCode, Trash2, RefreshCw } from "lucide-react";
import { createDeckShare, getDeckShare, revokeDeckShare, type CreateDeckShareResponse } from "@/lib/api/deckShare";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QRCodeSVG } from "qrcode.react";
import { useUserStore } from "@/store/useUserStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckName: string;
  deckData: {
    name: string;
    mainDeck: Array<{ cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }>;
    extraDeck: Array<{ cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }>;
    sideDeck: Array<{ cardId: number; deckInstanceId?: string; name: string; type?: string; desc?: string }>;
    mode: "Master Duel" | "TCG";
  };
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  deckName,
  deckData,
}: ShareLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<CreateDeckShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [maxAccessCount, setMaxAccessCount] = useState<number | "">("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [accessCount, setAccessCount] = useState<number | null>(null);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const user = useUserStore((state) => state.user);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (open && !shareData && !loading) {
      createShare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setShareData(null);
      setError(null);
      setCopied(false);
      setExpiresInDays(30);
      setMaxAccessCount("");
      setShowQRCode(false);
      setAccessCount(null);
      setTimeRemaining("");
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [open]);

  // Update countdown timer
  useEffect(() => {
    if (!shareData?.expiresAt) {
      setTimeRemaining("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(shareData.expiresAt!).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining("Expired");
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [shareData?.expiresAt]);

  // Fetch metadata when share is created
  useEffect(() => {
    if (shareData?.shareToken) {
      fetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareData?.shareToken]);

  async function createShare() {
    setLoading(true);
    setError(null);

    try {
      // Convert simplified card format to full DeckCard format expected by API
      // The API will sanitize this further, so we just need to match the type
      const result = await createDeckShare({
        deck: {
          name: deckData.name,
          mainDeck: deckData.mainDeck as Parameters<typeof createDeckShare>[0]["deck"]["mainDeck"],
          extraDeck: deckData.extraDeck as Parameters<typeof createDeckShare>[0]["deck"]["extraDeck"],
          sideDeck: deckData.sideDeck as Parameters<typeof createDeckShare>[0]["deck"]["sideDeck"],
          mode: deckData.mode,
        },
        options: {
          expiresInDays: expiresInDays || undefined,
          maxAccessCount: maxAccessCount ? Number(maxAccessCount) : undefined,
        },
      });

      setShareData(result);
    } catch (err) {
      console.error("Failed to create share:", err);
      setError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetadata() {
    if (!shareData?.shareToken) return;

    try {
      setRefreshingMetadata(true);
      const result = await getDeckShare(shareData.shareToken);
      if (result.metadata) {
        setAccessCount(result.metadata.accessCount);
      }
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
    } finally {
      setRefreshingMetadata(false);
    }
  }

  async function handleRevoke() {
    if (!shareData?.shareToken) return;

    try {
      setRevoking(true);
      await revokeDeckShare(shareData.shareToken);
      setShowRevokeDialog(false);
      setShareData(null);
      setError(null);
      // Optionally show success message
    } catch (err) {
      console.error("Failed to revoke share:", err);
      setError(err instanceof Error ? err.message : "Failed to revoke share");
    } finally {
      setRevoking(false);
    }
  }

  // Get the public site URL, fallback to window.location.origin for development
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return process.env.PUBLIC_URL || window.location.origin;
    }
    return process.env.PUBLIC_URL || "";
  };

  function copyToClipboard() {
    if (!shareData) return;

    const fullUrl = `${getBaseUrl()}${shareData.shareUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatExpirationDate(expiresAt: string | null) {
    if (!expiresAt) return "Never";
    const date = new Date(expiresAt);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const fullShareUrl = shareData
    ? `${getBaseUrl()}${shareData.shareUrl}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white/10 border border-white/20 backdrop-blur-xl max-w-md">
        <DialogHeader>
          <DialogTitle>Share Deck</DialogTitle>
          <DialogDescription>
            Create a shareable link for "{deckName}"
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            <p className="text-sm text-white/70">Creating share link...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {shareData && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-url">Share Link</Label>
              <div className="flex gap-2">
                <Input
                  id="share-url"
                  value={fullShareUrl}
                  readOnly
                  className="bg-white/5 border-white/20 text-white"
                />
                <Button
                  onClick={copyToClipboard}
                  size="icon"
                  variant="outline"
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-green-400">Copied to clipboard!</p>
              )}
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={() => setShowQRCode(!showQRCode)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {showQRCode ? "Hide" : "Show"} QR Code
              </Button>
              {showQRCode && (
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG value={fullShareUrl} size={200} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 text-sm text-white/70">
              {shareData.expiresAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Expires: {formatExpirationDate(shareData.expiresAt)}</span>
                  {timeRemaining && (
                    <span className="text-cyan-400 font-medium">({timeRemaining})</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Accesses: {accessCount !== null ? accessCount : "Loading..."}</span>
                <Button
                  onClick={fetchMetadata}
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={refreshingMetadata}
                >
                  <RefreshCw className={`h-3 w-3 ${refreshingMetadata ? "animate-spin" : ""}`} />
                </Button>
                {shareData.maxAccessCount && (
                  <span className="text-white/50">/ {shareData.maxAccessCount}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => window.open(fullShareUrl, "_blank")}
                variant="outline"
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
              {user && (
                <Button
                  onClick={() => setShowRevokeDialog(true)}
                  variant="outline"
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Revoke Confirmation Dialog */}
        <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Share Link?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently disable the share link. Anyone with the link will no longer be able to access the deck.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-red-600 hover:bg-red-700"
              >
                {revoking ? "Revoking..." : "Revoke"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!loading && !shareData && !error && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expires-days">Expires in (days)</Label>
              <Input
                id="expires-days"
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="bg-white/5 border-white/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-access">Max access count (optional)</Label>
              <Input
                id="max-access"
                type="number"
                min="1"
                max="10000"
                value={maxAccessCount}
                onChange={(e) =>
                  setMaxAccessCount(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Unlimited"
                className="bg-white/5 border-white/20"
              />
            </div>

            <Button onClick={createShare} className="w-full">
              Create Share Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
