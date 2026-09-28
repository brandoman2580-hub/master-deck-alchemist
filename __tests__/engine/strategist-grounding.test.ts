import {
  banStatusAgainstMap,
  normalizeBanStatus,
  verifyCardNamesAgainstLibrary,
} from "@/lib/engine/verify-cards";
import {
  OFF_DOMAIN_REFUSAL_MESSAGE,
  buildOutOfBoundsCoachResponse,
} from "@/lib/engine/assistant-contract";
import { classifyOutOfBoundsHeuristic } from "@/lib/engine/mode-router";

describe("Strategist grounding + Phase C evals", () => {
  const library = [
    { id: 1, name: "Lair of Darkness" },
    { id: 2, name: "Red Resonator" },
    { id: 3, name: "Hot Red Dragon Archfiend Abyss" },
    { id: 4, name: "Ash Blossom & Joyous Spring" },
  ];

  it("rejects invented card names (Lair→RDA grounding)", () => {
    const result = verifyCardNamesAgainstLibrary(
      [
        "Lair of Darkness",
        "Fake Calamity Dragon That Does Not Exist",
        "Red Resonator",
      ],
      library,
    );
    expect(result.found.map((c) => c.name)).toEqual([
      "Lair of Darkness",
      "Red Resonator",
    ]);
    expect(result.notFound).toContain(
      "Fake Calamity Dragon That Does Not Exist",
    );
  });

  it("marks Forbidden / Banned as maxCopies 0", () => {
    expect(normalizeBanStatus("Forbidden")).toBe("forbidden");
    expect(normalizeBanStatus("Banned")).toBe("forbidden");
    const [forbidden, limited, unlimited] = banStatusAgainstMap(
      [
        { id: 99, name: "Calamity" },
        { id: 4, name: "Ash Blossom & Joyous Spring" },
        { id: 2, name: "Red Resonator" },
      ],
      {
        Calamity: "Forbidden",
        "Ash Blossom & Joyous Spring": "Limited",
      },
    );
    expect(forbidden.maxCopies).toBe(0);
    expect(limited.maxCopies).toBe(1);
    expect(unlimited.maxCopies).toBe(3);
  });

  it("weather ask returns fixed off-domain refusal", () => {
    const oob = classifyOutOfBoundsHeuristic(
      "What's the weather supposed to be in my area today?",
    );
    expect(oob.reason).toBe("off_domain");
    const coach = buildOutOfBoundsCoachResponse({
      oob_reason: "off_domain",
      confidence: "high",
    });
    expect(coach.answer).toBe(OFF_DOMAIN_REFUSAL_MESSAGE);
  });
});
