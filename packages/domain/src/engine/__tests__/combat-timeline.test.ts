import { describe, expect, it } from "vitest";
import { evaluateCombatTimeline, evaluatedCombatTimelineSchema, optimizationRequestSchema, type CombatPlan, type TimelineTurnContext } from "../../index.js";

const attack = { attackBonus: 100, armorClass: 1, rollMode: "normal" as const, criticalThreshold: 20, guaranteedCritical: false, packets: [{ damageType: "piercing" as const, dice: [], flat: 10, crittable: true }], target: {} };
const plan = (context: TimelineTurnContext): CombatPlan => ({ label: `Round ${context.round}`, turns: 1, events: [{ source: "ordinary", count: 1, attack }], resourcesSpent: [] });
const input = (countsAsTaken = true) => ({
  candidateInitiativeModifier: 0, candidateDexterityScore: 10, targetInitiativeModifier: 0, targetDexterityScore: 10,
  equalTotalAndDexterity: "target-first" as const, surprisedDeniedTurnCountsAsTaken: countsAsTaken,
  resolveTurn: (context: TimelineTurnContext) => ({
    plan: plan(context),
    appliedFeatures: [context.targetHadTakenTurn ? "after-turn" : "before-turn", ...(context.targetSurprised ? ["assassinate-ambush"] : [])],
  }),
});

describe("exact combat timeline", () => {
  it("enumerates sixteen d4 pairs and exposes both conditional branches", () => {
    const result = evaluateCombatTimeline(input(), 10);
    expect(result).toMatchObject({ metric: "probability-kill-before-target-first-actionable-turn", initiative: { die: "d4", candidateModifier: 0, targetModifier: 0, surprisedDeniedTurnCountsAsTaken: true } });
    expect(result.noSurprise.cases).toHaveLength(2);
    expect(result.noSurprise.cases.find(({ order }) => order === "target-first")).toMatchObject({ candidateTurns: 0, initiativePairs: 10, weight: 10 / 16 });
    expect(result.noSurprise.cases.find(({ order }) => order === "candidate-first")).toMatchObject({ candidateTurns: 1, initiativePairs: 6, weight: 6 / 16, appliedFeatures: ["before-turn"] });
    expect(result.noSurprise.probabilityKillBeforeTargetFirstActionableTurn).toBeCloseTo(6 / 16 * 0.95);
    expect(evaluatedCombatTimelineSchema.parse(result)).toEqual(result);
  });

  it("breaks equal totals by Dexterity, then explicit policy", () => {
    const higherDexterity = evaluateCombatTimeline({ ...input(), candidateDexterityScore: 11 }, 10);
    expect(higherDexterity.noSurprise.cases.find(({ order }) => order === "candidate-first")).toMatchObject({ initiativePairs: 10 });
    const candidateFirst = evaluateCombatTimeline({ ...input(), equalTotalAndDexterity: "candidate-first" }, 10);
    expect(candidateFirst.noSurprise.cases.find(({ order }) => order === "candidate-first")).toMatchObject({ initiativePairs: 10 });
  });

  it("keeps surprised schedules fixed while exposing the denied-turn assumption to turn resolution", () => {
    const counts = evaluateCombatTimeline(input(true), 20).surprised;
    const doesNotCount = evaluateCombatTimeline(input(false), 20).surprised;
    for (const scenario of [counts, doesNotCount]) {
      expect(scenario.cases.find(({ order }) => order === "target-first")).toMatchObject({ candidateTurns: 1 });
      expect(scenario.cases.find(({ order }) => order === "candidate-first")).toMatchObject({ candidateTurns: 2, probabilityKill: expect.closeTo(0.95 ** 2) });
    }
    const candidateFirst = counts.cases.find(({ order }) => order === "candidate-first")!;
    expect(candidateFirst.turnsBeforeTargetFirstActionableTurn[0]).toMatchObject({ round: 1, targetSurprised: true, targetHadTakenTurn: false });
    expect(candidateFirst.turnsBeforeTargetFirstActionableTurn[1]).toMatchObject({ round: 2, targetSurprised: false, targetHadTakenTurn: true });
    expect(candidateFirst.appliedFeatures).toEqual(["before-turn", "assassinate-ambush", "after-turn"]);
    expect(candidateFirst.turnsBeforeTargetFirstActionableTurn.filter(turn => turn.targetSurprised)).toHaveLength(1);
    expect(doesNotCount.cases.find(({ order }) => order === "candidate-first")?.turnsBeforeTargetFirstActionableTurn[1]).toMatchObject({ targetHadTakenTurn: false });
    expect(doesNotCount.cases.find(({ order }) => order === "candidate-first")?.appliedFeatures).toEqual(["before-turn", "assassinate-ambush"]);
  });

  it("rejects invalid Dexterity and multi-turn callback plans", () => {
    expect(() => evaluateCombatTimeline({ ...input(), candidateDexterityScore: 31 }, 10)).toThrow("between 1 and 30");
    expect(() => evaluateCombatTimeline({
      ...input(),
      resolveTurn: context => ({ plan: { ...plan(context), turns: 2 }, appliedFeatures: [] }),
    }, 10)).toThrow("exactly one turn");
  });

  it("requires visible assumptions and allows topK 24", () => {
    expect(optimizationRequestSchema.parse({ gameVersion: "Patch 8", level: 5, availableAct: 1, topK: 24, combat: { mode: "ranged", targetInitiativeModifier: 2, targetDexterityScore: 14, equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken: true } }).topK).toBe(24);
    expect(optimizationRequestSchema.safeParse({ gameVersion: "Patch 8", level: 5, availableAct: 1, combat: { mode: "ranged" } }).success).toBe(false);
  });
});
