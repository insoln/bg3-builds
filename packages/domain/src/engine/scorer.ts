import type { Build } from "../schemas/index.js";
import { expectedAttackDamage } from "./expected-value.js";
import type { EngineRepository } from "./repository.js";
import { resolveStats } from "./stats.js";
import type { ScoreWeights, ScoredBuild } from "./types.js";

const defaults: Required<ScoreWeights> = { armorClass: 1, attackBonus: 2, spellSaveDc: 1, hitPoints: 0.25, initiative: 0.5, expectedDamage: 2 };

export function scoreBuild(build: Build, repository: EngineRepository, weights: ScoreWeights = {}): ScoredBuild {
  const resolved = resolveStats(build, repository);
  const applied = { ...defaults, ...weights };
  const expectedDamage = expectedAttackDamage({ attackBonus: resolved.attackBonus, armorClass: 15, damageOnHit: 8, damageType: "slashing" }).expectedDamage;
  const components = { armorClass: resolved.armorClass, attackBonus: resolved.attackBonus, spellSaveDc: resolved.spellSaveDc, hitPoints: resolved.hitPoints, initiative: resolved.initiative, expectedDamage };
  const score = Object.entries(components).reduce((sum, [key, value]) => sum + value * applied[key as keyof typeof applied], 0);
  return { build, score, trace: [...resolved.trace, { step: "score", message: "Computed weighted deterministic score", input: { weights: applied, components }, output: score }] };
}

const canonicalBuildKey = (build: Build): string => JSON.stringify({
  ...build,
  classes: [...build.classes].sort((a, b) => a.classId.localeCompare(b.classId) || (a.subclassId ?? "").localeCompare(b.subclassId ?? "")),
  feats: [...build.feats].sort(),
  preparedSpells: [...build.preparedSpells].sort((a, b) => a.spellId.localeCompare(b.spellId)),
  equipment: [...build.equipment].sort((a, b) => a.slot.localeCompare(b.slot) || a.itemId.localeCompare(b.itemId)),
});

export function rankBuilds(builds: readonly Build[], repository: EngineRepository, weights: ScoreWeights = {}): ScoredBuild[] {
  return builds.map((build) => scoreBuild(build, repository, weights)).sort((a, b) => b.score - a.score || (a.build.id ?? a.build.name).localeCompare(b.build.id ?? b.build.name) || canonicalBuildKey(a.build).localeCompare(canonicalBuildKey(b.build)));
}
