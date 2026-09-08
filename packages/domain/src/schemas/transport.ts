import { z } from "zod";

export const transportErrorSchema = z.object({
  code: z.string().trim().min(1), message: z.string().trim().min(1), fieldErrors: z.record(z.string(), z.array(z.string())).optional(), details: z.unknown().optional(),
}).strict();
export const requestMetaSchema = z.object({ requestId: z.string().trim().min(1).optional() }).strict();
export const responseMetaSchema = requestMetaSchema.extend({ nextCursor: z.string().trim().min(1).optional(), total: z.int().nonnegative().optional() }).strict();
export const successResponseSchema = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), data, meta: responseMetaSchema.optional() }).strict();
export const errorResponseSchema = z.object({ ok: z.literal(false), error: transportErrorSchema, meta: requestMetaSchema.optional() }).strict();
export const responseSchema = <T extends z.ZodType>(data: T) => z.discriminatedUnion("ok", [successResponseSchema(data), errorResponseSchema]);
export const paginatedDataSchema = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) }).strict();

export type TransportError = z.infer<typeof transportErrorSchema>;
export type RequestMeta = z.infer<typeof requestMetaSchema>;
export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type SuccessResponse<T> = { ok: true; data: T; meta?: ResponseMeta };
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type TransportResponse<T> = SuccessResponse<T> | ErrorResponse;
export type PaginatedData<T> = { items: T[] };
