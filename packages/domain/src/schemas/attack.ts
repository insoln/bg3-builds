import { z } from "zod";
import { damageTypeSchema } from "./entities.js";

export const diceExpressionSchema = z.object({
  count: z.int().min(0).max(12),
  sides: z.int().min(2).max(20),
}).strict();

export const attackRollModeSchema = z.enum(["normal", "advantage", "disadvantage"]);

export const damagePacketSchema = z.object({
  damageType: damageTypeSchema,
  dice: z.array(diceExpressionSchema).max(4).default([]),
  flat: z.int().min(-1_000).max(1_000).default(0),
  crittable: z.boolean().default(true),
}).strict();

export const targetDamageModifiersSchema = z.object({
  immunities: z.array(damageTypeSchema).default([]),
  resistances: z.array(damageTypeSchema).default([]),
  vulnerabilities: z.array(damageTypeSchema).default([]),
  flatReduction: z.int().min(0).max(1_000).default(0),
  flatReductionByType: z.partialRecord(damageTypeSchema, z.int().min(0).max(1_000)).default({}),
}).strict();

export const attackInputSchema = z.object({
  attackBonus: z.int(),
  armorClass: z.int().min(1),
  rollMode: attackRollModeSchema.default("normal"),
  criticalThreshold: z.int().min(1).max(20).default(20),
  guaranteedCritical: z.boolean().default(false),
  packets: z.array(damagePacketSchema).min(1).max(8),
  target: targetDamageModifiersSchema.default({ immunities: [], resistances: [], vulnerabilities: [], flatReduction: 0, flatReductionByType: {} }),
}).strict().superRefine((input, context) => {
  const diceCount = input.packets.reduce((total, packet) => total + packet.dice.reduce((packetTotal, dice) => packetTotal + dice.count, 0), 0);
  const supportWidth = input.packets.reduce((total, packet) => total + packet.dice.reduce((packetTotal, dice) => packetTotal + dice.count * (dice.sides - 1), 0), 0);
  if (diceCount > 32) context.addIssue({ code: "custom", path: ["packets"], message: "Attack may contain at most 32 dice" });
  if (supportWidth > 320) context.addIssue({ code: "custom", path: ["packets"], message: "Attack damage range is too wide for exact PMF calculation" });
  const absoluteMaximum = input.packets.reduce((total, packet) => total + Math.abs(packet.flat) + packet.dice.reduce((packetTotal, dice) => packetTotal + dice.count * dice.sides * 2, 0), 0);
  if (!Number.isSafeInteger(absoluteMaximum)) context.addIssue({ code: "custom", path: ["packets"], message: "Attack damage exceeds safe integer arithmetic" });
});

export type DiceExpression = z.infer<typeof diceExpressionSchema>;
export type AttackRollMode = z.infer<typeof attackRollModeSchema>;
export type DamagePacket = z.infer<typeof damagePacketSchema>;
export type TargetDamageModifiers = z.infer<typeof targetDamageModifiersSchema>;
export type AttackInput = z.input<typeof attackInputSchema>;
export type ResolvedDamagePacket = { damageType: DamagePacket["damageType"]; dice: DiceExpression[]; flat: number; crittable: boolean };
export type ResolvedTargetDamageModifiers = { immunities: DamagePacket["damageType"][]; resistances: DamagePacket["damageType"][]; vulnerabilities: DamagePacket["damageType"][]; flatReduction: number; flatReductionByType: Partial<Record<DamagePacket["damageType"], number>> };
export type ResolvedAttackInput = {
  attackBonus: number;
  armorClass: number;
  rollMode: AttackRollMode;
  criticalThreshold: number;
  guaranteedCritical: boolean;
  packets: ResolvedDamagePacket[];
  target: ResolvedTargetDamageModifiers;
};
