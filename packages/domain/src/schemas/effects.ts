import { z } from "zod";
import { abilitySchema, damageTypeSchema, entityIdSchema, skillSchema } from "./entities.js";
import { requirementSchema } from "./requirements.js";

export const valueExpressionSchema = z.object({
  base: z.number().finite().default(0),
  dice: z.object({ count: z.int().min(1), sides: z.int().min(2) }).strict().optional(),
  abilityModifier: abilitySchema.optional(),
  perLevel: z.number().finite().optional(),
}).strict();
const modifierEffectSchema = z.object({ type: z.literal("modifier"), target: z.string().trim().min(1), value: valueExpressionSchema, stacking: z.enum(["add", "replace", "maximum"]).default("add") }).strict();
const damageEffectSchema = z.object({ type: z.literal("damage"), damageType: damageTypeSchema, value: valueExpressionSchema, target: z.enum(["weapon", "spell", "unarmed", "all"]).default("all") }).strict();
const grantEffectSchema = z.object({ type: z.literal("grant"), entityId: entityIdSchema, uses: z.int().min(1).optional(), recharge: z.enum(["turn", "short-rest", "long-rest", "never"]).optional() }).strict();
const proficiencyEffectSchema = z.object({ type: z.literal("proficiency"), proficiency: z.union([skillSchema, z.string().trim().min(1)]), expertise: z.boolean().default(false) }).strict();
const resistanceEffectSchema = z.object({ type: z.literal("resistance"), damageType: damageTypeSchema, mode: z.enum(["resistance", "immunity", "vulnerability"]) }).strict();
const resourceEffectSchema = z.object({ type: z.literal("resource"), resource: z.string().trim().min(1), amount: z.int() }).strict();

export const effectSchema = z.discriminatedUnion("type", [modifierEffectSchema, damageEffectSchema, grantEffectSchema, proficiencyEffectSchema, resistanceEffectSchema, resourceEffectSchema]);
export const conditionalEffectSchema = z.object({ id: entityIdSchema.optional(), effect: effectSchema, requirements: requirementSchema.optional(), notes: z.string().trim().min(1).optional() }).strict();

export type ValueExpression = z.infer<typeof valueExpressionSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type ConditionalEffect = z.infer<typeof conditionalEffectSchema>;
