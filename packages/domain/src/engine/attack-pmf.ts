import { attackInputSchema, diceExpressionSchema, type AttackInput, type AttackRollMode, type ResolvedDamagePacket, type DiceExpression, type ResolvedAttackInput, type ResolvedTargetDamageModifiers } from "../schemas/index.js";

export type IntegerPmf = ReadonlyMap<number, number>;
export type AttackOutcome = "miss" | "hit" | "critical";
export type AttackRollClassification = { roll: number; outcome: AttackOutcome; probability: number };
export type AttackTrace = { step: string; input: Record<string, unknown>; output: Record<string, unknown> };
export type DamageSummary = {
  expected: number;
  minimum: number;
  minimumOnHit: number;
  nonCritMax: number;
  critMax: number;
  variance: number;
  stddev: number;
  p10: number;
  median: number;
  p90: number;
  probabilityZero: number;
};
export type AttackPmfResult = {
  pmf: IntegerPmf;
  rollClassification: readonly AttackRollClassification[];
  summary: DamageSummary;
  trace: readonly AttackTrace[];
};

const one = new Map([[0, 1]]);
export const MAX_REPEATED_ATTACKS = 20;
const MAX_REPEATED_DAMAGE_SUPPORT = 12_800;
const MAX_PUBLIC_PMF_ENTRIES = 12_801;
const MAX_PUBLIC_CONVOLUTION_PAIRS = 1_000_000;
const PMF_NORMALIZATION_TOLERANCE = 1e-9;

function addProbability(target: Map<number, number>, value: number, probability: number): void {
  target.set(value, (target.get(value) ?? 0) + probability);
}

function validatePmf(pmf: IntegerPmf, name: string): { minimum: number; maximum: number } {
  if (pmf.size === 0 || pmf.size > MAX_PUBLIC_PMF_ENTRIES) throw new RangeError(`${name} must have between 1 and ${MAX_PUBLIC_PMF_ENTRIES} outcomes`);
  let total = 0;
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const [value, probability] of pmf) {
    if (!Number.isSafeInteger(value)) throw new RangeError(`${name} outcomes must be safe integers`);
    if (!Number.isFinite(probability) || probability < 0) throw new RangeError(`${name} probabilities must be finite and non-negative`);
    total += probability;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  if (!Number.isFinite(total) || Math.abs(total - 1) > PMF_NORMALIZATION_TOLERANCE) throw new RangeError(`${name} probabilities must sum to 1`);
  return { minimum, maximum };
}

function convolvePmfsUnchecked(left: IntegerPmf, right: IntegerPmf): IntegerPmf {
  const result = new Map<number, number>();
  for (const [leftValue, leftProbability] of left) for (const [rightValue, rightProbability] of right) addProbability(result, leftValue + rightValue, leftProbability * rightProbability);
  return result;
}

export function convolvePmfs(left: IntegerPmf, right: IntegerPmf): IntegerPmf {
  const leftSupport = validatePmf(left, "left PMF");
  const rightSupport = validatePmf(right, "right PMF");
  if (left.size * right.size > MAX_PUBLIC_CONVOLUTION_PAIRS) throw new RangeError("PMF convolution has too many outcome pairs");
  if (leftSupport.maximum - leftSupport.minimum + rightSupport.maximum - rightSupport.minimum > MAX_REPEATED_DAMAGE_SUPPORT) throw new RangeError("convolved PMF support is too wide");
  if (!Number.isSafeInteger(leftSupport.minimum + rightSupport.minimum) || !Number.isSafeInteger(leftSupport.maximum + rightSupport.maximum)) throw new RangeError("convolved PMF outcomes exceed safe integer arithmetic");
  return convolvePmfsUnchecked(left, right);
}

function repeatPmfWith(
  pmf: IntegerPmf,
  count: number,
  convolve: (left: IntegerPmf, right: IntegerPmf) => IntegerPmf,
): IntegerPmf {
  let result: IntegerPmf = one;
  let factor = pmf;
  let remaining = count;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = convolve(result, factor);
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) factor = convolve(factor, factor);
  }
  return result;
}

