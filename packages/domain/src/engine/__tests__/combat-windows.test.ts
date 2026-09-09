import { describe, expect, it } from "vitest";
import { combineCombatPlans, evaluateCombatPlan, repeatCombatPlan, type CombatPlan } from "../../index.js";

const attack = {
  attackBonus: 100,
  armorClass: 1,
  rollMode: "normal" as const,
  criticalThreshold: 20,
  guaranteedCritical: false,
  packets: [{ damageType: "piercing" as const, dice: [], flat: 10, crittable: true }],
  target: {},
};

const steady: CombatPlan = {
  label: "Steady",
  turns: 1,
  events: [{ source: "ordinary", count: 2, attack }],
  resourcesSpent: [],
};

const nova: CombatPlan = {
  label: "Nova",
  turns: 1,
  events: [{ source: "ordinary", count: 4, attack }],
  resourcesSpent: [{ resource: "Action Surge", amount: 1, recovery: "short-rest" }],
};

describe("combat window plans", () => {
  it("evaluates exact schedules and HP-threshold kill probability", () => {
    const result = evaluateCombatPlan(nova, 40);
    expect(result.result).toMatchObject({
      turns: 1,
      events: [{ source: "ordinary", count: 4 }],
      resourcesSpent: [{ resource: "Action Surge", amount: 1, recovery: "short-rest" }],
      summary: { expected: expect.closeTo(38), nonCritMax: 40, critMax: 40 },
      probabilityKill: expect.closeTo(0.95 ** 4),
    });
    expect(evaluateCombatPlan(nova, 41).result.probabilityKill).toBe(0);
    expect(evaluateCombatPlan(nova, 1).result.probabilityKill).toBeCloseTo(1 - 0.05 ** 4);
  });

  it("builds configurable horizons from one nova and later steady rounds", () => {
    for (const rounds of [1, 2, 3, 5]) {
      const plan = rounds === 1 ? nova : combineCombatPlans(`${rounds} rounds`, nova, repeatCombatPlan(steady, rounds - 1));
      const result = evaluateCombatPlan(plan, 1_000).result;
      expect(result.turns).toBe(rounds);
      expect(result.events.reduce((total, event) => total + event.count, 0)).toBe(4 + (rounds - 1) * 2);
      expect(result.resourcesSpent).toEqual([{ resource: "Action Surge", amount: 1, recovery: "short-rest" }]);
    }
  });

  it("rejects empty, invalid, and unsafe plans instead of truncating", () => {
    expect(() => evaluateCombatPlan({ label: "empty", turns: 1, events: [], resourcesSpent: [] }, 10)).toThrow(RangeError);
    expect(() => repeatCombatPlan(steady, 9)).toThrow(RangeError);
    expect(() => evaluateCombatPlan({ ...steady, events: [{ ...steady.events[0]!, count: 21 }] }, 10)).toThrow(RangeError);
    expect(() => evaluateCombatPlan({ ...steady, label: " " }, 10)).toThrow(RangeError);
    expect(() => evaluateCombatPlan({ ...steady, resourcesSpent: [{ resource: "", amount: 0, recovery: "short-rest" }] }, 10)).toThrow(RangeError);
  });
});
