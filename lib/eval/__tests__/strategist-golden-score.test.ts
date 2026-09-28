/**
 * Behavioral coverage for golden constraint scoring — refuse vs recommend,
 * format skip policy, and HTTP error expectations.
 */
import {
  classifyFlags,
  isRecommendFraming,
  resolveScenarioFormat,
  scoreScenario,
  stubGoldenFromFail,
} from "@/lib/eval/strategist-golden-score";

describe("isRecommendFraming", () => {
  const name = 'Hot Red Dragon Archfiend King Calamity';

  it("does not treat banlist refuse language as a recommendation", () => {
    const answer =
      "You can't run Hot Red Dragon Archfiend King Calamity at all – it's on the forbidden list, so it can't be in your Extra Deck.";
    expect(isRecommendFraming(answer, name)).toBe(false);
  });

  it("flags explicit add/run framing without refuse", () => {
    const answer =
      "I would add Hot Red Dragon Archfiend King Calamity as your Level 12 boss.";
    expect(isRecommendFraming(answer, name)).toBe(true);
  });
});

describe("scoreScenario A3_MD refuse path", () => {
  const scenario = {
    id: "A3_MD",
    format: "MASTER_DUEL" as const,
    formatPolicy: "match_session" as const,
    prompt: "Should I add Hot Red Dragon Archfiend King Calamity to my Extra Deck?",
    constraints: {
      forbidCasualTone: true,
      forbidRecommendNames: ["Hot Red Dragon Archfiend King Calamity"],
      requireRefuseNames: ["Hot Red Dragon Archfiend King Calamity"],
    },
  };

  it("passes when the coach refuses a Forbidden card by name", () => {
    const result = {
      _httpStatus: 200,
      mode: "qa",
      answer:
        "You can't run Hot Red Dragon Archfiend King Calamity at all – it's on the forbidden list, so it can't be in your Main, Side, or Extra Deck.",
    };
    const flags = scoreScenario(scenario, result);
    expect(classifyFlags(flags)).toBe("pass");
    expect(flags).toContain("ok_no_forbidden_rec");
    expect(flags).toContain("ok_refuse_name");
  });

  it("fails when synergies list the Forbidden card as an add", () => {
    const result = {
      _httpStatus: 200,
      mode: "discover_synergy",
      answer: "Here are Extra Deck options.",
      synergies: [
        { title: "Hot Red Dragon Archfiend King Calamity", cardName: "Hot Red Dragon Archfiend King Calamity" },
      ],
    };
    const flags = scoreScenario(scenario, result);
    expect(classifyFlags(flags)).toBe("fail");
    expect(flags.some((f) => f.startsWith("fail_recommended_"))).toBe(true);
  });
});

describe("resolveScenarioFormat", () => {
  it("skips TCG-only cases on a Master Duel session by default", () => {
    const resolved = resolveScenarioFormat(
      { id: "A2", prompt: "x", format: "TCG" },
      "MASTER_DUEL",
    );
    expect(resolved.skip).toBe(true);
    expect(resolved.skipReason).toMatch(/format_mismatch/);
  });

  it("honors require_format when explicitly requested", () => {
    const resolved = resolveScenarioFormat(
      {
        id: "A2",
        prompt: "x",
        format: "TCG",
        formatPolicy: "require_format",
      },
      "MASTER_DUEL",
    );
    expect(resolved.skip).toBe(false);
    expect(resolved.format).toBe("TCG");
  });

  it("skips A3_TCG on MD and A3_MD on TCG under match_session", () => {
    expect(
      resolveScenarioFormat(
        {
          id: "A3_TCG",
          prompt: "x",
          format: "TCG",
          formatPolicy: "match_session",
        },
        "MASTER_DUEL",
      ).skip,
    ).toBe(true);
    expect(
      resolveScenarioFormat(
        {
          id: "A3_MD",
          prompt: "x",
          format: "MASTER_DUEL",
          formatPolicy: "match_session",
        },
        "TCG",
      ).skip,
    ).toBe(true);
  });
});

describe("scoreScenario B5 soft copy-count", () => {
  const scenario = {
    id: "B5",
    prompt:
      "I am currently running 3 copies of Soul Resonator. Is this ratio optimal for my starting consistency?",
    constraints: {
      modes: ["tune_copies"],
      forbidCasualTone: true,
      requiredEntities: ["Soul Resonator"],
      answerMustMatch: ["\\b3\\b"],
    },
  };

  it("passes when tune_copies answer cites Soul Resonator and 3", () => {
    const flags = scoreScenario(scenario, {
      _httpStatus: 200,
      mode: "tune_copies",
      answer:
        "You are already on 3 Soul Resonator, which is the maximum legal density for that starter — keep the ratio unless brick diagnostics say otherwise.",
    });
    expect(classifyFlags(flags)).toBe("pass");
  });

  it("fails when the answer omits the named card", () => {
    const flags = scoreScenario(scenario, {
      _httpStatus: 200,
      mode: "tune_copies",
      answer: "Three copies is fine for most starters in this format.",
    });
    expect(classifyFlags(flags)).toBe("fail");
    expect(flags.some((f) => f.startsWith("fail_missing_entity"))).toBe(true);
  });
});

describe("httpError expectation", () => {
  it("passes on 400 for poison-snapshot cases", () => {
    const flags = scoreScenario(
      {
        id: "H2",
        prompt: "Why brick?",
        constraints: { httpError: true },
      },
      { _httpStatus: 400, error: "unknown cards" },
    );
    expect(classifyFlags(flags)).toBe("pass");
  });

  it("fails when poison snapshot is accepted with 200", () => {
    const flags = scoreScenario(
      {
        id: "H2",
        prompt: "Why brick?",
        constraints: { httpError: true },
      },
      { _httpStatus: 200, mode: "qa", answer: "Your brick rate is low." },
    );
    expect(classifyFlags(flags)).toBe("fail");
    expect(flags).toContain("fail_expected_http_error");
  });
});

describe("stubGoldenFromFail", () => {
  it("builds an additive regression golden with source metadata", () => {
    const stub = stubGoldenFromFail({
      id: "A3_MD",
      prompt: "Should I add Calamity?",
      format: "MASTER_DUEL",
      mode: "qa",
      softFlags: ["fail_recommended_Hot Red Dragon Archfiend"],
      answer: "Add Calamity tomorrow.",
      _file: "reports/x.jsonl",
    });
    expect(stub.id).toMatch(/^A3_MD-reg-/);
    expect(stub.source?.type).toBe("promoted_fail");
    expect(stub.constraints?.forbidCasualTone).toBe(true);
    expect(stub.formatPolicy).toBe("match_session");
  });
});

describe("classifyFlags skip", () => {
  it("returns skip when skip_ flags are present", () => {
    expect(classifyFlags(["skip_format_mismatch_want_TCG_session_MASTER_DUEL"])).toBe(
      "skip",
    );
  });
});
