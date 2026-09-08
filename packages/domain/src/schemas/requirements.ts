import { z } from "zod";
import { abilitySchema, entityIdSchema, entityKindSchema, equipmentSlotSchema, skillSchema } from "./entities.js";

const levelRequirementSchema = z.object({ type: z.literal("level"), minimum: z.int().min(1).max(12) }).strict();
const abilityRequirementSchema = z.object({ type: z.literal("ability"), ability: abilitySchema, minimum: z.int().min(1).max(30) }).strict();
const proficiencyRequirementSchema = z.object({ type: z.literal("proficiency"), proficiency: z.union([skillSchema, z.string().trim().min(1)]) }).strict();
const entityRequirementSchema = z.object({
  type: z.literal("entity"), entityKind: entityKindSchema, entityId: entityIdSchema,
  minimumCount: z.int().min(1).default(1),
}).strict();
const equippedRequirementSchema = z.object({
  type: z.literal("equipped"), slot: equipmentSlotSchema.optional(), itemId: entityIdSchema.optional(), tag: z.string().trim().min(1).optional(),
}).strict().refine(({ slot, itemId, tag }) => slot !== undefined || itemId !== undefined || tag !== undefined, {
  message: "An equipped requirement needs a slot, itemId, or tag",
});
const tagRequirementSchema = z.object({ type: z.literal("tag"), tag: z.string().trim().min(1), minimumCount: z.int().min(1).default(1) }).strict();

export const requirementClauseSchema = z.discriminatedUnion("type", [
  levelRequirementSchema, abilityRequirementSchema, proficiencyRequirementSchema,
  entityRequirementSchema, equippedRequirementSchema, tagRequirementSchema,
]);
export const requirementSchema = z.object({ operator: z.enum(["all", "any"]), clauses: z.array(requirementClauseSchema).min(1) }).strict();

export type RequirementClause = z.infer<typeof requirementClauseSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
