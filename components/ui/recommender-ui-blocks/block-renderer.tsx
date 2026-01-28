"use client";

import ReactMarkdown from "react-markdown";
import { Card as CardUI, CardContent } from "../card";
import { Button } from "../button";
import { CardPreview } from "../card-preview";
import { AlertCircle, Check, Info, Sparkles } from "lucide-react";
import type { UIBlock, SuggestionContent } from "@/types/recommender";
import type { Card } from "@/types/card";

interface BlockRendererProps {
  block: UIBlock;
  index: number;
  cardMap: Map<number, Card>;
  cardNameMap: Map<string, Card>;
  recMap: Map<string, any>;
  onApplySuggestion?: (suggestionId: string, cardId?: string) => void;
  onPreviewSuggestion?: (suggestionId: string, cardId?: string) => void;
}

export function BlockRenderer({
  block,
  index,
  cardMap,
  cardNameMap,
  recMap,
  onApplySuggestion,
  onPreviewSuggestion,
}: BlockRendererProps) {
  switch (block.type) {
    case "text":
      return (
        <div
          key={block.id || index}
          className="prose prose-invert max-w-none text-slate-200 leading-relaxed"
        >
          {typeof block.content === "string" ? (
            <ReactMarkdown
              components={{
                strong: ({ children }) => (
                  <strong className="text-cyan-400 font-semibold">
                    {children}
                  </strong>
                ),
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0">{children}</p>
                ),
              }}
            >
              {block.content}
            </ReactMarkdown>
          ) : (
            <p>{String(block.content)}</p>
          )}
        </div>
      );

    case "list":
      const listItems =
        typeof block.content === "string"
          ? [block.content]
          : Array.isArray(block.content)
            ? block.content
            : [];
      return (
        <ul
          key={block.id || index}
          className="list-disc list-inside space-y-2 text-slate-200 ml-4"
        >
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {typeof item === "string" ? (
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <strong className="text-cyan-400">{children}</strong>
                    ),
                  }}
                >
                  {item}
                </ReactMarkdown>
              ) : (
                String(item)
              )}
            </li>
          ))}
        </ul>
      );

    case "card":
      // Render card preview if content is a card ID or name
      const cardIdentifier =
        typeof block.content === "string" ? block.content : "";
      const cardId = parseInt(cardIdentifier, 10);
      const card =
        !isNaN(cardId)
          ? cardMap.get(cardId)
          : cardNameMap.get(cardIdentifier.toLowerCase());

      if (card) {
        return (
          <div key={block.id || index} className="my-4">
            <CardPreview card={card}>
              <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer">
                {card.name}
              </span>
            </CardPreview>
          </div>
        );
      }
      return null;

    case "table":
      // Render table if content is an object or array
      if (typeof block.content === "object" && !Array.isArray(block.content)) {
        const tableData = block.content as Record<string, any>;
        return (
          <div
            key={block.id || index}
            className="overflow-x-auto my-4 border border-cyan-500/30 rounded-lg"
          >
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(tableData).map(([key, value], i) => (
                  <tr
                    key={i}
                    className="border-b border-cyan-500/20 last:border-0"
                  >
                    <td className="px-4 py-2 font-semibold text-cyan-400 bg-slate-900/50">
                      {key}
                    </td>
                    <td className="px-4 py-2 text-slate-200">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return null;

    case "suggestion":
      // Render actionable suggestion
      const suggestionContent = block.content as unknown as SuggestionContent;
      if (
        typeof suggestionContent === "object" &&
        suggestionContent.suggestionId
      ) {
        const rec = suggestionContent.cardId
          ? recMap.get(suggestionContent.cardId)
          : null;

        return (
          <CardUI
            key={block.id || index}
            className="my-4 border-cyan-500/30 bg-slate-900/50"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-slate-200 mb-2">
                    {suggestionContent.label}
                  </p>
                  {rec && (
                    <div className="space-y-1 text-sm text-slate-400">
                      <p>{rec.reason}</p>
                      {rec.banned && (
                        <p className="text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          This card is banned in the selected format
                        </p>
                      )}
                      {rec.synergyScore !== undefined && rec.synergyScore > 0.3 && (
                        <div className="flex items-center gap-2 text-xs">
                          <Sparkles className="h-3 w-3 text-cyan-400" />
                          <span className="text-slate-300">
                            Synergy:{" "}
                            <span className={`font-semibold ${
                              rec.synergyScore >= 0.8 ? "text-green-400" : rec.synergyScore >= 0.6 ? "text-cyan-400" : "text-yellow-400"
                            }`}>
                              {Math.round(rec.synergyScore * 100)}%
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {suggestionContent.verb === "apply" && onApplySuggestion && (
                    <Button
                      size="sm"
                      onClick={() => {
                        onApplySuggestion(
                          suggestionContent.suggestionId,
                          suggestionContent.cardId
                        );
                      }}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Apply
                    </Button>
                  )}
                  {suggestionContent.verb === "preview" &&
                    onPreviewSuggestion && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onPreviewSuggestion(
                            suggestionContent.suggestionId,
                            suggestionContent.cardId
                          )
                        }
                      >
                        <Info className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    )}
                </div>
              </div>
            </CardContent>
          </CardUI>
        );
      }
      return null;

    default:
      return null;
  }
}
