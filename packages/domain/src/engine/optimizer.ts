import type { AttackInput, AttackRollMode, Build, DamagePacket, EvaluatedDamageWindow } from "../schemas/index.js";
import { evaluatedCombatTimelineSchema, optimizationRequestSchema, type OptimizationRequest, type OptimizerResult } from "../schemas/optimization.js";
import { combineCombatPlans, evaluateCombatPlan, repeatCombatPlan, type CombatPlan } from "./combat-windows.js";
import { evaluateCombatTimeline } from "./combat-timeline.js";
import { engineMetadata } from "./metadata.js";
import type { EngineRepository } from "./repository.js";
import type { RangedMechanic } from "./types.js";
import { validateBuild } from "./validator.js";

const CLASS_OPTIONS = [
  { classId: "class-fighter", subclassId: "subclass-battle-master", label: "Battle Master" },
  { classId: "class-ranger", subclassId: "subclass-gloom-stalker", label: "Gloom Stalker" },
  { classId: "class-rogue", subclassId: "subclass-assassin", label: "Assassin" },
] as const;
const WEAPON_IDS = ["item-hunting-shortbow", "item-joltshooter", "item-longbow-plus-one", "item-titanstring-bow"] as const;
const SHARPSHOOTER_POLICIES = [false, true] as const;
const ARCHERY_ID = "passive-archery";
const EXTRA_ATTACK_ID = "passive-extra-attack";
const SHARPSHOOTER_ID = "feat-sharpshooter";
const ACTION_SURGE_ID = "action-action-surge";
const ALACRITY_ID = "passive-assassins-alacrity";
const ASSASSINATE_INITIATIVE_ID = "passive-assassinate-initiative";
const ASSASSINATE_AMBUSH_ID = "passive-assassinate-ambush";
const SNEAK_ATTACK_ID = "action-sneak-attack-ranged";
const MARTIAL_RACE_ID = "race-human";
const ASSASSIN_RACE_ID = "race-wood-elf";
const UNSUPPORTED = [
  "Battle Master manoeuvre dice and superiority-die consumption",
  "setup effects and persistent combat state",
  "guaranteed critical hits / Executioner",
  "area-of-effect and multiple targets",
];
const SURPRISE_WINDOW = {
  status: "unsupported", label: "Surprised first round", reasonCode: "surprise-initiative-and-condition-state",
  explanation: "Use the deterministic combat timeline's surprised branch; this legacy aggregate window has no initiative weighting.",
} as const;
const SETUP_WINDOW = {
  status: "unsupported", label: "Setup", reasonCode: "setup-effect-state-not-modeled",
  explanation: "No setup action, effect duration, concentration state, or persistent target modifier is executable in this curated slice.",
} as const;

