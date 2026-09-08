import { z } from "zod";
import { attackRollModeSchema, targetDamageModifiersSchema } from "./attack.js";
import { buildSchema } from "./build.js";

/** The intentionally narrow, exhaustively enumerable search slice currently supported. */
export const optimizationRequestSchema = z.object({
  gameVersion: z.string().trim().min(1).max(80),
  level: z.literal(5),
  availableAct: z.literal(1),
  combat: z.object({
    mode: z.literal("ranged"),
    targetArmorClass: z.int().min(1).max(30).default(15),
    rollMode: attackRollModeSchema.default("normal"),
    target: targetDamageModifiersSchema.default({ immunities: [], resistances: [], vulnerabilities: [], flatReduction: 0, flatReductionByType: {} }),
    surprise: z.literal(false).default(false),
    guaranteedCritical: z.literal(false).default(false),
    areaTargets: z.literal(1).default(1),
  }).strict().default({ mode: "ranged", targetArmorClass: 15, rollMode: "normal", target: { immunities: [], resistances: [], vulnerabilities: [], flatReduction: 0, flatReductionByType: {} }, surprise: false, guaranteedCritical: false, areaTargets: 1 }),
  topK: z.int().min(1).max(16).default(5),
}).strict();

const damageSummarySchema = z.object({
  expected: z.number().finite(), minimum: z.number().finite(), minimumOnHit: z.number().finite(),
  nonCritMax: z.number().finite(), critMax: z.number().finite(), variance: z.number().finite(),
  stddev: z.number().finite(), p10: z.number().finite(), median: z.number().finite(), p90: z.number().finite(), probabilityZero: z.number().min(0).max(1),
}).strict();

const provenanceRefSchema = z.object({ entityId: z.string().min(1), label: z.string().min(1), url: z.url(), mechanic: z.string().min(1) }).strict();
const policySchema = z.object({ archery: z.literal("always"), extraAttack: z.literal("always"), sharpshooter: z.enum(["enabled", "disabled"]), subclassResource: z.string().min(1) }).strict();
const rankedCandidateSchema = z.object({
  rank: z.int().positive(), build: buildSchema, weaponId: z.string().min(1),
  score: z.number().finite(), attack: damageSummarySchema, oneRound: damageSummarySchema, threeRounds: damageSummarySchema,
  policy: policySchema, provenance: z.array(provenanceRefSchema).min(4),
}).strict();

export const optimizerResultSchema = z.object({
  request: optimizationRequestSchema,
  candidates: z.array(rankedCandidateSchema).min(1),
  validation: z.object({ generatedCandidates: z.int().nonnegative(), validCandidates: z.int().nonnegative(), rejectedCandidates: z.int().nonnegative(), rejectionReasons: z.record(z.string(), z.int().nonnegative()) }).strict(),
  bounds: z.object({ evaluatedCandidates: z.int().nonnegative(), candidateSetSize: z.int().nonnegative(), returnedCandidates: z.int().positive(), searchScope: z.literal("curated-l5-act1-ranged-v1"), exactWithinDeclaredScope: z.literal(true), globallyOptimal: z.literal(false) }).strict(),
  unsupportedMechanics: z.array(z.string().min(1)),
  guarantee: z.string().min(1),
}).strict();

export const optimizationReportSchema = z.object({
  kind: z.literal("optimization"), title: z.string().trim().min(1).max(160), summary: z.string().trim().min(1).max(2_000),
  result: optimizerResultSchema, generatedAt: z.iso.datetime(),
}).strict();

export type OptimizationRequest = z.input<typeof optimizationRequestSchema>;
export type ResolvedOptimizationRequest = z.output<typeof optimizationRequestSchema>;
export type OptimizerResult = z.infer<typeof optimizerResultSchema>;
export type OptimizationReport = z.infer<typeof optimizationReportSchema>;
