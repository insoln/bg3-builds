import type { RoleTemplate } from "./types.js";

export const ROLE_TEMPLATES: readonly RoleTemplate[] = Object.freeze([
  { id: "frontliner", name: "Frontliner", classTags: ["martial", "frontliner"], preferredAbility: "strength", weights: { armorClass: 3, hitPoints: 1, attackBonus: 1.5 } },
  { id: "striker", name: "Striker", classTags: ["martial", "striker"], preferredAbility: "dexterity", weights: { expectedDamage: 4, attackBonus: 3, initiative: 1 } },
  { id: "controller", name: "Controller", classTags: ["caster", "controller"], preferredAbility: "intelligence", weights: { spellSaveDc: 5, initiative: 1 } },
  { id: "support", name: "Support", classTags: ["caster", "support"], preferredAbility: "wisdom", weights: { spellSaveDc: 3, armorClass: 1, hitPoints: 0.5 } },
]);