type ClassOption = typeof CLASS_OPTIONS[number];
function abilityModifier(score: number): number { return Math.floor((score - 10) / 2); }
function mechanic(repository: EngineRepository, id: string): RangedMechanic {
  const value = engineMetadata(repository.getEntity(id)).ranged;
  if (!value) throw new Error(`Required executable ranged metadata is missing: ${id}`);
  return value;
}
function buildFor(option: ClassOption, weaponId: string): Build {
  const martial = option.classId !== "class-rogue";
  return {
    id: `${option.subclassId}-${weaponId}`, name: `${option.label} 5 · ${weaponId.replace("item-", "")}`,
    gameVersion: "Patch 8", level: 5, raceId: martial ? MARTIAL_RACE_ID : ASSASSIN_RACE_ID,
    classes: [{ classId: option.classId, subclassId: option.subclassId, level: 5 }],
    abilityScores: { strength: 16, dexterity: 16, constitution: 14, intelligence: 8, wisdom: 12, charisma: 8 },
    choices: martial ? [{ level: option.classId === "class-fighter" ? 1 : 2, choiceId: "fighting-style", optionIds: [ARCHERY_ID] }] : [],
    feats: [SHARPSHOOTER_ID], preparedSpells: [], equipment: [{ slot: "ranged-main-hand", itemId: weaponId }],
  };
}
function rejectionCounts(reasons: string[]): Record<string, number> {
  return Object.fromEntries([...new Set(reasons)].sort().map(reason => [reason, reasons.filter(value => value === reason).length]));
}
function ordinaryPlan(label: string, attack: AttackInput, count: number, source: "ordinary" | "sneak-attack" = "ordinary"): CombatPlan {
  return { label, turns: 1, events: [{ source, count, attack }], resourcesSpent: [] };
}
function horizonPlan(rounds: number, nova: CombatPlan, steady: CombatPlan): CombatPlan {
  return rounds === 1 ? { ...nova, label: "1-round total" } : combineCombatPlans(`${rounds}-round total`, nova, repeatCombatPlan(steady, rounds - 1));
}
function effectiveAssassinMode(mode: AttackRollMode): AttackRollMode {
  return mode === "disadvantage" ? "normal" : "advantage";
}
function provenanceMechanic(entityId: string, weaponId: string): string {
  const labels: Record<string, string> = {
    [ARCHERY_ID]: "Archery attack bonus", [EXTRA_ATTACK_ID]: "Extra Attack schedule", [SHARPSHOOTER_ID]: "Sharpshooter policy",
    [ACTION_SURGE_ID]: "Action Surge nova schedule", [ALACRITY_ID]: "Alacrity cited; no pre-combat attack is modeled",
    [ASSASSINATE_INITIATIVE_ID]: "Advantage while the target has not taken a turn", [ASSASSINATE_AMBUSH_ID]: "Critical hits against a surprised target",
    [SNEAK_ATTACK_ID]: "Ranged Sneak Attack 3d6, once per turn with advantage",
  };
  return entityId === weaponId ? "weapon" : labels[entityId] ?? "class or subclass schedule eligibility";
}

