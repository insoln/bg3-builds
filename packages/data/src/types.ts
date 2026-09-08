import { z } from "zod";
import { entityIdSchema, gameVersionSchema } from "@bg3-builds/domain";
export const sourceRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["curated", "mediawiki-xml", "canonical-html"]),
    gameVersion: gameVersionSchema,
    url: z.url().optional(),
    retrievedAt: z.iso.datetime(),
    license: z.string().min(1),
    contentHash: z.string().optional(),
  })
  .strict();
export const claimSchema = z
  .object({
    id: z.string().min(1),
    entityId: entityIdSchema,
    sourceId: z.string().min(1),
    field: z.string().min(1),
    value: z.unknown(),
    evidence: z.string().min(1),
    locator: z.string().min(1).optional(),
  })
  .strict();
export const conversationSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const messageSchema = z
  .object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    ordinal: z.int().nonnegative(),
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationMessage = z.infer<typeof messageSchema>;
