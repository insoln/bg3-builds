import { z } from "zod";
import { attackRollModeSchema, targetDamageModifiersSchema } from "./attack.js";
import { buildSchema } from "./build.js";
import { entityIconUrlSchema } from "./entities.js";

const DEFAULT_HORIZONS = [1, 2, 3, 5] as const;

/** The intentionally narrow, exhaustively enumerable search slice currently supported. */
export const optimizationRequestSchema = z.object({
  gameVersion: z.literal("Patch 8"),
  level: z.literal(5),
  availableAct: z.literal(1),
  combat: z.object({
    mode: z.literal("ranged"),
    targetArmorClass: z.int().min(1).max(30).default(15),
    targetHitPoints: z.int().min(1).max(1_000).default(50),
    targetInitiativeModifier: z.int().min(-20).max(20),
    targetDexterityScore: z.int().min(1).max(30),
    equalTotalAndDexterity: z.enum(["candidate-first", "target-first"]),
    surprisedDeniedTurnCountsAsTaken: z.boolean(),
    rollMode: attackRollModeSchema.default("normal"),
    target: targetDamageModifiersSchema.default({ immunities: [], resistances: [], vulnerabilities: [], flatReduction: 0, flatReductionByType: {} }),
    surprise: z.literal(false).default(false),
    guaranteedCritical: z.literal(false).default(false),
    areaTargets: z.literal(1).default(1),
    horizons: z.array(z.int().min(1).max(8)).max(8).default([...DEFAULT_HORIZONS]),
  }).strict(),
  topK: z.int().min(1).max(24).default(5),
}).strict();

export const damageSummarySchema = z.object({
  expected: z.number().finite().nonnegative(), minimum: z.number().finite().nonnegative(), minimumOnHit: z.number().finite().nonnegative(),
  nonCritMax: z.number().finite().nonnegative(), critMax: z.number().finite().nonnegative(), variance: z.number().finite().nonnegative(),
  stddev: z.number().finite().nonnegative(), p10: z.number().finite().nonnegative(), median: z.number().finite().nonnegative(), p90: z.number().finite().nonnegative(), probabilityZero: z.number().min(0).max(1),
}).strict().superRefine((summary, context) => {
  if (!(summary.minimum <= summary.p10 && summary.p10 <= summary.median && summary.median <= summary.p90 && summary.p90 <= summary.critMax)) {
    context.addIssue({ code: "custom", message: "damage quantiles must be ordered between minimum and critical maximum" });
  }
  if (summary.minimumOnHit < summary.minimum || summary.minimumOnHit > summary.critMax) {
    context.addIssue({ code: "custom", message: "minimumOnHit must be between minimum and critical maximum" });
  }
  if (summary.nonCritMax > summary.critMax) context.addIssue({ code: "custom", message: "non-critical maximum cannot exceed critical maximum" });
  if (Math.abs(summary.stddev ** 2 - summary.variance) > 1e-8 * Math.max(1, summary.variance)) {
    context.addIssue({ code: "custom", message: "standard deviation must match variance" });
  }
  if (summary.minimum > 0 && summary.probabilityZero > 0) context.addIssue({ code: "custom", message: "positive minimum damage cannot have zero-damage probability" });
});

const recoveryCadenceSchema = z.enum(["at-will", "encounter", "short-rest", "long-rest"]);
const windowEventSchema = z.object({
  kind: z.literal("ranged-attack"),
  source: z.enum(["ordinary", "dread-ambusher", "sneak-attack"]),
  count: z.int().positive(),
}).strict();
const resourceSpendSchema = z.object({
  resource: z.string().min(1),
  amount: z.int().positive(),
  recovery: recoveryCadenceSchema,
}).strict();
export const evaluatedWindowSchema = z.object({
  status: z.literal("evaluated"),
  label: z.string().min(1),
  turns: z.int().positive(),
  summary: damageSummarySchema,
  probabilityKill: z.number().min(0).max(1),
  events: z.array(windowEventSchema).min(1),
  resourcesSpent: z.array(resourceSpendSchema),
}).strict();
const unsupportedWindowSchema = z.object({
  status: z.literal("unsupported"),
  label: z.string().min(1),
  reasonCode: z.enum(["surprise-initiative-and-condition-state", "setup-effect-state-not-modeled"]),
  explanation: z.string().min(1),
}).strict();
export const damageWindowResultSchema = z.discriminatedUnion("status", [evaluatedWindowSchema, unsupportedWindowSchema]);

