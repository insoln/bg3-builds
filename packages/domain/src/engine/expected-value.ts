import type { DamageType } from "../schemas/index.js";
import type { AttackExpectation, ExplainTrace } from "./types.js";

export function hitChance(attackBonus: number, armorClass: number, advantage: "normal" | "advantage" | "disadvantage" = "normal"): number {
  const normal = Math.min(0.95, Math.max(0.05, (21 + attackBonus - armorClass) / 20));
  if (advantage === "advantage") return 1 - (1 - normal) ** 2;
  if (advantage === "disadvantage") return normal ** 2;
  return normal;
}

export function mitigateDamage(amount: number, damageType: DamageType, resistances: readonly DamageType[], flatReduction = 0): { value: number; trace: ExplainTrace[] } {
  const resisted = resistances.includes(damageType) ? amount / 2 : amount;
  const value = Math.max(0, resisted - flatReduction);
  return { value, trace: [
    { step: "resistance", message: "Applied resistance before flat damage reduction", input: { amount, damageType, resisted: resistances.includes(damageType) }, output: resisted },
    { step: "flat-reduction", message: "Applied flat damage reduction", input: { flatReduction }, output: value },
  ] };
}

export function expectedAttackDamage(input: { attackBonus: number; armorClass: number; damageOnHit: number; damageType: DamageType; resistances?: readonly DamageType[]; flatReduction?: number; advantage?: "normal" | "advantage" | "disadvantage" }): AttackExpectation {
  const chance = hitChance(input.attackBonus, input.armorClass, input.advantage);
  const mitigated = mitigateDamage(input.damageOnHit, input.damageType, input.resistances ?? [], input.flatReduction);
  const expectedDamage = chance * mitigated.value;
  return { hitChance: chance, damageOnHit: mitigated.value, expectedDamage, trace: [...mitigated.trace, { step: "expected-damage", message: "Multiplied hit chance by post-mitigation damage", input: { hitChance: chance, damageOnHit: mitigated.value }, output: expectedDamage }] };
}
