import { describe, expect, it } from "vitest";
import { calculateAttackPmf, classifyAttackRolls, convolvePmfs, dicePmf, repeatAttacks, repeatPmf } from "../../index.js";

describe("exact dice PMFs", () => {
  it("builds exact integer dice distributions and convolves them", () => {
    const d6 = dicePmf({ count: 1, sides: 6 });
    expect(d6.size).toBe(6);
    expect(d6.get(1)).toBeCloseTo(1 / 6);
    const twoD6 = convolvePmfs(d6, d6);
    expect(twoD6.get(2)).toBeCloseTo(1 / 36);
    expect(twoD6.get(7)).toBeCloseTo(6 / 36);
    expect(twoD6.get(12)).toBeCloseTo(1 / 36);
    expect(repeatPmf(d6, 0)).toEqual(new Map([[0, 1]]));
  });
});

describe("attack roll classification", () => {
  it("enforces natural one misses and natural twenty hits across roll modes", () => {
    const normal = classifyAttackRolls({ attackBonus: 100, armorClass: 1, rollMode: "normal", criticalThreshold: 20, guaranteedCritical: false });
    expect(normal[0]).toMatchObject({ roll: 1, outcome: "miss", probability: 0.05 });
    expect(normal[19]).toMatchObject({ roll: 20, outcome: "critical", probability: 0.05 });
    const advantage = classifyAttackRolls({ attackBonus: 0, armorClass: 100, rollMode: "advantage", criticalThreshold: 20, guaranteedCritical: false });
    const disadvantage = classifyAttackRolls({ attackBonus: 0, armorClass: 100, rollMode: "disadvantage", criticalThreshold: 20, guaranteedCritical: false });
    expect(advantage[19]?.probability).toBeCloseTo(39 / 400);
    expect(disadvantage[19]?.probability).toBeCloseTo(1 / 400);
    expect(advantage.filter(({ outcome }) => outcome !== "miss")).toEqual([expect.objectContaining({ roll: 20, outcome: "critical" })]);
  });
});

describe("attack PMF", () => {
  const base = {
    attackBonus: 5, armorClass: 15, rollMode: "normal" as const, criticalThreshold: 20,
    packets: [{ damageType: "fire" as const, dice: [{ count: 1, sides: 6 }], flat: 2, crittable: true }],
    target: {},
  };

  it("doubles only crittable dice on successful critical hits", () => {
    const result = calculateAttackPmf({ ...base, packets: [...base.packets, { damageType: "cold", dice: [{ count: 1, sides: 4 }], flat: 3, crittable: false }] });
    expect(result.summary.nonCritMax).toBe(15);
    expect(result.summary.critMax).toBe(21);
    expect(result.summary.minimum).toBe(0);
    expect(result.summary.minimumOnHit).toBe(7);
    expect(result.summary.probabilityZero).toBeCloseTo(0.45);
    expect(result.summary.expected).toBeCloseTo(0.5 * 11 + 0.05 * 14.5);
    expect([...result.pmf.values()].reduce((sum, probability) => sum + probability, 0)).toBeCloseTo(1);
    expect(result.trace.map(({ step }) => step)).toEqual(["attack-roll", "damage-packets", "summary"]);
  });

  it("applies immunity, resistance, vulnerability, and reduction per packet", () => {
    const result = calculateAttackPmf({
      ...base, armorClass: 1, guaranteedCritical: true,
      packets: [
        { damageType: "fire", dice: [], flat: 10, crittable: true },
        { damageType: "cold", dice: [], flat: 10, crittable: true },
        { damageType: "acid", dice: [], flat: 10, crittable: true },
      ],
      target: { immunities: ["fire"], resistances: ["cold"], vulnerabilities: ["acid"], flatReduction: 1, flatReductionByType: { acid: 2 } },
    });
    expect(result.summary.minimumOnHit).toBe(21);
    expect(result.summary.critMax).toBe(21);
  });

  it("supports repeated attacks and summary percentiles", () => {
    const result = repeatAttacks(base, 2);
    expect(result.pmf.get(0)).toBeCloseTo(0.45 ** 2);
    expect(result.summary.variance).toBeGreaterThan(0);
    expect(result.summary.stddev).toBeGreaterThan(0);
    expect(result.summary.p10).toBeLessThanOrEqual(result.summary.median);
    expect(result.summary.median).toBeLessThanOrEqual(result.summary.p90);
    expect(result.trace.at(-1)).toMatchObject({ step: "repeat-attacks" });
  });
});
