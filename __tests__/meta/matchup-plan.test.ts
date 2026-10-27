import { buildMatchupPlans } from "@/lib/meta/matchup-plan";

const branded = {
  name: "Branded",
  tier: 3 as const,
  cards: [
    { name: "Branded Fusion", copies: 1, zone: "main" as const },
    { name: "Fallen of Albaz", copies: 1, zone: "main" as const },
    { name: "Mirrorjade the Iceblade Dragon", copies: 1, zone: "extra" as const },
  ],
};

const dracotail = {
  name: "Dracotail",
  tier: 3 as const,
  cards: [
    { name: "Dracotail Faimena", copies: 3, zone: "main" as const },
    { name: "Branded Fusion", copies: 1, zone: "main" as const },
    { name: "Mirrorjade the Iceblade Dragon", copies: 1, zone: "extra" as const },
  ],
};

const elfnote = {
  name: "Elfnote",
  tier: 1 as const,
  cards: [
    { name: "Elfnote Lucina", copies: 3, zone: "main" as const },
    { name: "Elfnote Regina", copies: 3, zone: "main" as const },
  ],
};

describe("buildMatchupPlans", () => {
  it("names a stop only when both cards are in the lists", () => {
    const [plan] = buildMatchupPlans(
      [branded],
      [{ name: "Ash Blossom & Joyous Spring", zone: "main" }],
      "Master Duel",
    );
    expect(plan.aim).toMatch(/Fusion Summon/);
    expect(plan.aim).toMatch(/Branded Fusion/);
    expect(plan.goingSecond).toMatch(/Ash Blossom can stop Branded Fusion/);
    expect(plan.goingSecond).toMatch(/no Forbidden Droplet or Dark Ruler No More/);
    expect(plan.goingFirst).toMatch(/Keep Ash Blossom/);
    expect(plan.group).toBe("missing");
  });

  it("says a mixed Dracotail list is not pure", () => {
    const [plan] = buildMatchupPlans([dracotail], [], "Master Duel");
    expect(plan.aim).toMatch(/Dracotail Faimena/);
    expect(plan.aim).toMatch(/not a pure Dracotail list/);
    expect(plan.aim).toMatch(/Branded Fusion/);
  });

  it("does not treat a side-deck card as part of a Master Duel game", () => {
    const [plan] = buildMatchupPlans(
      [branded],
      [{ name: "Ash Blossom & Joyous Spring", zone: "side" }],
      "Master Duel",
    );
    expect(plan.goingSecond).toMatch(/no Ash Blossom & Joyous Spring/);
    expect(plan.goingSecond).not.toMatch(/Ash Blossom can stop/);
    expect(plan.sideNote).toMatch(/Ash Blossom & Joyous Spring is in your side deck/);
  });

  it("names the sided answer and still says the match is missing that stop", () => {
    const [plan] = buildMatchupPlans(
      [branded],
      [{ name: "Dark Ruler No More", zone: "side" }],
      "Master Duel",
    );
    expect(plan.goingSecond).toMatch(/no Forbidden Droplet or Dark Ruler No More/);
    expect(plan.goingSecond).not.toMatch(/Forbidden Droplet is in your side deck/);
    expect(plan.sideNote).toMatch(/Dark Ruler No More is in your side deck/);
  });

  it("ignores a card that is only in a Master Duel list's side deck", () => {
    const [plan] = buildMatchupPlans(
      [
        {
          name: "Branded",
          tier: 3,
          cards: [
            { name: "Branded Fusion", copies: 1, zone: "side" },
            { name: "Mirrorjade the Iceblade Dragon", copies: 1, zone: "extra" },
          ],
        },
      ],
      [{ name: "Ash Blossom & Joyous Spring", zone: "main" }],
      "Master Duel",
    );
    expect(plan.goingSecond).not.toMatch(/Ash Blossom can stop Branded Fusion/);
    expect(plan.goingSecond).toMatch(/no Forbidden Droplet or Dark Ruler No More/);
  });

  it("counts a side-deck card in a TCG match", () => {
    const [plan] = buildMatchupPlans(
      [branded],
      [{ name: "Ash Blossom & Joyous Spring", zone: "side" }],
      "TCG",
    );
    expect(plan.goingSecond).toMatch(/Ash Blossom can stop Branded Fusion/);
  });

  it("does not call a list impure because it plays a generic extra-deck card", () => {
    const [plan] = buildMatchupPlans(
      [
        {
          name: "Phantom Knights",
          tier: 3,
          cards: [
            { name: "The Phantom Knights of Ancient Cloak", copies: 3, zone: "main" },
            { name: "I:P Masquerena", copies: 1, zone: "extra" },
          ],
        },
      ],
      [],
      "Master Duel",
    );
    expect(plan.aim).not.toMatch(/not a pure/);
    expect(plan.aim).not.toMatch(/I:P Masquerena/);
  });

  it("leaves an unchecked deck without a made-up stop and sorts known gaps first", () => {
    const plans = buildMatchupPlans(
      [elfnote, branded],
      [{ name: "Ash Blossom & Joyous Spring", zone: "main" }],
      "Master Duel",
    );
    expect(plans.map((plan) => plan.name)).toEqual(["Branded", "Elfnote"]);
    expect(plans[1].goingSecond).toMatch(/don't have a checked stop/i);
    expect(plans[1].aim).toMatch(/Elfnote Lucina/);
  });
});
