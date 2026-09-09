// @vitest-environment jsdom
import { optimizationReportSchema } from "@bg3-builds/domain";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { OptimizationReportCard } from "./OptimizationReport";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const damage = {
  expected: 20,
  minimum: 0,
  minimumOnHit: 5,
  nonCritMax: 20,
  critMax: 30,
  variance: 4,
  stddev: 2,
  p10: 10,
  median: 20,
  p90: 25,
  probabilityZero: 0.1,
};
const build = {
  id: "fighter-bow",
  name: "Fighter bow",
  gameVersion: "Patch 8",
  level: 5,
  raceId: "race-human",
  classes: [{ classId: "class-fighter", subclassId: "subclass-battle-master", level: 5 }],
  abilityScores: { strength: 16, dexterity: 16, constitution: 14, intelligence: 8, wisdom: 12, charisma: 8 },
  choices: [],
  feats: ["feat-sharpshooter"],
  preparedSpells: [],
  equipment: [{ slot: "ranged-main-hand" as const, itemId: "item-titanstring-bow" }],
};
const iconUrl = "https://bg3.wiki/w/images/Titanstring_Bow.png";
const provenance = [
  { entityId: "item-titanstring-bow", label: "Titanstring Bow", url: "https://bg3.wiki/wiki/Titanstring_Bow", iconUrl, mechanic: "weapon" },
  { entityId: "class-fighter", label: "Fighter", url: "https://bg3.wiki/wiki/Fighter", mechanic: "class eligibility" },
  { entityId: "subclass-battle-master", label: "Battle Master", url: "https://bg3.wiki/wiki/Battle_Master", mechanic: "class eligibility" },
  { entityId: "passive-archery", label: "Archery", url: "https://bg3.wiki/wiki/Archery", mechanic: "Archery" },
];

function evaluatedWindow(label: string, turns = 1) {
  return {
    status: "evaluated" as const,
    label,
    turns,
    summary: damage,
    probabilityKill: 0.5,
    events: [{ kind: "ranged-attack" as const, source: "ordinary" as const, count: 4 }],
    resourcesSpent: [{ resource: "Action Surge", amount: 1, recovery: "short-rest" as const }],
  };
}
const report = optimizationReportSchema.parse({
  kind: "optimization",
  title: "Curated result",
  summary: "Exact within scope.",
  generatedAt: "2026-01-01T00:00:00.000Z",
  result: {
    request: { gameVersion: "Patch 8", level: 5, availableAct: 1 },
    candidates: [{
      rank: 1,
      build,
      weaponId: "item-titanstring-bow",
      rankingScore: 20,
      windows: {
        singleAttack: evaluatedWindow("Single attack"),
        opener: evaluatedWindow("Opener"),
        nova: evaluatedWindow("Nova"),
        steadyState: evaluatedWindow("Steady-state round"),
        surprise: { status: "unsupported", label: "Surprised first round", reasonCode: "surprise-initiative-and-condition-state", explanation: "Needs initiative." },
        setup: { status: "unsupported", label: "Setup", reasonCode: "setup-effect-state-not-modeled", explanation: "Needs effect state." },
        horizons: [1, 2, 3, 5].map(function createHorizon(rounds) {
          return { rounds, window: evaluatedWindow(`${rounds}-round total`, rounds) };
        }),
      },
      policy: { archery: "always", extraAttack: "always", sharpshooter: "enabled" },
      provenance,
    }],
    validation: { generatedCandidates: 1, validCandidates: 1, rejectedCandidates: 0, rejectionReasons: {} },
    ranking: { window: "nova", metric: "expectedDamage", tieBreakers: ["steadyState.expectedDamage", "build.id", "sharpshooterPolicy"] }, bounds: { evaluatedCandidates: 1, candidateSetSize: 1, returnedCandidates: 1, searchScope: "curated-l5-act1-ranged-windows-v2", exactWithinDeclaredScope: true, globallyOptimal: false },
    unsupportedMechanics: ["surprise"],
    guarantee: "Every declared candidate was evaluated.",
  },
});

function render() {
  const node = document.createElement("div");
  const root = createRoot(node);
  act(() => root.render(<OptimizationReportCard report={report} />));
  return { node, unmount: () => act(() => root.unmount()) };
}

describe("OptimizationReportCard", () => {
  it("renders canonical icons before linked entity labels", () => {
    const view = render();
    const titanstringLink = [...view.node.querySelectorAll("a")].find(link => link.textContent === "Titanstring Bow")!;
    const image = titanstringLink.querySelector("img")!;

    expect(image.src).toBe(iconUrl);
    expect(image.alt).toBe("");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(titanstringLink.firstElementChild).toBe(image);
    expect(titanstringLink.target).toBe("_blank");
    expect(titanstringLink.rel).toBe("noopener noreferrer");
    expect([...view.node.querySelectorAll("a")].find(link => link.textContent === "Fighter")?.querySelector("img")).toBeNull();
    expect(view.node.textContent).toContain("Target HP50");
    expect(view.node.textContent).toContain("Nova");
    expect(view.node.textContent).toContain("Action Surge ×1 (short-rest)");
    expect(view.node.textContent).toContain("Surprised first round: unsupported");
    expect(view.node.textContent).toContain("Setup: unsupported");
    view.unmount();
  });

  it("keeps the linked label when an icon fails", () => {
    const view = render();
    const titanstringLink = [...view.node.querySelectorAll("a")].find(link => link.textContent === "Titanstring Bow")!;
    act(() => titanstringLink.querySelector("img")?.dispatchEvent(new Event("error")));

    expect(titanstringLink.querySelector("img")).toBeNull();
    expect(titanstringLink.textContent).toBe("Titanstring Bow");
    expect(titanstringLink.href).toBe("https://bg3.wiki/wiki/Titanstring_Bow");
    view.unmount();
  });
});