export const combatTimelineCaseSchema = z.object({
  order: z.enum(["candidate-first", "target-first"]),
  candidateTurns: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  turnsBeforeTargetFirstActionableTurn: z.array(z.object({
    round: z.int().positive(),
    targetSurprised: z.boolean(),
    targetHadTakenTurn: z.boolean(),
    events: z.array(windowEventSchema).min(1),
  }).strict()).max(2),
  appliedFeatures: z.array(z.string().min(1)),
  initiativePairs: z.int().min(1).max(16),
  weight: z.number().min(0).max(1),
  summary: damageSummarySchema,
  probabilityKill: z.number().min(0).max(1),
}).strict();
const combatTimelineScenarioSchema = z.object({
  cases: z.array(combatTimelineCaseSchema).min(1).max(3),
  probabilityKillBeforeTargetFirstActionableTurn: z.number().min(0).max(1),
}).strict().superRefine((timeline, context) => {
  const pairTotal = timeline.cases.reduce((total, timelineCase) => total + timelineCase.initiativePairs, 0);
  const weightTotal = timeline.cases.reduce((total, timelineCase) => total + timelineCase.weight, 0);
  const weightedKillProbability = timeline.cases.reduce((total, timelineCase) => total + timelineCase.weight * timelineCase.probabilityKill, 0);
  if (pairTotal !== 16) context.addIssue({ code: "custom", message: "timeline cases must account for all 16 d4 initiative pairs" });
  if (Math.abs(weightTotal - 1) > 1e-12) context.addIssue({ code: "custom", message: "timeline case weights must sum to one" });
  if (timeline.cases.some((timelineCase) => timelineCase.weight !== timelineCase.initiativePairs / 16)) context.addIssue({ code: "custom", message: "timeline case weights must match initiative-pair counts" });
  if (timeline.cases.some((timelineCase) => timelineCase.candidateTurns !== timelineCase.turnsBeforeTargetFirstActionableTurn.length)) context.addIssue({ code: "custom", message: "timeline candidate turn count must match its turn schedule" });
  const groupKeys = timeline.cases.map(({ order, turnsBeforeTargetFirstActionableTurn, appliedFeatures }) => JSON.stringify([order, turnsBeforeTargetFirstActionableTurn, appliedFeatures]));
  if (new Set(groupKeys).size !== groupKeys.length) context.addIssue({ code: "custom", message: "timeline cases must group equal order, schedule, state, and features" });
  if (Math.abs(weightedKillProbability - timeline.probabilityKillBeforeTargetFirstActionableTurn) > 1e-12) context.addIssue({ code: "custom", message: "timeline kill probability must be the exact weighted case probability" });
});
function expectedInitiativePairs(initiative: {
  candidateModifier: number;
  candidateDexterityScore: number;
  targetModifier: number;
  targetDexterityScore: number;
  equalTotalAndDexterity: "candidate-first" | "target-first";
}): Record<"candidate-first" | "target-first", number> {
  const pairs = { "candidate-first": 0, "target-first": 0 };
  for (let candidateD4 = 1; candidateD4 <= 4; candidateD4 += 1) {
    for (let targetD4 = 1; targetD4 <= 4; targetD4 += 1) {
      const candidateTotal = initiative.candidateModifier + candidateD4;
      const targetTotal = initiative.targetModifier + targetD4;
      let order: "candidate-first" | "target-first";
      if (candidateTotal !== targetTotal) order = candidateTotal > targetTotal ? "candidate-first" : "target-first";
      else if (initiative.candidateDexterityScore !== initiative.targetDexterityScore) {
        order = initiative.candidateDexterityScore > initiative.targetDexterityScore ? "candidate-first" : "target-first";
      } else order = initiative.equalTotalAndDexterity;
      pairs[order] += 1;
    }
  }
  return pairs;
}

