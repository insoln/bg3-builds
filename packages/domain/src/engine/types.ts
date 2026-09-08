import type { Ability, Build, DamageType, EquipmentSlot, GameEntity, ReportIssue, ValueExpression } from "../schemas/index.js";

export type ExplainTrace = {
  step: string;
  message: string;
  input?: Record<string, unknown>;
  output?: number | string | boolean;
};

export type RangedDamageDice = { count: number; sides: number } & ({ flat: number } | { flat?: never });

export type RangedMechanic =
  | { kind: "weapon"; sourceEntityId: string; weaponType: "longbow" | "shortbow" | "hand-crossbow"; baseDamage: RangedDamageDice; damageType: "piercing" | "force"; attackAbility: "dexterity"; attackBonus: number; strengthDamage?: { ability: "strength"; minimumModifier: 1 } | undefined }
  | { kind: "attack-bonus"; sourceEntityId: string; appliesTo: "ranged-weapon"; bonus: number }
  | { kind: "extra-attack"; sourceEntityId: string; minimumClassLevel: number; attacksPerAction: 2 }
  | { kind: "sharpshooter"; sourceEntityId: string; attackRollPenalty: -5; damageBonus: 10 }
  | { kind: "battle-manoeuvre"; sourceEntityId: string; damageDie: { count: 1; sides: 8 }; usesPerShortRest: 4 }
  | { kind: "dread-ambusher"; sourceEntityId: string; firstRoundExtraAttacks: 1; extraAttackDamage: { count: 1; sides: 8 } }
  | { kind: "action-surge"; sourceEntityId: string; extraActionsPerShortRest: 1 };

export type EngineMetadata = {
  /** The earliest act in which the entity can be obtained or selected. */
  availableAct?: 1 | 2 | 3;
  slot?: EquipmentSlot;
  handedness?: "one-handed" | "two-handed";
  shield?: boolean;
  concentration?: boolean;
  armorClass?: number;
  attackBonus?: number;
  spellSaveDc?: number;
  hitPoints?: number;
  initiative?: number;
  flatDamageReduction?: number;
  attackAbility?: Ability;
  spellcastingAbility?: Ability;
  hitDie?: number;
  effects?: Array<{ target: string; value: ValueExpression }>;
  ranged?: RangedMechanic;
};

export type ValidationOptions = { availableAct?: 1 | 2 | 3 };
export type ValidationResult = { valid: boolean; issues: ReportIssue[]; trace: ExplainTrace[] };

export type ResolvedStats = {
  armorClass: number;
  attackBonus: number;
  spellSaveDc: number;
  hitPoints: number;
  initiative: number;
  resistances: DamageType[];
  flatDamageReduction: number;
  trace: ExplainTrace[];
  warnings: ReportIssue[];
};

export type AttackExpectation = {
  hitChance: number;
  damageOnHit: number;
  expectedDamage: number;
  trace: ExplainTrace[];
};

export type ScoreWeights = Partial<Record<"armorClass" | "attackBonus" | "spellSaveDc" | "hitPoints" | "initiative" | "expectedDamage", number>>;
export type ScoredBuild = { build: Build; score: number; trace: ExplainTrace[] };

export type RoleTemplate = {
  id: string;
  name: string;
  classTags: string[];
  preferredAbility: Ability;
  weights: ScoreWeights;
};

export type GenerateOptions = {
  level: number;
  gameVersion: string;
  availableAct?: 1 | 2 | 3;
  maxCandidates?: number;
  templates?: readonly RoleTemplate[];
};

export type Candidate = ScoredBuild & { templateId: string };
export type EntityMap = ReadonlyMap<string, GameEntity>;
