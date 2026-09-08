import type { Ability, Build, DamageType, ReportIssue, ValueExpression } from "../schemas/index.js";
import { engineMetadata } from "./metadata.js";
import type { EngineRepository } from "./repository.js";
import type { ExplainTrace, ResolvedStats } from "./types.js";

export const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);
export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);
export const expectedValue = (value: ValueExpression, build: Build): number =>
  value.base + (value.dice ? value.dice.count * (value.dice.sides + 1) / 2 : 0) +
  (value.abilityModifier ? abilityModifier(build.abilityScores[value.abilityModifier]) : 0) + (value.perLevel ?? 0) * build.level;

export function resolveStats(build: Build, repository: EngineRepository): ResolvedStats {
  const dexterity = abilityModifier(build.abilityScores.dexterity);
  const constitution = abilityModifier(build.abilityScores.constitution);
  const weapon = build.equipment.map(({ itemId }) => engineMetadata(repository.getEntity(itemId))).find((metadata) => metadata.attackAbility);
  const attackAbility = weapon?.attackAbility ?? (build.abilityScores.dexterity > build.abilityScores.strength ? "dexterity" : "strength");
  const classMetadata = build.classes.map(({ classId }) => engineMetadata(repository.getEntity(classId)));
  const spellcastingAbility = classMetadata.find((metadata) => metadata.spellcastingAbility)?.spellcastingAbility ?? "intelligence";
  const hitDice = build.classes.map((entry, index) => ({ levels: entry.level, sides: classMetadata[index]?.hitDie ?? 8 }));
  const firstHitDie = hitDice[0]?.sides ?? 8;
  const laterHitPoints = hitDice.reduce((sum, die, index) => sum + Math.max(0, die.levels - (index === 0 ? 1 : 0)) * (Math.floor(die.sides / 2) + 1 + constitution), 0);
  const stats = { armorClass: 10 + dexterity, attackBonus: proficiencyBonus(build.level) + abilityModifier(build.abilityScores[attackAbility]), spellSaveDc: 8 + proficiencyBonus(build.level) + abilityModifier(build.abilityScores[spellcastingAbility]), hitPoints: Math.max(1, firstHitDie + constitution + laterHitPoints), initiative: dexterity, flatDamageReduction: 0 };
  const trace: ExplainTrace[] = [{ step: "base-stats", message: "Resolved class, level, and ability based statistics", input: { level: build.level, attackAbility, spellcastingAbility, hitDice }, output: JSON.stringify(stats) }];
  const resistances = new Set<DamageType>();
  const warnings: ReportIssue[] = [];
  const ids = [build.raceId, build.subraceId, ...build.classes.flatMap((entry) => [entry.classId, entry.subclassId]), ...build.feats, ...build.preparedSpells.map((entry) => entry.spellId), ...build.equipment.map((entry) => entry.itemId)].filter((id): id is string => Boolean(id));
  let drsRiders = 0;
  for (const id of ids) {
    const entity = repository.getEntity(id);
    const metadata = engineMetadata(entity);
    for (const key of ["armorClass", "attackBonus", "spellSaveDc", "hitPoints", "initiative", "flatDamageReduction"] as const) {
      const modifier = metadata[key];
      if (modifier === undefined) continue;
      const before = stats[key];
      stats[key] += modifier;
      trace.push({ step: "modifier", message: `Applied ${id} modifier to ${key}`, input: { source: id, target: key, modifier, before }, output: stats[key] });
    }
    for (const tag of entity?.tags ?? []) if (tag.startsWith("resistance:")) resistances.add(tag.slice(11) as DamageType);
    if (entity?.tags.includes("drs") || entity?.tags.includes("damage-rider-source")) drsRiders++;
    for (const effect of metadata.effects ?? []) {
      if (effect.target in stats) {
        const target = effect.target as keyof typeof stats;
        stats[target] += expectedValue(effect.value, build);
        trace.push({ step: "effect", message: `Applied ${id} to ${target}`, output: stats[target] });
      }
    }
  }
  if (drsRiders > 1) warnings.push({ code: "drs-stacking", severity: "warning", message: "Multiple damage-rider sources may interact with BG3 Damage Rider Source (DRS) rules; verify the in-game patch behavior", path: [], details: { count: drsRiders } });
  return { ...stats, resistances: [...resistances].sort(), trace, warnings };
}