export const evaluatedCombatTimelineSchema = z.object({
  metric: z.literal("probability-kill-before-target-first-actionable-turn"),
  initiative: z.object({
    die: z.literal("d4"),
    candidateModifier: z.int(),
    candidateDexterityScore: z.int().min(1).max(30),
    targetModifier: z.int(),
    targetDexterityScore: z.int().min(1).max(30),
    equalTotalAndDexterity: z.enum(["candidate-first", "target-first"]),
    surprisedDeniedTurnCountsAsTaken: z.boolean(),
  }).strict(),
  noSurprise: combatTimelineScenarioSchema,
  surprised: combatTimelineScenarioSchema,
}).strict().superRefine((timeline, context) => {
  const expected = expectedInitiativePairs(timeline.initiative);
  for (const scenario of [timeline.noSurprise, timeline.surprised]) {
    for (const order of ["candidate-first", "target-first"] as const) {
      const actual = scenario.cases.filter(timelineCase => timelineCase.order === order)
        .reduce((total, timelineCase) => total + timelineCase.initiativePairs, 0);
      if (actual !== expected[order]) {
        context.addIssue({ code: "custom", message: `${order} case mass must match the echoed initiative inputs` });
      }
    }
  }
});

const provenanceRefSchema = z.object({
  entityId: z.string().min(1),
  label: z.string().min(1),
  url: z.url(),
  iconUrl: entityIconUrlSchema.optional(),
  mechanic: z.string().min(1),
}).strict();
const policySchema = z.object({ archery: z.enum(["always", "unavailable"]), extraAttack: z.enum(["always", "unavailable"]), sharpshooter: z.enum(["enabled", "disabled"]) }).strict();
export const rankedCandidateSchema = z.object({
  rank: z.int().positive(), build: buildSchema, weaponId: z.string().min(1),
  rankingScore: z.number().finite(),
  windows: z.object({
    singleAttack: evaluatedWindowSchema,
    opener: evaluatedWindowSchema,
    nova: evaluatedWindowSchema,
    steadyState: evaluatedWindowSchema,
    surprise: unsupportedWindowSchema,
    setup: unsupportedWindowSchema,
    horizons: z.array(z.object({ rounds: z.int().positive(), window: evaluatedWindowSchema }).strict()).min(4),
  }).strict(),
  timeline: evaluatedCombatTimelineSchema,
  policy: policySchema, provenance: z.array(provenanceRefSchema).min(4),
}).strict();

