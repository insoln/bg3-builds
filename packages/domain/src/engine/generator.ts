import type { Ability, AbilityScores, Build, GameEntity } from "../schemas/index.js";
import { scoreBuild } from "./scorer.js";
import { ROLE_TEMPLATES } from "./templates.js";
import type { EngineRepository } from "./repository.js";
import type { Candidate, GenerateOptions, RoleTemplate } from "./types.js";
import { validateBuild } from "./validator.js";

const BASE_SCORES: AbilityScores = { strength: 12, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 12, charisma: 10 };
function scoresFor(ability: Ability): AbilityScores { return { ...BASE_SCORES, [ability]: 16 }; }
function matches(entity: GameEntity, template: RoleTemplate): boolean { return template.classTags.some((tag) => entity.tags.includes(tag)); }

export function generateCandidates(repository: EngineRepository, options: GenerateOptions): Candidate[] {
  const limit = Math.max(0, Math.min(options.maxCandidates ?? 20, 100));
  if (limit === 0) return [];
  const templates = [...(options.templates ?? ROLE_TEMPLATES)].sort((a, b) => a.id.localeCompare(b.id));
  const classes = [...repository.listEntities("class")].sort((a, b) => a.id.localeCompare(b.id));
  const races = [...repository.listEntities("race")].sort((a, b) => a.id.localeCompare(b.id));
  const candidates: Candidate[] = [];
  for (const template of templates) for (const classEntity of classes.filter((entity) => matches(entity, template))) for (const race of races) {
    const id = `${template.id}-${race.id}-${classEntity.id}-l${options.level}`;
    const build: Build = { id, name: `${template.name}: ${race.text.name} ${classEntity.text.name}`, gameVersion: options.gameVersion, level: options.level, raceId: race.id, classes: [{ classId: classEntity.id, level: options.level }], abilityScores: scoresFor(template.preferredAbility), choices: [], feats: [], preparedSpells: [], equipment: [] };
    const validationOptions = options.availableAct === undefined ? {} : { availableAct: options.availableAct };
    if (!validateBuild(build, repository, validationOptions).valid) continue;
    candidates.push({ ...scoreBuild(build, repository, template.weights), templateId: template.id });
  }
  return candidates.sort((a, b) => b.score - a.score || a.templateId.localeCompare(b.templateId) || (a.build.id ?? "").localeCompare(b.build.id ?? "")).slice(0, limit);
}
