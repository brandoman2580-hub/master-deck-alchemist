import type { ReactNode } from "react";
import {
  formatCardText,
  type CardTextPart,
} from "@/lib/card/format-card-text";

type CardEffectTextProps = {
  text: string;
};

function EffectParts({ parts }: { parts: CardTextPart[] }): ReactNode {
  if (parts.length === 0) return null;
  return (
    <p className="text-[13px] leading-5 text-[#0c0e12]">
      {parts.map((part, index) => (
        <span
          key={`${part.kind}-${index}`}
          className={
            part.kind === "condition"
              ? "block font-semibold"
              : index === 0
                ? "block"
                : "mt-1 block"
          }
        >
          {part.text}
        </span>
      ))}
    </p>
  );
}

/**
 * Card effect copy, broken onto the lines a reader scans: condition, then
 * activation, then effect. A choice of effects is a list under its lead-in.
 */
export function CardEffectText({ text }: CardEffectTextProps): ReactNode {
  const blocks = formatCardText(text);
  if (blocks.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[#28303b] pt-3">
      {blocks.map((block, index) =>
        block.type === "choice" ? (
          <div key={index}>
            <EffectParts parts={block.lead} />
            <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-[13px] leading-5 text-[#0c0e12]">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <EffectParts parts={item} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EffectParts key={index} parts={block.parts} />
        ),
      )}
    </div>
  );
}
