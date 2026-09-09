import { describe, expect, it } from "vitest";
import type { Build, GameEntity } from "../../index.js";
import { engineMetadata, expectedAttackDamage, gameEntitySchema, generateCandidates, hitChance, InMemoryEngineRepository, mitigateDamage, optimizerResultSchema, parseRangedMechanic, rankBuilds, resolveStats, validateBuild } from "../../index.js";

const source = { source: "test", gameVersion: "1" };
const entity = (id: string, kind: GameEntity["kind"], tags: string[] = [], engine?: Record<string, unknown>): GameEntity => ({ id, slug: id, kind, text: { name: id }, tags, source, ...(engine ? { metadata: { engine } } : {}) });
const entities = [
  entity("fighter", "class", ["martial", "frontliner", "striker"]), entity("wizard", "class", ["caster", "controller"]),
  entity("battle-master", "subclass", [], { parentClassId: "fighter", minimumClassLevel: 3 }),
  entity("human", "race"), entity("elf", "race"),
  entity("greatsword", "item", [], { slot: "melee-main-hand", handedness: "two-handed", attackBonus: 1 }),
  entity("shield", "item", ["shield"], { slot: "melee-off-hand", shield: true, armorClass: 2 }),
  entity("late-ring", "item", [], { slot: "ring-1", availableAct: 3 }),
  entity("focus-a", "spell", ["concentration"]), entity("focus-b", "spell", [], { concentration: true }),
  entity("rider-a", "feat", ["drs"]), entity("rider-b", "feat", ["damage-rider-source"]),
];
const repository = new InMemoryEngineRepository(entities);
const baseBuild = (patch: Partial<Build> = {}): Build => ({ name: "Test", gameVersion: "1", level: 4, raceId: "human", classes: [{ classId: "fighter", level: 4 }], abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 }, choices: [], feats: [], preparedSpells: [], equipment: [], ...patch });

describe("entity schema", () => {
  it("parses strict ranged mechanics", () => {
    expect(parseRangedMechanic({ kind: "weapon", sourceEntityId: "bow", weaponType: "longbow", baseDamage: { count: 1, sides: 8, flat: 1 }, damageType: "piercing", attackAbility: "dexterity", strengthDamage: { ability: "strength", minimumModifier: 1 } })).toMatchObject({ kind: "weapon", baseDamage: { count: 1, sides: 8, flat: 1 } });
    expect(parseRangedMechanic({ kind: "sharpshooter", sourceEntityId: "feat", attackRollPenalty: -4, damageBonus: 10 })).toBeUndefined();
    expect(parseRangedMechanic({ kind: "sneak-attack", sourceEntityId: "sneak", appliesTo: "ranged-weapon", minimumClassLevel: 5, damageDice: { count: 3, sides: 6 }, qualificationWithAdvantage: true, oncePerTurn: true })).toMatchObject({ kind: "sneak-attack", damageDice: { count: 3, sides: 6 } });
    expect(parseRangedMechanic({ kind: "assassinate-ambush", sourceEntityId: "ambush", targetCondition: "surprised", successfulAttack: "critical-hit", guessed: true })).toBeUndefined();
    expect(engineMetadata(entity("bow", "item", [], { ranged: { kind: "weapon", sourceEntityId: "bow", weaponType: "longbow", baseDamage: { count: 1, sides: 8 }, damageType: "piercing", attackAbility: "dexterity", unexpected: true } })).ranged).toBeUndefined();
  });
  it("validates optional icon URLs", () => {
    expect(gameEntitySchema.safeParse({ ...entities[0], iconUrl: "https://bg3.wiki/icon.png" }).success).toBe(true);
    const optimizerResult = {
      request: { gameVersion: "Patch 8", level: 5, availableAct: 1 },
      candidates: [{
        rank: 1,
        build: baseBuild({ gameVersion: "Patch 8", level: 5, classes: [{ classId: "fighter", level: 5 }] }),
        weaponId: "bow",
        rankingScore: 1,
        windows: {},
        policy: { archery: "always", extraAttack: "always", sharpshooter: "disabled" },
        provenance: ["a", "b", "c", "d"].map(entityId => ({ entityId, label: entityId, url: "https://bg3.wiki/wiki/Test", iconUrl: "https://example.com/icon.png", mechanic: "test" })),
      }],
      validation: { generatedCandidates: 1, validCandidates: 1, rejectedCandidates: 0, rejectionReasons: {} },
      ranking: { window: "nova", metric: "expectedDamage", tieBreakers: ["steadyState.expectedDamage", "build.id", "sharpshooterPolicy"] }, bounds: { evaluatedCandidates: 1, candidateSetSize: 1, returnedCandidates: 1, searchScope: "curated-l5-act1-ranged-windows-v2", exactWithinDeclaredScope: true, globallyOptimal: false },
      unsupportedMechanics: ["test"],
      guarantee: "test",
    };
    expect(optimizerResultSchema.safeParse(optimizerResult).success).toBe(false);
    for (const iconUrl of [
      "not-a-url",
      "http://bg3.wiki/icon.png",
      "https://example.com/icon.png",
      "https://bg3.wiki.example.com/icon.png",
      "https://bg3.wiki:8443/icon.png",
      "https://user@bg3.wiki/icon.png",
    ]) {
      expect(gameEntitySchema.safeParse({ ...entities[0], iconUrl }).success).toBe(false);
    }
  });
});

