import { z } from "zod";
import { entityIdSchema, gameVersionSchema } from "./entities.js";

export const reportSeveritySchema = z.enum(["info", "warning", "error"]);
export const reportIssueSchema = z.object({
  code: z.string().trim().min(1), severity: reportSeveritySchema, message: z.string().trim().min(1),
  path: z.array(z.union([z.string(), z.int().nonnegative()])).default([]), entityId: entityIdSchema.optional(), details: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const buildMetricsSchema = z.object({
  armorClass: z.number().finite().optional(), hitPoints: z.number().finite().optional(), initiative: z.number().finite().optional(),
  spellSaveDc: z.number().finite().optional(), attackBonus: z.number().finite().optional(), custom: z.record(z.string(), z.number().finite()).default({}),
}).strict();
export const buildReportSchema = z.object({
  buildId: entityIdSchema.optional(), gameVersion: gameVersionSchema, valid: z.boolean(), generatedAt: z.iso.datetime(),
  issues: z.array(reportIssueSchema).default([]), metrics: buildMetricsSchema.optional(),
}).strict().superRefine((report, context) => {
  const hasErrors = report.issues.some((issue) => issue.severity === "error");
  if (report.valid === hasErrors) context.addIssue({ code: "custom", path: ["valid"], message: "valid must be false exactly when error issues are present" });
});

export type ReportSeverity = z.infer<typeof reportSeveritySchema>;
export type ReportIssue = z.infer<typeof reportIssueSchema>;
export type BuildMetrics = z.infer<typeof buildMetricsSchema>;
export type BuildReport = z.infer<typeof buildReportSchema>;
