import { formatCardText } from "@/lib/card/format-card-text";

describe("formatCardText", () => {
  it("returns nothing for an empty description", () => {
    expect(formatCardText("  ")).toEqual([]);
  });

  it("puts the condition on its own clause, then the effect", () => {
    const [block] = formatCardText(
      "When this card is sent from the field to the GY: Add 1 monster with 1500 or less ATK from your Deck to your hand.",
    );
    expect(block).toEqual({
      type: "effect",
      parts: [
        { kind: "condition", text: "When this card is sent from the field to the GY:" },
        {
          kind: "effect",
          text: "Add 1 monster with 1500 or less ATK from your Deck to your hand.",
        },
      ],
    });
  });

  it("separates what you do on activation from the effect", () => {
    const [block] = formatCardText(
      "Discard 1 card; destroy all face-up monsters your opponent controls.",
    );
    expect(block).toEqual({
      type: "effect",
      parts: [
        { kind: "activation", text: "Discard 1 card;" },
        { kind: "effect", text: "destroy all face-up monsters your opponent controls." },
      ],
    });
  });

  it("keeps condition, activation, and effect in that order", () => {
    const [block] = formatCardText(
      "When this card is destroyed by battle and sent to the GY: You can target 2 Level 2 monsters in your GY; Special Summon them.",
    );
    expect(block).toEqual({
      type: "effect",
      parts: [
        {
          kind: "condition",
          text: "When this card is destroyed by battle and sent to the GY:",
        },
        { kind: "activation", text: "You can target 2 Level 2 monsters in your GY;" },
        { kind: "effect", text: "Special Summon them." },
      ],
    });
  });

  it("leaves a continuous line as one clause", () => {
    const [block] = formatCardText(
      "If your opponent controls a monster and you control no monsters, you can Special Summon this card (from your hand).",
    );
    expect(block).toEqual({
      type: "effect",
      parts: [
        {
          kind: "plain",
          text: "If your opponent controls a monster and you control no monsters, you can Special Summon this card (from your hand).",
        },
      ],
    });
  });

  it("does not treat a colon inside a card name as a condition", () => {
    const [block] = formatCardText(
      'This card\'s name becomes "A: B" while it is face-up on the field.',
    );
    expect(block).toEqual({
      type: "effect",
      parts: [
        {
          kind: "plain",
          text: 'This card\'s name becomes "A: B" while it is face-up on the field.',
        },
      ],
    });
  });

  it("groups bulleted choices under the lead-in and keeps the closing limit separate", () => {
    const blocks = formatCardText(
      'When this card is Normal Summoned: You can activate 1 of these effects; ● Add 1 "HERO" monster from your Deck to your hand. ● If "Polymerization" is in your GY: Add 1 "Polymerization" from your GY to your hand. You can only use this effect of "Elemental HERO Stratos" once per turn.',
    );
    expect(blocks).toEqual([
      {
        type: "choice",
        lead: [
          { kind: "condition", text: "When this card is Normal Summoned:" },
          { kind: "activation", text: "You can activate 1 of these effects;" },
        ],
        items: [
          [
            {
              kind: "plain",
              text: 'Add 1 "HERO" monster from your Deck to your hand.',
            },
          ],
          [
            { kind: "condition", text: 'If "Polymerization" is in your GY:' },
            { kind: "effect", text: 'Add 1 "Polymerization" from your GY to your hand.' },
          ],
        ],
      },
      {
        type: "effect",
        parts: [
          {
            kind: "plain",
            text: 'You can only use this effect of "Elemental HERO Stratos" once per turn.',
          },
        ],
      },
    ]);
  });

  it("keeps numbered choices as a list without dropping the numbers", () => {
    const blocks = formatCardText(
      "You can activate 1 of these effects. (1) If this card is Normal Summoned: Draw 1 card. (2) If this card is sent to the GY: Add 1 card from your Deck to your hand.",
    );
    expect(blocks[0]).toMatchObject({
      type: "choice",
      lead: [{ kind: "plain", text: "You can activate 1 of these effects." }],
    });
    if (blocks[0]?.type !== "choice") throw new Error("expected a choice");
    expect(blocks[0].items[0]?.[0]?.text.startsWith("(1)")).toBe(true);
    expect(blocks[0].items[1]?.[0]?.text.startsWith("(2)")).toBe(true);
    expect(blocks[0].items[0]?.map((part) => part.kind)).toEqual(["condition", "effect"]);
  });
});
