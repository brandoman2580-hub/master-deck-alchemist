import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { WorkshopGradeDisclaimer } from "@/components/mda/workshop-grade-disclaimer";
import { emptyWorkshopGradeAxes } from "@/lib/engine/grade";
import { workshopGradeFromAxes } from "@/lib/workshop/grade";

expect.extend(toHaveNoViolations);

describe("facts_brain KPI format pack weights migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260921000000_facts_brain_kpi_format_pack_weights.sql",
    ),
    "utf8",
  );

  it("seeds Maxx hard outs and TCG interaction staples for both formats", () => {
    expect(sql).toContain("Ash Blossom & Joyous Spring");
    expect(sql).toContain("Called by the Grave");
    expect(sql).toContain("Crossout Designator");
    expect(sql).toContain('Maxx "C"');
    expect(sql).toContain("CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL'))");
  });
});

describe("WorkshopGradeDisclaimer", () => {
  const grade = workshopGradeFromAxes({
    ...emptyWorkshopGradeAxes(),
    consistency: 70,
    power: 65,
    resilience: 55,
    disruption: 60,
    letter: "B",
    formatRulePack: "masterDuelMaxxC",
    synergyFactor: 1.02,
    breakdown: {
      ...emptyWorkshopGradeAxes().breakdown,
      formatPackNotes: [
        "Master Duel banlist applies. TCG tournament list is not used.",
        'Maxx "C" is legal on Master Duel — hard outs in Main: 2.',
      ],
      resilience: [
        {
          key: "formatPack",
          label: "Format pack (masterDuelMaxxC)",
          value: -4,
          note: "Maxx outs in Main: 2",
        },
      ],
    },
  });

  it("exposes a labeled control that explains format-separated banlists", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkshopGradeDisclaimer mode="Master Duel" grade={grade} />,
    );
    const trigger = screen.getByRole("button", {
      name: /How workshop grade scores work/i,
    });
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);
    expect(
      await screen.findByRole("heading", { name: /How scores work/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sets and list updates typically lag TCG/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/never merged/i)).toBeInTheDocument();
    expect(screen.getByText(/KPI definitions/i)).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("frames TCG tournament banlist when mode is TCG", async () => {
    const user = userEvent.setup();
    render(
      <WorkshopGradeDisclaimer
        mode="TCG"
        grade={{
          ...grade,
          formatRulePack: "tcgTournament",
          formatPackNotes: [
            "TCG tournament banlist applies (US/world tournament standard).",
          ],
        }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /How workshop grade scores work/i }),
    );
    expect(
      await screen.findByText(/US \/ world tournament standard/i),
    ).toBeInTheDocument();
  });
});
