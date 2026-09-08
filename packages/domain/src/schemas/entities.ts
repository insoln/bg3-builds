import { z } from "zod";

export const entityIdSchema = z.string().trim().min(1).max(160);
export const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export const gameVersionSchema = z.string().trim().min(1).max(80);

export const localizedTextSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
}).strict();

export const sourceReferenceSchema = z.object({
  source: z.string().trim().min(1),
  sourceId: z.string().trim().min(1).optional(),
  gameVersion: gameVersionSchema,
  url: z.url().optional(),
}).strict();

export const entityKindSchema = z.enum([
  "class",
  "subclass",
  "race",
  "subrace",
  "background",
  "feat",
  "spell",
  "item",
  "action",
  "passive",
  "condition",
]);

export const entityRefSchema = z.object({
  id: entityIdSchema,
  kind: entityKindSchema,
}).strict();

export const abilitySchema = z.enum([
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]);

export const skillSchema = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);

export const damageTypeSchema = z.enum([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
]);

export const equipmentSlotSchema = z.enum([
  "head", "cloak", "body", "hands", "feet", "amulet", "ring-1", "ring-2",
  "melee-main-hand", "melee-off-hand", "ranged-main-hand", "ranged-off-hand",
]);

export const raritySchema = z.enum(["common", "uncommon", "rare", "very-rare", "legendary", "story"]);

export const baseEntitySchema = z.object({
  id: entityIdSchema,
  slug: slugSchema,
  kind: entityKindSchema,
  text: localizedTextSchema,
  tags: z.array(z.string().trim().min(1)).default([]),
  source: sourceReferenceSchema,
}).strict();

export const gameEntitySchema = baseEntitySchema.extend({
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type EntityId = z.infer<typeof entityIdSchema>;
export type EntityKind = z.infer<typeof entityKindSchema>;
export type EntityRef = z.infer<typeof entityRefSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type Skill = z.infer<typeof skillSchema>;
export type DamageType = z.infer<typeof damageTypeSchema>;
export type EquipmentSlot = z.infer<typeof equipmentSlotSchema>;
export type GameEntity = z.infer<typeof gameEntitySchema>;
