import { z } from "zod";
import { buildSchema } from "./build.js";
import { buildMetricsSchema, reportIssueSchema } from "./report.js";

/** The intentionally narrow, reproducible search slice currently supported. */
export const optimizationRequestSchema = z.object({
  gameVersion: z.string().trim().min(1).max(80),
  level: z.literal(5),
  availableAct: z.literal(1),
  combat: z.object({
    mode: z.literal("ranged"),
    targetArmorClass: z.int().min(1).max(30).default(15),
    surprise: z.literal(false).default(false),
    guaranteedCritical: z.literal(false).default(false),
    areaTargets: z.literal(1).default(1),
  }).strict().default({ mode: "ranged", targetArmorClass: 15, surprise: false, guaranteedCritical: false, areaTargets: 1 }),
  maxCandidates: z.int().min(1).max(100).default(20),
}).strict();

export const optimizerBoundSchema = z.object({
  evaluatedCandidates: z.int().nonnegative(),
  maxCandidates: z.int().positive(),
  searchScope: z.literal("bounded-l5-act1-ranged"),
  globallyOptimal: z.literal(false),
}).strict();

export const optimizerResultSchema = z.object({
  request: optimizationRequestSchema,
  build: buildSchema,
  score: z.number().finite(),
  metrics: buildMetricsSchema,
  issues: z.array(reportIssueSchema),
  bounds: optimizerBoundSchema,
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export const optimizationReportSchema = z.object({
  kind: z.literal("optimization"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2_000),
  result: optimizerResultSchema,
  generatedAt: z.iso.datetime(),
}).strict();

export type OptimizationRequest = z.infer<typeof optimizationRequestSchema>;
export type OptimizerResult = z.infer<typeof optimizerResultSchema>;
export type OptimizationReport = z.infer<typeof optimizationReportSchema>;
