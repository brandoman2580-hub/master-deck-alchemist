"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, MessageSquare, Clock, Download, Edit2, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { getConversationHistory, updateConversationName } from "@/lib/api/deckAssistant";

interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  name?: string | null;
}

interface ConversationHistoryModalProps {
  deckId: string;
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * Conversation History Modal Component
 * Displays conversation history for a deck
 */
export function ConversationHistoryModal({
  deckId,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isCollapsed,
  onToggleCollapse,
}: ConversationHistoryModalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deckId || deckId === "temp" || deckId === "") {
      return;
    }

    const loadConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        // Limit to 5 most recent conversations
        const history = await getConversationHistory(deckId, 5);
        setConversations(history);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load conversation history",
        );
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [deckId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      // Format as date if older than a week
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  const handleStartEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingName(conv.name || "Conversation");
    // Focus input after a short delay to ensure it's rendered
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSaveEdit = async (convId: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setEditingId(null);
      return;
    }

    try {
      await updateConversationName(convId, trimmedName);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, name: trimmedName } : c))
      );
      setEditingId(null);
    } catch (err) {
      // Failed to update conversation name
      setError(err instanceof Error ? err.message : "Failed to update name");
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onToggleCollapse}
          />
        )}
      </AnimatePresence>

      {/* History Panel - Overlay Style */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl w-full max-w-md max-h-[80vh] mx-4 flex flex-col shadow-2xl pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-white/70" />
                  <h3 className="text-sm font-semibold text-white">History</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-b border-white/10 flex flex-col gap-2">
                <Button
                  onClick={onNewConversation}
                  className="w-full h-9 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  New Conversation
                </Button>
                {currentConversationId && (
                  <Button
                    onClick={async () => {
                      try {
                        const { getConversationMessages } = await import("@/lib/api/deckAssistant");
                        const messages = await getConversationMessages(currentConversationId);
                        
                        // Format conversation for export
                        const exportData = {
                          conversation_id: currentConversationId,
                          deck_id: deckId,
                          exported_at: new Date().toISOString(),
                          messages: messages.map(msg => ({
                            role: msg.role,
                            content: msg.content,
                            timestamp: msg.timestamp,
                            recommendations: msg.recommendations,
                          })),
                        };

                        // Create and download JSON file
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `conversation-${currentConversationId.substring(0, 8)}-${new Date().toISOString().split("T")[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        // Failed to export conversation
                        alert("Failed to export conversation. Please try again.");
                      }
                    }}
                    variant="outline"
                    className="w-full h-9 bg-white/5 hover:bg-white/10 border border-white/20 text-white text-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Conversation
                  </Button>
                )}
              </div>

              {/* Conversation List */}
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="p-4 text-center">
                    <p className="text-white/50 text-xs">Loading...</p>
                  </div>
                ) : error ? (
                  <div className="p-4">
                    <p className="text-red-400 text-xs">{error}</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-white/50 text-xs">
                      No conversation history yet
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`w-full p-3 rounded-lg mb-2 transition-all ${
                          currentConversationId === conv.id
                            ? "bg-white/15 border border-white/30"
                            : "bg-white/5 border border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-white/50 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-3 w-3 text-white/40" />
                              <span className="text-xs text-white/60">
                                {formatDate(conv.updated_at)}
                              </span>
                            </div>
                            {editingId === conv.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  ref={inputRef}
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveEdit(conv.id);
                                    } else if (e.key === "Escape") {
                                      handleCancelEdit();
                                    }
                                  }}
                                  className="h-6 text-xs bg-white/10 border-white/20 text-white flex-1"
                                  maxLength={100}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleSaveEdit(conv.id)}
                                  className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10"
                                >
                                  <XIcon className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <button
                                  onClick={() => onSelectConversation(conv.id)}
                                  className="flex-1 text-left min-w-0"
                                >
                                  <p className="text-xs text-white/80 truncate">
                                    {conv.name || "Conversation"}
                                  </p>
                                </button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(conv);
                                  }}
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white hover:bg-white/10"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