export function repeatPmf(pmf: IntegerPmf, count: number): IntegerPmf {
  if (!Number.isInteger(count) || count < 0 || count > MAX_REPEATED_ATTACKS) throw new RangeError(`count must be an integer between 0 and ${MAX_REPEATED_ATTACKS}`);
  const { minimum, maximum } = validatePmf(pmf, "PMF");
  if ((maximum - minimum) * count > MAX_REPEATED_DAMAGE_SUPPORT) throw new RangeError("repeated PMF support is too wide");
  if (!Number.isSafeInteger(minimum * count) || !Number.isSafeInteger(maximum * count)) throw new RangeError("repeated PMF outcomes exceed safe integer arithmetic");
  let remainingPairs = MAX_PUBLIC_CONVOLUTION_PAIRS;
  function convolveWithinBudget(left: IntegerPmf, right: IntegerPmf): IntegerPmf {
    const pairs = left.size * right.size;
    if (pairs > remainingPairs) throw new RangeError("repeated PMF has too many convolution pairs");
    remainingPairs -= pairs;
    return convolvePmfs(left, right);
  }
  return repeatPmfWith(pmf, count, convolveWithinBudget);
}

function dicePmfUnchecked(dice: DiceExpression): IntegerPmf {
  if (dice.count === 0) return one;
  const die = new Map<number, number>();
  for (let face = 1; face <= dice.sides; face += 1) die.set(face, 1 / dice.sides);
  return repeatPmfWith(die, dice.count, convolvePmfsUnchecked);
}

export function dicePmf(dice: DiceExpression): IntegerPmf {
  return dicePmfUnchecked(diceExpressionSchema.parse(dice));
}

function rollProbability(roll: number, mode: AttackRollMode): number {
  if (mode === "normal") return 1 / 20;
  if (mode === "advantage") return (roll * roll - (roll - 1) * (roll - 1)) / 400;
  return ((21 - roll) * (21 - roll) - (20 - roll) * (20 - roll)) / 400;
}

export function classifyAttackRolls(input: Pick<ResolvedAttackInput, "attackBonus" | "armorClass" | "rollMode" | "criticalThreshold" | "guaranteedCritical">): AttackRollClassification[] {
  const results: AttackRollClassification[] = [];
  for (let roll = 1; roll <= 20; roll += 1) {
    const isHit = roll !== 1 && (roll === 20 || roll + input.attackBonus >= input.armorClass);
    const critical = isHit && (input.guaranteedCritical || roll >= input.criticalThreshold);
    results.push({ roll, outcome: !isHit ? "miss" : critical ? "critical" : "hit", probability: rollProbability(roll, input.rollMode) });
  }
  return results;
}

function packetPmf(packet: ResolvedDamagePacket, critical: boolean, target: ResolvedTargetDamageModifiers): IntegerPmf {
  let result: IntegerPmf = new Map([[packet.flat, 1]]);
  for (const dice of packet.dice) result = convolvePmfsUnchecked(result, dicePmfUnchecked({ ...dice, count: dice.count * (critical && packet.crittable ? 2 : 1) }));
  const multiplier = target.immunities.includes(packet.damageType) ? 0 : (target.vulnerabilities.includes(packet.damageType) ? 2 : 1) * (target.resistances.includes(packet.damageType) ? 0.5 : 1);
  const reduction = target.flatReduction + (target.flatReductionByType[packet.damageType] ?? 0);
  const mitigated = new Map<number, number>();
  for (const [value, probability] of result) addProbability(mitigated, Math.max(0, Math.floor(value * multiplier) - reduction), probability);
  return mitigated;
}

function damagePmf(packets: readonly ResolvedDamagePacket[], critical: boolean, target: ResolvedTargetDamageModifiers): IntegerPmf {
  return packets.reduce<IntegerPmf>((total, packet) => convolvePmfsUnchecked(total, packetPmf(packet, critical, target)), one);
}