describe("validation", () => {
  it("checks level sums and act availability for every build reference", () => {
    const invalidLevels = validateBuild(baseBuild({ classes: [{ classId: "fighter", level: 3 }] }), repository);
    expect(invalidLevels.valid).toBe(false);
    expect(invalidLevels.issues.map((issue) => issue.code)).toContain("schema");
    const unavailable = validateBuild(baseBuild({ equipment: [{ slot: "ring-1", itemId: "late-ring" }] }), repository, { availableAct: 2 });
    expect(unavailable.issues.map((issue) => issue.code)).toContain("act-unavailable");
    const lateRace = entity("late-race", "race", [], { availableAct: 3 });
    const lateFeat = entity("late-feat", "feat", [], { availableAct: 3 });
    const actRepository = new InMemoryEngineRepository([...entities, lateRace, lateFeat]);
    const actFiltered = validateBuild(baseBuild({ raceId: "late-race", feats: ["late-feat"] }), actRepository, { availableAct: 2 });
    expect(actFiltered.issues.filter((entry) => entry.code === "act-unavailable").map((entry) => entry.entityId)).toEqual(["late-race", "late-feat"]);
  });
  it("checks subclass parent class and unlock level", () => {
    expect(validateBuild(baseBuild({ level: 3, classes: [{ classId: "fighter", subclassId: "battle-master", level: 3 }] }), repository).valid).toBe(true);
    const wrongParent = validateBuild(baseBuild({ classes: [{ classId: "wizard", subclassId: "battle-master", level: 4 }] }), repository);
    expect(wrongParent.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "subclass-parent-mismatch", entityId: "battle-master" })]));
    const tooEarly = validateBuild(baseBuild({ level: 2, classes: [{ classId: "fighter", subclassId: "battle-master", level: 2 }] }), repository);
    expect(tooEarly.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "subclass-level-locked", entityId: "battle-master" })]));
  });
  it("checks slots and two-hand/shield conflicts while allowing prepared concentration spells", () => {
    const result = validateBuild(baseBuild({ equipment: [{ slot: "melee-main-hand", itemId: "greatsword" }, { slot: "melee-off-hand", itemId: "shield" }], preparedSpells: [{ spellId: "focus-a", alwaysPrepared: false }, { spellId: "focus-b", alwaysPrepared: false }] }), repository);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["two-hand-conflict", "shield-conflict"]));
    expect(result.issues.map((issue) => issue.code)).not.toContain("concentration-conflict");
  });
});

describe("calculations", () => {
  it("keeps hit chance monotonic", () => expect(hitChance(8, 15)).toBeGreaterThan(hitChance(4, 15)));
  it("floors resistance before flat reduction", () => {
    expect(mitigateDamage(10, "fire", ["fire"], 2).value).toBe(3);
    expect(mitigateDamage(5, "fire", ["fire"], 0).value).toBe(2);
  });
  it("calculates expected damage and explain traces", () => {
    const result = expectedAttackDamage({ attackBonus: 5, armorClass: 15, damageOnHit: 10, damageType: "fire", resistances: ["fire"], flatReduction: 2 });
    expect(result.expectedDamage).toBeCloseTo(result.hitChance * 3);
    expect(result.trace.map((entry) => entry.step)).toEqual(["resistance", "flat-reduction", "expected-damage"]);
  });
  it("warns for basic DRS stacking", () => expect(resolveStats(baseBuild({ feats: ["rider-a", "rider-b"] }), repository).warnings[0]?.code).toBe("drs-stacking"));
});

describe("ranking and generation", () => {
  it("ranks deterministically, including ties", () => {
    const alpha = baseBuild({ id: "alpha", name: "Alpha" }); const beta = baseBuild({ id: "beta", name: "Beta" });
    expect(rankBuilds([beta, alpha], repository).map(({ build }) => build.id)).toEqual(["alpha", "beta"]);
  });
  it("generates bounded deterministic role candidates", () => {
    const options = { level: 4, gameVersion: "1", maxCandidates: 3 } as const;
    const first = generateCandidates(repository, options); const second = generateCandidates(repository, options);
    expect(first).toHaveLength(3);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.map(({ build }) => build.id)).toEqual(second.map(({ build }) => build.id));
    expect(first.every((candidate, index) => index === 0 || first[index - 1]!.score >= candidate.score)).toBe(true);
  });
});
