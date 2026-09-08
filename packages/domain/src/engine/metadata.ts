import { valueExpressionSchema, type Ability, type GameEntity } from "../schemas/index.js";
import type { EngineMetadata } from "./types.js";

const slots = new Set(["head", "cloak", "body", "hands", "feet", "amulet", "ring-1", "ring-2", "melee-main-hand", "melee-off-hand", "ranged-main-hand", "ranged-off-hand"]);
const abilities = new Set<Ability>(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);

export function engineMetadata(entity: GameEntity | undefined): EngineMetadata {
  const raw = entity?.metadata?.["engine"];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const result: EngineMetadata = {};
  const availableAct = value["availableAct"];
  if (availableAct === 1 || availableAct === 2 || availableAct === 3) result.availableAct = availableAct;
  const slot = value["slot"];
  if (typeof slot === "string" && slots.has(slot)) result.slot = slot as NonNullable<EngineMetadata["slot"]>;
  const handedness = value["handedness"];
  if (handedness === "one-handed" || handedness === "two-handed") result.handedness = handedness;
  const shield = value["shield"];
  if (typeof shield === "boolean") result.shield = shield;
  const concentration = value["concentration"];
  if (typeof concentration === "boolean") result.concentration = concentration;
  for (const key of ["armorClass", "attackBonus", "spellSaveDc", "hitPoints", "initiative", "flatDamageReduction"] as const) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) result[key] = value[key];
  }
  for (const key of ["attackAbility", "spellcastingAbility"] as const) {
    const ability = value[key];
    if (typeof ability === "string" && abilities.has(ability as Ability)) result[key] = ability as Ability;
  }
  const hitDie = value["hitDie"];
  if (typeof hitDie === "number" && Number.isInteger(hitDie) && hitDie >= 4 && hitDie <= 20) result.hitDie = hitDie;
  const effects = value["effects"];
  if (Array.isArray(effects)) {
    result.effects = effects.flatMap((entry) => {
      if (entry === null || typeof entry !== "object") return [];
      const effect = entry as Record<string, unknown>;
      const target = effect["target"];
      const effectValue = valueExpressionSchema.safeParse(effect["value"]);
      if (typeof target !== "string" || !effectValue.success) return [];
      return [{ target, value: effectValue.data }];
    });
  }
  return result;
}
