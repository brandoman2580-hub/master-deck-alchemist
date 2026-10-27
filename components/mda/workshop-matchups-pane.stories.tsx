import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { FactsEnvelope } from "@/lib/engine";
import { FACTS_SCHEMA_VERSION, emptyWorkshopGradeAxes } from "@/lib/engine";
import { WorkshopMatchupsPane } from "./workshop-matchups-pane";
import "@/app/workshop/space-grotesk.css";

function populatedFacts(): FactsEnvelope {
  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId: "11111111-1111-1111-1111-111111111111",
    deckHash: "abcd1234",
    format: "MASTER_DUEL",
    legality: { ok: true, errors: [] },
    diagnostics: {
      collisions: [],
      roleCoverage: {
        starters: 10,
        extenders: 6,
        handTraps: 9,
        boardBreakers: 3,
        endboardPieces: 2,
        locks: 0,
      },
      strategyFit: {
        primaryArchetype: "Snake-Eye",
        primaryStrategy: "Combo",
        secondaryStrategy: null,
        fitScore: 80,
        notes: [],
      },
      bosses: [],
      restrictions: [],
    },
    consistency: {
      n: 3000,
      starterAccess: 0.8,
      brickRate: 0.1,
      oneInterruptionSurvival: 0.5,
    },
    matchups: [
      {
        opponentArchetype: "Labrynth",
        tier: "2",
        starterAccessDelta: -0.15,
        brickRateDelta: 0.05,
        tagAdvantage: -0.4,
        opponentStrategy: "Control",
        disruptionScore: -0.22,
        consistencyScore: -0.08,
        notes: ["Few board breakers for going-second pressure"],
      },
      {
        opponentArchetype: "Tearlaments",
        tier: "1",
        starterAccessDelta: 0.2,
        brickRateDelta: 0.1,
        tagAdvantage: 0.25,
        opponentStrategy: "Combo",
        disruptionScore: 0.12,
        consistencyScore: 0.4,
        notes: ["Strong starter access supports proactive lines"],
      },
      {
        opponentArchetype: "Yubel",
        tier: "3",
        starterAccessDelta: 0,
        brickRateDelta: 0,
        tagAdvantage: -0.05,
        opponentStrategy: null,
        disruptionScore: 0,
        consistencyScore: -0.05,
        notes: [],
      },
    ],
    combos: { lines: [], source: "empty" },
    grade: {
      ...emptyWorkshopGradeAxes(),
      consistency: 78,
      power: 60,
      resilience: 65,
      disruption: 70,
      letter: "B",
      formatRulePack: "tcgTournament",
    },
  };
}

const meta = {
  title: "MDA/Organisms/WorkshopMatchupsPane",
  component: WorkshopMatchupsPane,
  tags: ["autodocs"],
  args: {
    facts: null,
    loading: false,
    error: null,
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-[960px] border border-[#28303b] bg-[#eef3f6] font-spaceGrotesk text-[#0c0e12]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkshopMatchupsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Populated: Story = {
  args: { facts: populatedFacts() },
};

export const Loading: Story = {
  args: { facts: null, loading: true },
};

export const Calibrated: Story = {
  args: {
    facts: populatedFacts(),
    referenceBands: {
      ceiling: { tier1: 8, tier2: 6, tier3: 3 },
      floor: { tier1: 0.99, tier2: 0.97, tier3: 0.8 },
      nonEngine: { tier1: 54, tier2: 42, tier3: 26 },
      sampleIterations: 3000,
      listCounts: { 1: 1, 2: 0, 3: 0 },
      scoreVersion: 2,
      decks: [
        {
          name: "Elfnote",
          tier: 1,
          consistency: 100,
          resilience: 100,
          interaction: 55,
          ceiling: 80,
          outing: 20,
          composite: 78,
          ceilingMode: "endboard",
          letter: "B",
        },
      ],
    },
  },
};
