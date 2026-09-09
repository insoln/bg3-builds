import type { AttackInput, Build, DamagePacket, EvaluatedDamageWindow } from "../schemas/index.js";
import { optimizationRequestSchema, type OptimizationRequest, type OptimizerResult } from "../schemas/optimization.js";
import { combineCombatPlans, evaluateCombatPlan, repeatCombatPlan, type CombatPlan } from "./combat-windows.js";
import { engineMetadata } from "./metadata.js";
import type { EngineRepository } from "./repository.js";
import type { RangedMechanic } from "./types.js";
import { validateBuild } from "./validator.js";

const CLASS_OPTIONS = [
  { classId: "class-fighter", subclassId: "subclass-battle-master" },
  { classId: "class-ranger", subclassId: "subclass-gloom-stalker" },
] as const;
const WEAPON_IDS = ["item-hunting-shortbow", "item-joltshooter", "item-longbow-plus-one", "item-titanstring-bow"] as const;
const SHARPSHOOTER_POLICIES = [false, true] as const;
const ARCHERY_ID = "passive-archery";
const EXTRA_ATTACK_ID = "passive-extra-attack";
const SHARPSHOOTER_ID = "feat-sharpshooter";
const ACTION_SURGE_ID = "action-action-surge";
const RACE_ID = "race-human";
const UNSUPPORTED = [
  "Battle Master manoeuvre dice and superiority-die consumption",
  "surprise initiative and condition state",
  "setup effects and persistent combat state",
  "guaranteed critical hits / Executioner",
  "area-of-effect and multiple targets",
];

const SURPRISE_WINDOW = {
  status: "unsupported",
  label: "Surprised first round",
  reasonCode: "surprise-initiative-and-condition-state",
  explanation: "Surprise needs initiative order, condition duration, and action restoration state; it is not treated as a damage multiplier.",
} as const;
const SETUP_WINDOW = {
  status: "unsupported",
  label: "Setup",
  reasonCode: "setup-effect-state-not-modeled",
  explanation: "No setup action, effect duration, concentration state, or persistent target modifier is executable in this curated slice.",
} as const;

function abilityModifier(score: number): number { return Math.floor((score - 10) / 2); }
function mechanic(repository: EngineRepository, id: string): RangedMechanic {
  const value = engineMetadata(repository.getEntity(id)).ranged;
  if (!value) throw new Error(`Required executable ranged metadata is missing: ${id}`);
  return value;
}
function buildFor(classOption: typeof CLASS_OPTIONS[number], weaponId: string): Build {
  return {
    id: `${classOption.subclassId}-${weaponId}`, name: `${classOption.subclassId === "subclass-battle-master" ? "Battle Master" : "Gloom Stalker"} 5 · ${weaponId.replace("item-", "")}`,
    gameVersion: "Patch 8", level: 5, raceId: RACE_ID,
    classes: [{ ...classOption, level: 5 }],
    abilityScores: { strength: 16, dexterity: 16, constitution: 14, intelligence: 8, wisdom: 12, charisma: 8 },
    choices: [{ level: classOption.classId === "class-fighter" ? 1 : 2, choiceId: "fighting-style", optionIds: [ARCHERY_ID] }], feats: [SHARPSHOOTER_ID], preparedSpells: [],
    equipment: [{ slot: "ranged-main-hand", itemId: weaponId }],
  };
}
function rejectionCounts(reasons: string[]): Record<string, number> {
  return Object.fromEntries([...new Set(reasons)].sort().map(reason => [reason, reasons.filter(value => value === reason).length]));
}
function provenanceMechanic(entityId: string, weaponId: string): string {
  if (entityId === weaponId) return "weapon";
  if (entityId === ARCHERY_ID) return "Archery";
  if (entityId === EXTRA_ATTACK_ID) return "Extra Attack";
  if (entityId === SHARPSHOOTER_ID) return "Sharpshooter policy";
  if (entityId === ACTION_SURGE_ID) return "Action Surge nova schedule";
  return "class or subclass schedule eligibility";
}
function ordinaryPlan(label: string, attack: AttackInput, count: number): CombatPlan {
  return { label, turns: 1, events: [{ source: "ordinary", count, attack }], resourcesSpent: [] };
}
function horizonPlan(rounds: number, nova: CombatPlan, steady: CombatPlan): CombatPlan {
  if (rounds === 1) return { ...nova, label: "1-round total" };
  return combineCombatPlans(`${rounds}-round total`, nova, repeatCombatPlan(steady, rounds - 1));
}

