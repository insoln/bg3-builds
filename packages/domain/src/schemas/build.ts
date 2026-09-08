import { z } from "zod";
import { abilitySchema, entityIdSchema, equipmentSlotSchema, gameVersionSchema } from "./entities.js";

export const abilityScoresSchema = z.record(abilitySchema, z.int().min(1).max(30));
export const classLevelSchema = z.object({ classId: entityIdSchema, subclassId: entityIdSchema.optional(), level: z.int().min(1).max(12) }).strict();
export const buildChoiceSchema = z.object({ level: z.int().min(1).max(12), choiceId: entityIdSchema, optionIds: z.array(entityIdSchema).min(1) }).strict();
export const preparedSpellSchema = z.object({ spellId: entityIdSchema, sourceClassId: entityIdSchema.optional(), alwaysPrepared: z.boolean().default(false) }).strict();
export const equippedItemSchema = z.object({ slot: equipmentSlotSchema, itemId: entityIdSchema }).strict();
export const buildSchema = z.object({
  id: entityIdSchema.optional(), name: z.string().trim().min(1).max(120), gameVersion: gameVersionSchema,
  level: z.int().min(1).max(12), raceId: entityIdSchema, subraceId: entityIdSchema.optional(), backgroundId: entityIdSchema.optional(),
  classes: z.array(classLevelSchema).min(1), abilityScores: abilityScoresSchema, choices: z.array(buildChoiceSchema).default([]),
  feats: z.array(entityIdSchema).default([]), preparedSpells: z.array(preparedSpellSchema).default([]), equipment: z.array(equippedItemSchema).default([]),
  notes: z.string().max(10_000).optional(),
}).strict().superRefine((build, context) => {
  const classLevels = build.classes.reduce((sum, entry) => sum + entry.level, 0);
  if (classLevels !== build.level) context.addIssue({ code: "custom", path: ["classes"], message: `Class levels (${classLevels}) must equal build level (${build.level})` });
  const occupiedSlots = new Set<string>();
  for (const [index, item] of build.equipment.entries()) {
    if (occupiedSlots.has(item.slot)) context.addIssue({ code: "custom", path: ["equipment", index, "slot"], message: `Duplicate equipment slot: ${item.slot}` });
    occupiedSlots.add(item.slot);
  }
});

export type AbilityScores = z.infer<typeof abilityScoresSchema>;
export type ClassLevel = z.infer<typeof classLevelSchema>;
export type BuildChoice = z.infer<typeof buildChoiceSchema>;
export type Build = z.infer<typeof buildSchema>;