export const optimizerResultSchema = z.object({
  request: optimizationRequestSchema,
  candidates: z.array(rankedCandidateSchema).min(1),
  ranking: z.object({ window: z.literal("nova"), metric: z.literal("expectedDamage"), tieBreakers: z.tuple([z.literal("steadyState.expectedDamage"), z.literal("build.id"), z.literal("sharpshooterPolicy")]) }).strict(),
  validation: z.object({ generatedCandidates: z.int().nonnegative(), validCandidates: z.int().nonnegative(), rejectedCandidates: z.int().nonnegative(), rejectionReasons: z.record(z.string(), z.int().nonnegative()) }).strict(),
  bounds: z.object({ evaluatedCandidates: z.int().nonnegative(), candidateSetSize: z.int().nonnegative(), returnedCandidates: z.int().positive(), searchScope: z.literal("curated-l5-act1-ranged-timeline-v3"), exactWithinDeclaredScope: z.literal(true), globallyOptimal: z.literal(false) }).strict(),
  unsupportedMechanics: z.array(z.string().min(1)),
  guarantee: z.string().min(1),
}).strict().superRefine((result, context) => {
  const rejectionTotal = Object.values(result.validation.rejectionReasons).reduce((total, count) => total + count, 0);
  const expectedHorizons = result.request.combat.horizons;
  const issue = (message: string): void => context.addIssue({ code: "custom", message });
  if (result.validation.generatedCandidates !== result.validation.validCandidates + result.validation.rejectedCandidates) issue("generated candidate count must equal valid plus rejected candidates");
  if (result.bounds.candidateSetSize !== result.validation.generatedCandidates) issue("candidate set size must equal generated candidate count");
  if (result.bounds.evaluatedCandidates !== result.validation.validCandidates) issue("evaluated candidate count must equal valid candidate count");
  if (result.bounds.returnedCandidates !== result.candidates.length) issue("returned candidate count must equal candidate array length");
  if (rejectionTotal !== result.validation.rejectedCandidates) issue("rejection reason counts must equal rejected candidate count");
  result.candidates.forEach((candidate, index) => {
    if (candidate.rank !== index + 1) issue("candidate ranks must be contiguous and ordered");
    if (candidate.rankingScore !== candidate.windows.nova.summary.expected) issue("ranking score must equal Nova expected damage");
    const horizonRounds = candidate.windows.horizons.map(horizon => horizon.rounds);
    if (horizonRounds.length !== expectedHorizons.length || horizonRounds.some((rounds, horizonIndex) => rounds !== expectedHorizons[horizonIndex])) issue("candidate horizons must match the effective request");
    if (candidate.windows.horizons.some(({ rounds, window }) => rounds !== window.turns)) issue("horizon turns must equal its round count");
    const initiative = candidate.timeline.initiative;
    if (initiative.targetModifier !== result.request.combat.targetInitiativeModifier) issue("timeline target initiative modifier must match the request");
    if (initiative.targetDexterityScore !== result.request.combat.targetDexterityScore) issue("timeline target Dexterity must match the request");
    if (initiative.equalTotalAndDexterity !== result.request.combat.equalTotalAndDexterity) issue("timeline tie policy must match the request");
    if (initiative.surprisedDeniedTurnCountsAsTaken !== result.request.combat.surprisedDeniedTurnCountsAsTaken) issue("timeline denied-turn assumption must match the request");
    if (initiative.candidateDexterityScore !== candidate.build.abilityScores.dexterity) issue("timeline candidate Dexterity must match the build");
    const expectedCandidateModifier = Math.floor((candidate.build.abilityScores.dexterity - 10) / 2)
      + (candidate.build.classes[0]?.subclassId === "subclass-gloom-stalker" ? 3 : 0);
    if (initiative.candidateModifier !== expectedCandidateModifier) issue("timeline candidate initiative modifier must match the curated build");
  });
  for (let index = 1; index < result.candidates.length; index += 1) {
    const previous = result.candidates[index - 1]!;
    const current = result.candidates[index]!;
    const comparison = current.windows.nova.summary.expected - previous.windows.nova.summary.expected
      || current.windows.steadyState.summary.expected - previous.windows.steadyState.summary.expected
      || (previous.build.id ?? "").localeCompare(current.build.id ?? "")
      || Number(previous.policy.sharpshooter === "enabled") - Number(current.policy.sharpshooter === "enabled");
    if (comparison > 0) issue("candidates must follow the declared ranking order");
  }
});

export const optimizationReportSchema = z.object({
  kind: z.literal("optimization"), title: z.string().trim().min(1).max(160), summary: z.string().trim().min(1).max(2_000),
  result: optimizerResultSchema, generatedAt: z.iso.datetime(),
}).strict();

export type OptimizationRequest = z.input<typeof optimizationRequestSchema>;
export type ResolvedOptimizationRequest = z.output<typeof optimizationRequestSchema>;
export type DamageWindowResult = z.infer<typeof damageWindowResultSchema>;
export type EvaluatedDamageWindow = z.infer<typeof evaluatedWindowSchema>;
export type CombatTimelineCase = z.infer<typeof combatTimelineCaseSchema>;
export type EvaluatedCombatTimelineResult = z.infer<typeof evaluatedCombatTimelineSchema>;
export type OptimizerResult = z.infer<typeof optimizerResultSchema>;
export type OptimizationReport = z.infer<typeof optimizationReportSchema>;