export function optimizeBuild(repository: EngineRepository, input: OptimizationRequest): OptimizerResult {
  const parsedRequest = optimizationRequestSchema.parse(input);
  const request = {
    ...parsedRequest,
    combat: {
      ...parsedRequest.combat,
      horizons: [...new Set([1, 2, 3, 5, ...parsedRequest.combat.horizons])].sort((left, right) => left - right),
    },
  };
  const archery = mechanic(repository, ARCHERY_ID);
  const extraAttack = mechanic(repository, EXTRA_ATTACK_ID);
  const sharpshooter = mechanic(repository, SHARPSHOOTER_ID);
  const actionSurge = mechanic(repository, ACTION_SURGE_ID);
  if (archery.kind !== "attack-bonus" || extraAttack.kind !== "extra-attack" || sharpshooter.kind !== "sharpshooter" || actionSurge.kind !== "action-surge") throw new Error("Required ranged policy metadata has an unexpected kind.");

  const generated = CLASS_OPTIONS.flatMap(classOption => WEAPON_IDS.flatMap(weaponId => SHARPSHOOTER_POLICIES.map(sharpshooterEnabled => ({ classOption, weaponId, sharpshooterEnabled, build: buildFor(classOption, weaponId) }))));
  const rejected: string[] = [];
  const valid = generated.flatMap(candidate => {
    const validation = validateBuild(candidate.build, repository, { availableAct: request.availableAct });
    if (!validation.valid) {
      rejected.push(...validation.issues.map(issue => issue.code));
      return [];
    }
    const weapon = mechanic(repository, candidate.weaponId);
    const subclass = mechanic(repository, candidate.classOption.subclassId);
    if (weapon.kind !== "weapon" || (subclass.kind !== "battle-manoeuvre" && subclass.kind !== "dread-ambusher")) {
      rejected.push("unsupported-ranged-metadata");
      return [];
    }
    const dexterity = abilityModifier(candidate.build.abilityScores.dexterity);
    const strength = abilityModifier(candidate.build.abilityScores.strength);
    const packets: DamagePacket[] = [{ damageType: weapon.damageType, dice: [{ count: weapon.baseDamage.count, sides: weapon.baseDamage.sides }], flat: (weapon.baseDamage.flat ?? 0) + dexterity + (weapon.strengthDamage ? Math.max(weapon.strengthDamage.minimumModifier, strength) : 0) + (candidate.sharpshooterEnabled ? sharpshooter.damageBonus : 0), crittable: true }];
    const attackInput = { attackBonus: 3 + dexterity + weapon.attackBonus + archery.bonus + (candidate.sharpshooterEnabled ? sharpshooter.attackRollPenalty : 0), armorClass: request.combat.targetArmorClass, rollMode: request.combat.rollMode, criticalThreshold: 20, guaranteedCritical: false, packets, target: request.combat.target } as const;
    const singleAttackPlan = ordinaryPlan("Single attack", attackInput, 1);
    const steadyPlan = ordinaryPlan("Steady-state round", attackInput, extraAttack.attacksPerAction);
    let openerPlan: CombatPlan;
    let novaPlan: CombatPlan;
    if (subclass.kind === "battle-manoeuvre") {
      openerPlan = ordinaryPlan("Opener", attackInput, extraAttack.attacksPerAction);
      novaPlan = {
        ...ordinaryPlan("Nova", attackInput, extraAttack.attacksPerAction * 2),
        resourcesSpent: [{ resource: "Action Surge", amount: actionSurge.extraActionsPerShortRest, recovery: "short-rest" }],
      };
    } else {
      const ambushInput = { ...attackInput, packets: [{ ...packets[0]!, dice: [...packets[0]!.dice, subclass.extraAttackDamage] }] };
      openerPlan = {
        label: "Opener",
        turns: 1,
        events: [
          { source: "ordinary", count: extraAttack.attacksPerAction, attack: attackInput },
          { source: "dread-ambusher", count: subclass.firstRoundExtraAttacks, attack: ambushInput },
        ],
        resourcesSpent: [{ resource: "Dread Ambusher", amount: 1, recovery: "encounter" }],
      };
      novaPlan = { ...openerPlan, label: "Nova" };
    }
    const evaluate = (plan: CombatPlan): EvaluatedDamageWindow => evaluateCombatPlan(plan, request.combat.targetHitPoints).result;
    const windows = {
      singleAttack: evaluate(singleAttackPlan),
      opener: evaluate(openerPlan),
      nova: evaluate(novaPlan),
      steadyState: evaluate(steadyPlan),
      surprise: SURPRISE_WINDOW,
      setup: SETUP_WINDOW,
      horizons: request.combat.horizons.map(rounds => ({ rounds, window: evaluate(horizonPlan(rounds, novaPlan, steadyPlan)) })),
    };
    const refs = [candidate.classOption.classId, candidate.classOption.subclassId, candidate.weaponId, ARCHERY_ID, EXTRA_ATTACK_ID, SHARPSHOOTER_ID, ...(candidate.classOption.classId === "class-fighter" ? [ACTION_SURGE_ID] : [])].map(entityId => {
      const entity = repository.getEntity(entityId)!;
      if (!entity.source.url) throw new Error(`Required provenance URL is missing: ${entityId}`);
      return { entityId, label: entity.text.name, url: entity.source.url, mechanic: provenanceMechanic(entityId, candidate.weaponId), ...(entity.iconUrl === undefined ? {} : { iconUrl: entity.iconUrl }) };
    });
    return [{ ...candidate, windows, refs }];
  });

  valid.sort((left, right) => right.windows.nova.summary.expected - left.windows.nova.summary.expected || right.windows.steadyState.summary.expected - left.windows.steadyState.summary.expected || left.build.id!.localeCompare(right.build.id!) || Number(left.sharpshooterEnabled) - Number(right.sharpshooterEnabled));
  if (valid.length === 0) throw new Error("No legal candidates were found in the curated search scope.");
  const candidates = valid.slice(0, request.topK).map((candidate, index) => ({
    rank: index + 1, build: { ...candidate.build, gameVersion: request.gameVersion }, weaponId: candidate.weaponId, rankingScore: candidate.windows.nova.summary.expected,
    windows: candidate.windows,
    policy: { archery: "always" as const, extraAttack: "always" as const, sharpshooter: candidate.sharpshooterEnabled ? "enabled" as const : "disabled" as const }, provenance: candidate.refs,
  }));
  return {
    request, candidates,
    ranking: { window: "nova", metric: "expectedDamage", tieBreakers: ["steadyState.expectedDamage", "build.id", "sharpshooterPolicy"] },
    validation: { generatedCandidates: generated.length, validCandidates: valid.length, rejectedCandidates: generated.length - valid.length, rejectionReasons: rejectionCounts(rejected) },
    bounds: { evaluatedCandidates: valid.length, candidateSetSize: generated.length, returnedCandidates: candidates.length, searchScope: "curated-l5-act1-ranged-windows-v2", exactWithinDeclaredScope: true, globallyOptimal: false },
    unsupportedMechanics: UNSUPPORTED,
    guarantee: "Every candidate in the declared curated Fighter 5 Battle Master / Ranger 5 Gloom Stalker, four-bow, two-Sharpshooter-policy scope is validated before exact PMF window evaluation and deterministic Nova ranking.",
  };
}