export function optimizeBuild(repository: EngineRepository, input: OptimizationRequest): OptimizerResult {
  const parsed = optimizationRequestSchema.parse(input);
  const request = { ...parsed, combat: { ...parsed.combat, horizons: [...new Set([1, 2, 3, 5, ...parsed.combat.horizons])].sort((a, b) => a - b) } };
  const archery = mechanic(repository, ARCHERY_ID), extraAttack = mechanic(repository, EXTRA_ATTACK_ID), sharpshooter = mechanic(repository, SHARPSHOOTER_ID), actionSurge = mechanic(repository, ACTION_SURGE_ID);
  if (archery.kind !== "attack-bonus" || extraAttack.kind !== "extra-attack" || sharpshooter.kind !== "sharpshooter" || actionSurge.kind !== "action-surge") throw new Error("Required ranged policy metadata has an unexpected kind.");
  const assassinMechanics = [mechanic(repository, ALACRITY_ID), mechanic(repository, ASSASSINATE_INITIATIVE_ID), mechanic(repository, ASSASSINATE_AMBUSH_ID), mechanic(repository, SNEAK_ATTACK_ID)];
  const sneak = assassinMechanics[3]!;
  if (assassinMechanics[0]?.kind !== "assassins-alacrity" || assassinMechanics[1]?.kind !== "assassinate-initiative" || assassinMechanics[2]?.kind !== "assassinate-ambush" || sneak.kind !== "sneak-attack") throw new Error("Required Assassin metadata has an unexpected kind.");

  const generated = CLASS_OPTIONS.flatMap(option => WEAPON_IDS.flatMap(weaponId => SHARPSHOOTER_POLICIES.map(sharpshooterEnabled => ({ option, weaponId, sharpshooterEnabled, build: buildFor(option, weaponId) }))));
  const rejected: string[] = [];
  const valid = generated.flatMap(candidate => {
    const validation = validateBuild(candidate.build, repository, { availableAct: request.availableAct });
    if (!validation.valid) { rejected.push(...validation.issues.map(issue => issue.code)); return []; }
    const weapon = mechanic(repository, candidate.weaponId), subclass = candidate.option.classId === "class-rogue" ? undefined : mechanic(repository, candidate.option.subclassId);
    if (weapon.kind !== "weapon" || (subclass && subclass.kind !== "battle-manoeuvre" && subclass.kind !== "dread-ambusher")) { rejected.push("unsupported-ranged-metadata"); return []; }
    const dexterity = abilityModifier(candidate.build.abilityScores.dexterity), strength = abilityModifier(candidate.build.abilityScores.strength);
    const basePacket: DamagePacket = { damageType: weapon.damageType, dice: [{ count: weapon.baseDamage.count, sides: weapon.baseDamage.sides }], flat: (weapon.baseDamage.flat ?? 0) + dexterity + (weapon.strengthDamage ? Math.max(weapon.strengthDamage.minimumModifier, strength) : 0) + (candidate.sharpshooterEnabled ? sharpshooter.damageBonus : 0), crittable: true };
    const isAssassin = candidate.option.classId === "class-rogue";
    const attack = (rollMode: AttackRollMode, guaranteedCritical = false, sneakAttack = false, extraDie?: { count: number; sides: number }): AttackInput => ({
      attackBonus: 3 + dexterity + weapon.attackBonus + (isAssassin ? 0 : archery.bonus) + (candidate.sharpshooterEnabled ? sharpshooter.attackRollPenalty : 0),
      armorClass: request.combat.targetArmorClass, rollMode, criticalThreshold: 20, guaranteedCritical,
      packets: [{ ...basePacket, dice: [...basePacket.dice, ...(extraDie ? [extraDie] : [])] }, ...(sneakAttack ? [{ damageType: weapon.damageType, dice: [sneak.damageDice], flat: 0, crittable: true }] : [])], target: request.combat.target,
    });
    const baseAttack = attack(request.combat.rollMode, false, isAssassin && request.combat.rollMode === "advantage");
    const attacksPerAction = isAssassin ? 1 : extraAttack.attacksPerAction;
    const staticSource = isAssassin && request.combat.rollMode === "advantage" ? "sneak-attack" : "ordinary";
    const single = ordinaryPlan("Single attack", baseAttack, 1, staticSource), steady = ordinaryPlan("Steady-state round", baseAttack, attacksPerAction, staticSource);
    let opener: CombatPlan, nova: CombatPlan;
    if (subclass?.kind === "battle-manoeuvre") {
      opener = ordinaryPlan("Opener", baseAttack, attacksPerAction);
      nova = { ...ordinaryPlan("Nova", baseAttack, attacksPerAction * 2), resourcesSpent: [{ resource: "Action Surge", amount: actionSurge.extraActionsPerShortRest, recovery: "short-rest" }] };
    } else if (subclass?.kind === "dread-ambusher") {
      opener = { label: "Opener", turns: 1, events: [{ source: "ordinary", count: attacksPerAction, attack: baseAttack }, { source: "dread-ambusher", count: subclass.firstRoundExtraAttacks, attack: attack(request.combat.rollMode, false, false, subclass.extraAttackDamage) }], resourcesSpent: [{ resource: "Dread Ambusher", amount: 1, recovery: "encounter" }] };
      nova = { ...opener, label: "Nova" };
    } else { opener = ordinaryPlan("Opener", baseAttack, 1, staticSource); nova = { ...opener, label: "Nova" }; }
    const evaluate = (plan: CombatPlan): EvaluatedDamageWindow => evaluateCombatPlan(plan, request.combat.targetHitPoints).result;
    const windows = { singleAttack: evaluate(single), opener: evaluate(opener), nova: evaluate(nova), steadyState: evaluate(steady), surprise: SURPRISE_WINDOW, setup: SETUP_WINDOW, horizons: request.combat.horizons.map(rounds => ({ rounds, window: evaluate(horizonPlan(rounds, nova, steady)) })) };

    const initiative = dexterity + (subclass?.kind === "dread-ambusher" ? engineMetadata(repository.getEntity(candidate.option.subclassId)).initiative ?? 0 : 0);
    const timelineBase = { candidateInitiativeModifier: initiative, candidateDexterityScore: candidate.build.abilityScores.dexterity, targetInitiativeModifier: request.combat.targetInitiativeModifier, targetDexterityScore: request.combat.targetDexterityScore, equalTotalAndDexterity: request.combat.equalTotalAndDexterity, surprisedDeniedTurnCountsAsTaken: request.combat.surprisedDeniedTurnCountsAsTaken } as const;
    const timeline = evaluatedCombatTimelineSchema.parse(evaluateCombatTimeline({
      ...timelineBase,
      resolveTurn: context => {
        if (!isAssassin) {
          const firstRound = context.round === 1;
          return {
            plan: firstRound ? nova : steady,
            appliedFeatures: firstRound
              ? [EXTRA_ATTACK_ID, ...(subclass?.kind === "battle-manoeuvre" ? [ACTION_SURGE_ID] : [candidate.option.subclassId])]
              : [EXTRA_ATTACK_ID],
          };
        }
        const assassinInitiativeApplies = !context.targetHadTakenTurn;
        const rollMode = assassinInitiativeApplies ? effectiveAssassinMode(request.combat.rollMode) : request.combat.rollMode;
        const sneakAttackApplies = rollMode === "advantage";
        return {
          plan: ordinaryPlan("Assassin timeline turn", attack(rollMode, context.targetSurprised, sneakAttackApplies), 1, sneakAttackApplies ? "sneak-attack" : "ordinary"),
          appliedFeatures: [
            ...(assassinInitiativeApplies ? [ASSASSINATE_INITIATIVE_ID] : []),
            ...(context.targetSurprised ? [ASSASSINATE_AMBUSH_ID] : []),
            ...(sneakAttackApplies ? [SNEAK_ATTACK_ID] : []),
          ],
        };
      },
    }, request.combat.targetHitPoints));
    const refIds = [candidate.build.raceId, candidate.option.classId, candidate.option.subclassId, candidate.weaponId, SHARPSHOOTER_ID, ...(isAssassin ? [ALACRITY_ID, ASSASSINATE_INITIATIVE_ID, ASSASSINATE_AMBUSH_ID, SNEAK_ATTACK_ID] : [ARCHERY_ID, EXTRA_ATTACK_ID]), ...(candidate.option.classId === "class-fighter" ? [ACTION_SURGE_ID] : [])];
    const refs = refIds.map(entityId => { const entity = repository.getEntity(entityId)!; if (!entity.source.url) throw new Error(`Required provenance URL is missing: ${entityId}`); return { entityId, label: entity.text.name, url: entity.source.url, mechanic: provenanceMechanic(entityId, candidate.weaponId), ...(entity.iconUrl ? { iconUrl: entity.iconUrl } : {}) }; });
    return [{ ...candidate, windows, timeline, refs }];
  });
  valid.sort((a, b) => b.windows.nova.summary.expected - a.windows.nova.summary.expected || b.windows.steadyState.summary.expected - a.windows.steadyState.summary.expected || a.build.id!.localeCompare(b.build.id!) || Number(a.sharpshooterEnabled) - Number(b.sharpshooterEnabled));
  if (valid.length === 0) throw new Error("No legal candidates were found in the curated search scope.");
  const candidates = valid.slice(0, request.topK).map((candidate, index) => ({ rank: index + 1, build: { ...candidate.build, gameVersion: request.gameVersion }, weaponId: candidate.weaponId, rankingScore: candidate.windows.nova.summary.expected, windows: candidate.windows, timeline: candidate.timeline, policy: { archery: candidate.option.classId === "class-rogue" ? "unavailable" as const : "always" as const, extraAttack: candidate.option.classId === "class-rogue" ? "unavailable" as const : "always" as const, sharpshooter: candidate.sharpshooterEnabled ? "enabled" as const : "disabled" as const }, provenance: candidate.refs }));
  return { request, candidates, ranking: { window: "nova", metric: "expectedDamage", tieBreakers: ["steadyState.expectedDamage", "build.id", "sharpshooterPolicy"] }, validation: { generatedCandidates: generated.length, validCandidates: valid.length, rejectedCandidates: generated.length - valid.length, rejectionReasons: rejectionCounts(rejected) }, bounds: { evaluatedCandidates: valid.length, candidateSetSize: generated.length, returnedCandidates: candidates.length, searchScope: "curated-l5-act1-ranged-timeline-v3", exactWithinDeclaredScope: true, globallyOptimal: false }, unsupportedMechanics: UNSUPPORTED, guarantee: "Every candidate in the declared curated Battle Master 5 / Gloom Stalker 5 / Assassin 5, four-bow, two-Sharpshooter-policy scope (24 total) is validated before exact PMF evaluation and deterministic Nova ranking; timeline branches enumerate all 16 opposed d4 initiative pairs under the echoed denied-turn assumption." };
}
