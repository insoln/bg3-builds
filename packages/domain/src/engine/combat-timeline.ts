import type { DamageSummary } from "./attack-pmf.js";
import { convolvePmfs, summarizePmf, type IntegerPmf } from "./attack-pmf.js";
import { evaluateCombatPlan, type CombatPlan, type CombatPlanEvent } from "./combat-windows.js";

export type EqualInitiativePolicy = "candidate-first" | "target-first";
export type TimelineTurnContext = {
  round: 1 | 2;
  targetSurprised: boolean;
  targetHadTakenTurn: boolean;
  order: EqualInitiativePolicy;
};
export type ResolvedTimelineTurn = {
  plan: CombatPlan;
  appliedFeatures: readonly string[];
};
export type TimelineTurn = Omit<TimelineTurnContext, "order"> & {
  events: readonly { kind: "ranged-attack"; source: CombatPlanEvent["source"]; count: number }[];
};
export type CombatTimelineInput = {
  candidateInitiativeModifier: number;
  candidateDexterityScore: number;
  targetInitiativeModifier: number;
  targetDexterityScore: number;
  equalTotalAndDexterity: EqualInitiativePolicy;
  surprisedDeniedTurnCountsAsTaken: boolean;
  resolveTurn: (context: TimelineTurnContext) => ResolvedTimelineTurn;
};
export type EvaluatedCombatTimelineCase = {
  order: EqualInitiativePolicy;
  candidateTurns: 0 | 1 | 2;
  turnsBeforeTargetFirstActionableTurn: readonly TimelineTurn[];
  appliedFeatures: readonly string[];
  initiativePairs: number;
  weight: number;
  summary: DamageSummary;
  probabilityKill: number;
};
export type CombatTimelineScenario = {
  cases: readonly EvaluatedCombatTimelineCase[];
  probabilityKillBeforeTargetFirstActionableTurn: number;
};
export type EvaluatedCombatTimeline = {
  metric: "probability-kill-before-target-first-actionable-turn";
  initiative: {
    die: "d4";
    candidateModifier: number;
    candidateDexterityScore: number;
    targetModifier: number;
    targetDexterityScore: number;
    equalTotalAndDexterity: EqualInitiativePolicy;
    surprisedDeniedTurnCountsAsTaken: boolean;
  };
  noSurprise: CombatTimelineScenario;
  surprised: CombatTimelineScenario;
};

type EvaluatedTurn = ResolvedTimelineTurn & { pmf: IntegerPmf; summary: DamageSummary };
const NO_DAMAGE_PMF: IntegerPmf = new Map([[0, 1]]);
const D4_PAIR_COUNT = 16;

function requireInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer`);
}
function candidateActsFirst(input: CombatTimelineInput, candidateD4: number, targetD4: number): boolean {
  const candidateTotal = input.candidateInitiativeModifier + candidateD4;
  const targetTotal = input.targetInitiativeModifier + targetD4;
  if (candidateTotal !== targetTotal) return candidateTotal > targetTotal;
  if (input.candidateDexterityScore !== input.targetDexterityScore) return input.candidateDexterityScore > input.targetDexterityScore;
  return input.equalTotalAndDexterity === "candidate-first";
}
function probabilityAtLeast(pmf: IntegerPmf, threshold: number): number {
  let probability = 0;
  for (const [damage, mass] of pmf) if (damage >= threshold) probability += mass;
  return Math.min(1, Math.max(0, probability));
}
function timelineEvents(plan: CombatPlan): TimelineTurn["events"] {
  return plan.events.map(({ source, count }) => ({ kind: "ranged-attack", source, count }));
}
function scenarioContexts(surprised: boolean, order: EqualInitiativePolicy, deniedTurnCountsAsTaken: boolean): TimelineTurnContext[] {
  if (!surprised) {
    if (order === "target-first") return [];
    return [{ round: 1, targetSurprised: false, targetHadTakenTurn: false, order }];
  }
  if (order === "target-first") {
    // SURPRISED has TickType EndRound in the installed game data, so it is
    // still active when the target's denied initiative slot precedes us.
    return [{ round: 1, targetSurprised: true, targetHadTakenTurn: deniedTurnCountsAsTaken, order }];
  }
  return [
    { round: 1, targetSurprised: true, targetHadTakenTurn: false, order },
    { round: 2, targetSurprised: false, targetHadTakenTurn: deniedTurnCountsAsTaken, order },
  ];
}

export function evaluateCombatTimeline(input: CombatTimelineInput, targetHitPoints: number): EvaluatedCombatTimeline {
  requireInteger(input.candidateInitiativeModifier, "candidate initiative modifier");
  requireInteger(input.candidateDexterityScore, "candidate Dexterity score");
  requireInteger(input.targetInitiativeModifier, "target initiative modifier");
  requireInteger(input.targetDexterityScore, "target Dexterity score");
  if (input.candidateDexterityScore < 1 || input.candidateDexterityScore > 30) throw new RangeError("candidate Dexterity score must be between 1 and 30");
  if (input.targetDexterityScore < 1 || input.targetDexterityScore > 30) throw new RangeError("target Dexterity score must be between 1 and 30");
  if (!Number.isSafeInteger(targetHitPoints) || targetHitPoints < 1) throw new RangeError("target hit points must be a positive safe integer");

  const turnCache = new Map<string, EvaluatedTurn>();
  function evaluateTurn(context: TimelineTurnContext): EvaluatedTurn {
    const key = JSON.stringify(context);
    const cached = turnCache.get(key);
    if (cached) return cached;
    const resolved = input.resolveTurn(context);
    if (resolved.plan.turns !== 1) throw new RangeError("each resolved timeline turn must contain exactly one turn");
    const evaluated = evaluateCombatPlan(resolved.plan, targetHitPoints);
    const result = { ...resolved, pmf: evaluated.pmf, summary: evaluated.result.summary };
    turnCache.set(key, result);
    return result;
  }
  function evaluateScenario(surprised: boolean): CombatTimelineScenario {
    const orderPairs = new Map<EqualInitiativePolicy, number>([["candidate-first", 0], ["target-first", 0]]);
    for (let candidateD4 = 1; candidateD4 <= 4; candidateD4 += 1) for (let targetD4 = 1; targetD4 <= 4; targetD4 += 1) {
      const order = candidateActsFirst(input, candidateD4, targetD4) ? "candidate-first" : "target-first";
      orderPairs.set(order, orderPairs.get(order)! + 1);
    }
    const cases = [...orderPairs.entries()].filter(([, pairs]) => pairs > 0).map(([order, initiativePairs]) => {
      const contexts = scenarioContexts(surprised, order, input.surprisedDeniedTurnCountsAsTaken);
      const turns = contexts.map(evaluateTurn);
      const pmf = turns.reduce<IntegerPmf>((total, turn) => convolvePmfs(total, turn.pmf), NO_DAMAGE_PMF);
      const summary = turns.length === 0 ? summarizePmf(pmf) : {
        ...summarizePmf(pmf),
        nonCritMax: turns.reduce((total, turn) => total + turn.summary.nonCritMax, 0),
        critMax: turns.reduce((total, turn) => total + turn.summary.critMax, 0),
      };
      return {
        order,
        candidateTurns: contexts.length as 0 | 1 | 2,
        turnsBeforeTargetFirstActionableTurn: contexts.map((context, index) => ({
          round: context.round,
          targetSurprised: context.targetSurprised,
          targetHadTakenTurn: context.targetHadTakenTurn,
          events: timelineEvents(turns[index]!.plan),
        })),
        appliedFeatures: [...new Set(turns.flatMap(turn => turn.appliedFeatures))],
        initiativePairs,
        weight: initiativePairs / D4_PAIR_COUNT,
        summary,
        probabilityKill: probabilityAtLeast(pmf, targetHitPoints),
      };
    });
    return { cases, probabilityKillBeforeTargetFirstActionableTurn: cases.reduce((sum, item) => sum + item.weight * item.probabilityKill, 0) };
  }
  return {
    metric: "probability-kill-before-target-first-actionable-turn",
    initiative: { die: "d4", candidateModifier: input.candidateInitiativeModifier, candidateDexterityScore: input.candidateDexterityScore, targetModifier: input.targetInitiativeModifier, targetDexterityScore: input.targetDexterityScore, equalTotalAndDexterity: input.equalTotalAndDexterity, surprisedDeniedTurnCountsAsTaken: input.surprisedDeniedTurnCountsAsTaken },
    noSurprise: evaluateScenario(false), surprised: evaluateScenario(true),
  };
}
