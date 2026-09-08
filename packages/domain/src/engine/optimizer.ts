import { optimizationRequestSchema, type OptimizationRequest, type OptimizerResult } from "../schemas/optimization.js";
import { validateBuild } from "./validator.js";
import { generateCandidates } from "./generator.js";
import { resolveStats } from "./stats.js";
import type { EngineRepository } from "./repository.js";

const LIMITATIONS = [
  "This is a bounded search over generated Level 5 Act 1 ranged candidates; it does not claim a global optimum.",
  "Surprise, guaranteed critical hits, and multi-target area effects are excluded because this optimizer does not calculate them.",
  "Damage scoring uses the engine's current deterministic attack expectation adapter and available structured metadata only.",
];

/**
 * A bounded adapter around the current generator/scorer. It deliberately owns no
 * combat formula so an exact evaluator can replace the score source later.
 */
export function optimizeBuild(repository: EngineRepository, input: OptimizationRequest): OptimizerResult {
  const request = optimizationRequestSchema.parse(input);
  const candidates = generateCandidates(repository, {
    level: request.level,
    gameVersion: request.gameVersion,
    availableAct: request.availableAct,
    maxCandidates: request.maxCandidates,
  });
  const winner = candidates[0];
  if (!winner) throw new Error("No legal candidates were found within the requested bounded search.");

  const resolved = resolveStats(winner.build, repository);
  const validation = validateBuild(winner.build, repository, { availableAct: request.availableAct });
  return {
    request,
    build: winner.build,
    score: winner.score,
    metrics: {
      armorClass: resolved.armorClass,
      hitPoints: resolved.hitPoints,
      initiative: resolved.initiative,
      spellSaveDc: resolved.spellSaveDc,
      attackBonus: resolved.attackBonus,
      custom: { boundedScore: winner.score },
    },
    issues: [...validation.issues, ...resolved.warnings],
    bounds: {
      evaluatedCandidates: candidates.length,
      maxCandidates: request.maxCandidates,
      searchScope: "bounded-l5-act1-ranged",
      globallyOptimal: false,
    },
    limitations: LIMITATIONS,
  };
}
