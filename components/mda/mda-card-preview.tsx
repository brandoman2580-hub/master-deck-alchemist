"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Card } from "@/types/card";
import { CardImage } from "@/components/ui/card-image";
import { getArchetypeName } from "@/lib/deck/import";
import { CardEffectText } from "@/components/mda/card-effect-text";
import { MdaGlassPopover } from "@/components/mda/glass-popover";

export type MdaCardPreviewProps = {
  card: Card;
  children: React.ReactNode;
  /** Stretch the hover target to its parent. The default trigger shrinks to the card. */
  triggerClassName?: string;
};

const TAG_CLASS =
  "border border-[#28303b] bg-white px-1.5 py-0.5 text-[12px] leading-4 text-[#0c0e12]";

const PreviewTooltipContext = createContext(false);

/**
 * One tooltip timeline for a grid. Moving from card to card reuses the open
 * delay instead of closing and waiting again on every tile.
 */
export function CardPreviewTooltipProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <PreviewTooltipContext.Provider value={true}>
      <Tooltip.Provider
        delayDuration={150}
        skipDelayDuration={300}
        disableHoverableContent
      >
        {children}
      </Tooltip.Provider>
    </PreviewTooltipContext.Provider>
  );
}

function categoryTags(card: Card, archetype: string): { kind: string; value: string }[] {
  return [
    card.type ? { kind: "Type", value: card.type } : null,
    card.attribute ? { kind: "Attribute", value: card.attribute } : null,
    card.race ? { kind: "Race", value: card.race } : null,
    archetype ? { kind: "Archetype", value: archetype } : null,
  ].filter((tag): tag is { kind: string; value: string } => tag !== null);
}

function previewDescription(
  card: Card,
  tags: { kind: string; value: string }[],
  stats: { label: string; value: string }[],
): string {
  const parts = [card.name];
  if (tags.length > 0) parts.push(tags.map((tag) => tag.value).join(", "));
  if (stats.length > 0) parts.push(stats.map((stat) => `${stat.label} ${stat.value}`).join(", "));
  if (card.desc) parts.push(card.desc);
  return parts.join(". ");
}

const CONTROL_TAGS = new Set(["button", "a", "input", "select", "textarea"]);

/**
 * Radix puts `aria-describedby` on the trigger wrapper. The control inside
 * that wrapper is what keyboard users focus, so the id has to be rendered
 * onto that control. The original element identity has to stay put: giving
 * it a new key would remount the focused control and drop keyboard focus.
 */
function describeControls(node: ReactNode, describedBy: string): ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((child) => {
      const described = describeControls(child, describedBy);
      if (described !== child) changed = true;
      return described;
    });
    // A new array makes React demand keys on every child. The card button's
    // image and hint were created without keys, so keep the original list
    // unless a control inside it actually changed.
    return changed ? next : node;
  }
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<{ children?: ReactNode; "aria-describedby"?: string }>;
  const nextChildren =
    element.props.children == null
      ? element.props.children
      : describeControls(element.props.children, describedBy);
  const isControl = typeof element.type === "string" && CONTROL_TAGS.has(element.type);
  const childrenChanged = nextChildren !== element.props.children;
  if (!isControl) {
    return childrenChanged ? cloneElement(element, undefined, nextChildren) : node;
  }

  const existing = element.props["aria-describedby"];
  const merged =
    existing && !existing.split(/\s+/).includes(describedBy)
      ? `${existing} ${describedBy}`
      : (existing ?? describedBy);
  return childrenChanged
    ? cloneElement(element, { "aria-describedby": merged }, nextChildren)
    : cloneElement(element, { "aria-describedby": merged });
}

function PreviewTrigger({
  children,
  describedBy,
  triggerRef,
  className = "inline-block max-w-full",
}: {
  children: ReactNode;
  describedBy?: string;
  triggerRef: RefObject<HTMLDivElement | null>;
  className?: string;
}): ReactNode {
  return (
    <Tooltip.Trigger asChild>
      <div
        ref={triggerRef as RefObject<HTMLDivElement>}
        className={className}
      >
        {describedBy ? describeControls(children, describedBy) : children}
      </div>
    </Tooltip.Trigger>
  );
}

function statPairs(card: Card): { label: string; value: string }[] {
  if (card.type === "Spell Card" || card.type === "Trap Card") return [];
  const pairs: { label: string; value: string }[] = [];
  if (card.level !== undefined) pairs.push({ label: "Level", value: String(card.level) });
  if (card.atk !== undefined) pairs.push({ label: "ATK", value: String(card.atk) });
  if (card.def !== undefined) pairs.push({ label: "DEF", value: String(card.def) });
  return pairs;
}

/**
 * Hover card preview — content wrapped in {@link MdaGlassPopover}.
 *
 * Important: the Tooltip trigger is always a plain DOM node. Passing
 * `asChild` directly onto a Framer Motion node (or other gesture wrapper)
 * swallows Radix pointer handlers and the popover never opens.
 */
export function MdaCardPreview({
  card,
  children,
  triggerClassName,
}: MdaCardPreviewProps): ReactNode {
  const archetype = getArchetypeName(card);
  const tags = categoryTags(card, archetype);
  const stats = statPairs(card);
  const inProvider = useContext(PreviewTooltipContext);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [describedBy, setDescribedBy] = useState<string | undefined>();

  useLayoutEffect(() => {
    setDescribedBy(
      open ? (triggerRef.current?.getAttribute("aria-describedby") ?? undefined) : undefined,
    );
  }, [open]);

  const preview = (
      <Tooltip.Root onOpenChange={setOpen}>
        <PreviewTrigger describedBy={describedBy} triggerRef={triggerRef} className={triggerClassName}>
          {children}
        </PreviewTrigger>
        <Tooltip.Portal>
          <Tooltip.Content
            aria-label={previewDescription(card, tags, stats)}
            className="mda-preview-content z-[300] w-[min(440px,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none pointer-events-none"
            side="right"
            sideOffset={12}
            align="center"
            collisionPadding={16}
            avoidCollisions
          >
            <MdaGlassPopover aria-hidden="true" blur={false} panelClassName="p-3">
              <div className="flex items-start gap-3 font-spaceGrotesk text-[#0c0e12]">
                <div className="relative h-[160px] w-[116px] shrink-0 overflow-hidden border border-[#28303b] bg-[#0c0e12]">
                  <CardImage
                    card={card}
                    preferSmall={false}
                    fill
                    alt={card.name}
                    className="object-cover object-center"
                    sizes="116px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-tight text-[#0c0e12]">
                    {card.name}
                  </h3>
                  {tags.length > 0 ? (
                    <ul aria-label="Card categories" className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
                      {tags.map((tag) => (
                        <li key={`${tag.kind}-${tag.value}`} className={TAG_CLASS}>
                          {tag.value}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {stats.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                      {stats.map((stat) => (
                        <dl key={stat.label}>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#14181f]">
                            {stat.label}
                          </dt>
                          <dd className="text-sm font-semibold tabular-nums text-[#0c0e12]">
                            {stat.value}
                          </dd>
                        </dl>
                      ))}
                    </div>
                  ) : null}
                  <CardEffectText text={card.desc} />
                </div>
              </div>
            </MdaGlassPopover>
            <Tooltip.Arrow className="fill-[rgba(247,251,253,0.72)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
  );

  if (inProvider) return preview;
  return <CardPreviewTooltipProvider>{preview}</CardPreviewTooltipProvider>;
}
