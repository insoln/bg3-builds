import { evaluatedWindowSchema, type AttackInput, type EvaluatedDamageWindow } from "../schemas/index.js";
import { calculateAttackPmf, convolvePmfs, repeatAttacks, summarizePmf, type AttackPmfResult, type IntegerPmf } from "./attack-pmf.js";

export type CombatPlanEvent = {
  source: "ordinary" | "dread-ambusher";
  count: number;
  attack: AttackInput;
};

export type CombatResourceSpend = {
  resource: string;
  amount: number;
  recovery: "at-will" | "encounter" | "short-rest" | "long-rest";
};

export type CombatPlan = {
  label: string;
  turns: number;
  events: readonly CombatPlanEvent[];
  resourcesSpent: readonly CombatResourceSpend[];
};

export type EvaluatedCombatPlan = {
  pmf: IntegerPmf;
  result: EvaluatedDamageWindow;
};

function probabilityAtLeast(pmf: IntegerPmf, threshold: number): number {
  let probability = 0;

  for (const [damage, mass] of pmf) {
    if (damage >= threshold) probability += mass;
  }

  return Math.min(1, Math.max(0, probability));
}

function evaluateEvent(event: CombatPlanEvent): AttackPmfResult {
  if (!Number.isInteger(event.count) || event.count < 1) {
    throw new RangeError("combat plan event count must be a positive integer");
  }

  if (event.count === 1) return calculateAttackPmf(event.attack);
  return repeatAttacks(event.attack, event.count);
}

export function evaluateCombatPlan(plan: CombatPlan, targetHitPoints: number): EvaluatedCombatPlan {
  if (plan.label.trim().length === 0) {
    throw new RangeError("combat plan label must not be empty");
  }
  if (!Number.isInteger(plan.turns) || plan.turns < 1) {
    throw new RangeError("combat plan turns must be a positive integer");
  }
  if (!Number.isInteger(targetHitPoints) || targetHitPoints < 1) {
    throw new RangeError("target hit points must be a positive integer");
  }
  if (plan.events.length === 0) {
    throw new RangeError("combat plan must contain at least one event");
  }
  for (const spend of plan.resourcesSpent) {
    if (spend.resource.trim().length === 0 || !Number.isInteger(spend.amount) || spend.amount < 1) {
      throw new RangeError("combat resource spends require a name and positive integer amount");
    }
  }

  const evaluated = plan.events.map(evaluateEvent);
  const pmf = evaluated.reduce<IntegerPmf>(
    function combineEventPmfs(combined, event): IntegerPmf {
      return convolvePmfs(combined, event.pmf);
    },
    new Map([[0, 1]]),
  );
  const summary = {
    ...summarizePmf(pmf),
    nonCritMax: evaluated.reduce(
      function addNonCriticalMaximum(total, event): number { return total + event.summary.nonCritMax; },
      0,
    ),
    critMax: evaluated.reduce(
      function addCriticalMaximum(total, event): number { return total + event.summary.critMax; },
      0,
    ),
  };

  const result = evaluatedWindowSchema.parse({
    status: "evaluated",
    label: plan.label,
    turns: plan.turns,
    summary,
    probabilityKill: probabilityAtLeast(pmf, targetHitPoints),
    events: plan.events.map(({ source, count }) => ({ kind: "ranged-attack", source, count })),
    resourcesSpent: [...plan.resourcesSpent],
  });
  return { pmf, result };
}

export function combineCombatPlans(label: string, ...plans: readonly CombatPlan[]): CombatPlan {
  if (plans.length === 0) {
    throw new RangeError("at least one combat plan is required");
  }

  return {
    label,
    turns: plans.reduce((total, plan) => total + plan.turns, 0),
    events: plans.flatMap(plan => plan.events),
    resourcesSpent: plans.flatMap(plan => plan.resourcesSpent),
  };
}

export function repeatCombatPlan(plan: CombatPlan, count: number): CombatPlan {
  if (!Number.isInteger(count) || count < 1 || count > 8) {
    throw new RangeError("combat plan repeat count must be an integer between 1 and 8");
  }

  return combineCombatPlans(
    `${count} × ${plan.label}`,
    ...Array.from({ length: count }, function repeatedPlan(): CombatPlan { return plan; }),
  );
}