export function summarizePmf(pmf: IntegerPmf): DamageSummary {
  const values = [...pmf.entries()].sort(([left], [right]) => left - right);
  const expected = values.reduce((sum, [value, probability]) => sum + value * probability, 0);
  const variance = values.reduce((sum, [value, probability]) => sum + (value - expected) ** 2 * probability, 0);
  const quantile = (target: number): number => {
    let cumulative = 0;
    for (const [value, probability] of values) { cumulative += probability; if (cumulative + Number.EPSILON >= target) return value; }
    return values.at(-1)?.[0] ?? 0;
  };
  return {
    expected, minimum: values[0]?.[0] ?? 0, minimumOnHit: values.find(([value, probability]) => value > 0 && probability > 0)?.[0] ?? 0,
    nonCritMax: values.at(-1)?.[0] ?? 0, critMax: values.at(-1)?.[0] ?? 0,
    variance, stddev: Math.sqrt(variance), p10: quantile(0.1), median: quantile(0.5), p90: quantile(0.9), probabilityZero: pmf.get(0) ?? 0,
  };
}

export function calculateAttackPmf(rawInput: AttackInput): AttackPmfResult {
  const input: ResolvedAttackInput = attackInputSchema.parse(rawInput);
  const rollClassification = classifyAttackRolls(input);
  const outcomes = new Map<AttackOutcome, number>([["miss", 0], ["hit", 0], ["critical", 0]]);
  for (const classification of rollClassification) outcomes.set(classification.outcome, (outcomes.get(classification.outcome) ?? 0) + classification.probability);
  const nonCritical = damagePmf(input.packets, false, input.target);
  const critical = damagePmf(input.packets, true, input.target);
  const pmf = new Map<number, number>([[0, outcomes.get("miss") ?? 0]]);
  for (const [value, probability] of nonCritical) addProbability(pmf, value, probability * (outcomes.get("hit") ?? 0));
  for (const [value, probability] of critical) addProbability(pmf, value, probability * (outcomes.get("critical") ?? 0));
  const summary = summarizePmf(pmf);
  const hitOutcomes = new Map<number, number>();
  if ((outcomes.get("hit") ?? 0) > 0) for (const [value, probability] of nonCritical) addProbability(hitOutcomes, value, probability);
  if ((outcomes.get("critical") ?? 0) > 0) for (const [value, probability] of critical) addProbability(hitOutcomes, value, probability);
  summary.minimumOnHit = [...hitOutcomes.keys()].filter((value) => value > 0).sort((left, right) => left - right)[0] ?? 0;
  summary.nonCritMax = Math.max(...nonCritical.keys());
  summary.critMax = Math.max(...critical.keys());
  return {
    pmf, rollClassification, summary,
    trace: [
      { step: "attack-roll", input: { mode: input.rollMode, attackBonus: input.attackBonus, armorClass: input.armorClass, criticalThreshold: input.criticalThreshold, guaranteedCritical: input.guaranteedCritical }, output: Object.fromEntries(outcomes) },
      { step: "damage-packets", input: { packets: input.packets, target: input.target }, output: { nonCriticalOutcomes: nonCritical.size, criticalOutcomes: critical.size } },
      { step: "summary", input: {}, output: summary as unknown as Record<string, unknown> },
    ],
  };
}

export function repeatAttacks(input: AttackInput, count: number): AttackPmfResult {
  if (!Number.isInteger(count) || count < 0 || count > MAX_REPEATED_ATTACKS) throw new RangeError(`count must be an integer between 0 and ${MAX_REPEATED_ATTACKS}`);
  const attack = calculateAttackPmf(input);
  const supportWidth = (attack.summary.critMax - attack.summary.minimum) * count;
  if (supportWidth > MAX_REPEATED_DAMAGE_SUPPORT) throw new RangeError("repeated attack damage range is too wide for exact PMF calculation");
  const pmf = repeatPmf(attack.pmf, count);
  const summary = summarizePmf(pmf);
  summary.nonCritMax = attack.summary.nonCritMax * count;
  summary.critMax = attack.summary.critMax * count;
  return { ...attack, pmf, summary, trace: [...attack.trace, { step: "repeat-attacks", input: { count }, output: { outcomes: pmf.size } }] };
}
