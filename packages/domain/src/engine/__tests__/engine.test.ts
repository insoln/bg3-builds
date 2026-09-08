import { describe, expect, it } from "vitest";
import type { Build, GameEntity } from "../../index.js";
import { expectedAttackDamage, gameEntitySchema, generateCandidates, hitChance, InMemoryEngineRepository, mitigateDamage, rankBuilds, resolveStats, validateBuild } from "../../index.js";

const source = { source: "test", gameVersion: "1" };
const entity = (id: string, kind: GameEntity["kind"], tags: string[] = [], engine?: Record<string, unknown>): GameEntity => ({ id, slug: id, kind, text: { name: id }, tags, source, ...(engine ? { metadata: { engine } } : {}) });
const entities = [
  entity("fighter", "class", ["martial", "frontliner", "striker"]), entity("wizard", "class", ["caster", "controller"]),
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
  it("validates optional icon URLs", () => {
    expect(gameEntitySchema.safeParse({ ...entities[0], iconUrl: "https://bg3.wiki/icon.png" }).success).toBe(true);
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
  it("checks level sums and act availability", () => {
    const invalidLevels = validateBuild(baseBuild({ classes: [{ classId: "fighter", level: 3 }] }), repository);
    expect(invalidLevels.valid).toBe(false);
    expect(invalidLevels.issues.map((issue) => issue.code)).toContain("schema");
    const unavailable = validateBuild(baseBuild({ equipment: [{ slot: "ring-1", itemId: "late-ring" }] }), repository, { availableAct: 2 });
    expect(unavailable.issues.map((issue) => issue.code)).toContain("act-unavailable");
  });
  it("checks slots and two-hand/shield conflicts while allowing prepared concentration spells", () => {
    const result = validateBuild(baseBuild({ equipment: [{ slot: "melee-main-hand", itemId: "greatsword" }, { slot: "melee-off-hand", itemId: "shield" }], preparedSpells: [{ spellId: "focus-a", alwaysPrepared: false }, { spellId: "focus-b", alwaysPrepared: false }] }), repository);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["two-hand-conflict", "shield-conflict"]));
    expect(result.issues.map((issue) => issue.code)).not.toContain("concentration-conflict");
  });
});

describe("calculations", () => {
  it("keeps hit chance monotonic", () => expect(hitChance(8, 15)).toBeGreaterThan(hitChance(4, 15)));
  it("applies resistance before flat reduction", () => expect(mitigateDamage(10, "fire", ["fire"], 2).value).toBe(3));
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
