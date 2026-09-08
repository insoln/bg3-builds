import type { Ability, Build, DamageType, EquipmentSlot, GameEntity, ReportIssue, ValueExpression } from "../schemas/index.js";

export type ExplainTrace = {
  step: string;
  message: string;
  input?: Record<string, unknown>;
  output?: number | string | boolean;
};

export type EngineMetadata = {
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
