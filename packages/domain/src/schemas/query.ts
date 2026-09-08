import { z } from "zod";
import { entityIdSchema, entityKindSchema, gameVersionSchema, raritySchema } from "./entities.js";

export const sortDirectionSchema = z.enum(["asc", "desc"]);
export const paginationSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().trim().min(1).optional() }).strict();
export const entityQuerySchema = paginationSchema.extend({
  text: z.string().trim().min(1).max(200).optional(), kinds: z.array(entityKindSchema).min(1).optional(), ids: z.array(entityIdSchema).min(1).max(100).optional(),
  tags: z.array(z.string().trim().min(1)).min(1).optional(), rarity: z.array(raritySchema).min(1).optional(), gameVersion: gameVersionSchema.optional(),
  sortBy: z.enum(["name", "kind", "id"]).default("name"), sortDirection: sortDirectionSchema.default("asc"),
}).strict();
export const buildQuerySchema = paginationSchema.extend({
  text: z.string().trim().min(1).max(200).optional(), classIds: z.array(entityIdSchema).min(1).optional(), raceIds: z.array(entityIdSchema).min(1).optional(),
  minimumLevel: z.coerce.number().int().min(1).max(12).optional(), maximumLevel: z.coerce.number().int().min(1).max(12).optional(), gameVersion: gameVersionSchema.optional(),
  sortBy: z.enum(["name", "level", "updatedAt"]).default("updatedAt"), sortDirection: sortDirectionSchema.default("desc"),
}).strict().refine(({ minimumLevel, maximumLevel }) => minimumLevel === undefined || maximumLevel === undefined || minimumLevel <= maximumLevel, {
  message: "minimumLevel cannot exceed maximumLevel", path: ["minimumLevel"],
});

export type Pagination = z.infer<typeof paginationSchema>;
export type EntityQuery = z.infer<typeof entityQuerySchema>;
export type BuildQuery = z.infer<typeof buildQuerySchema>;
