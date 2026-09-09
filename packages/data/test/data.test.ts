import { describe, expect, it } from "vitest";
import {
  InMemoryEngineRepository,
  optimizeBuild,
  optimizerResultSchema,
  validateBuild,
  type Build,
} from "@bg3-builds/domain";
import {
  ClaimRepository,
  ConversationRepository,
  EntityRepository,
  SourceRepository,
  fixtureClaims,
  fixtureEntities,
  fixtureSources,
  openDatabase,
  parseCanonicalHtml,
  parseMediaWikiXml,
  validateProvenance,
  validateUrlManifest,
} from "../src/index.js";
describe("data layer", () => {
  it("upserts fixtures idempotently and searches FTS", () => {
    const db = openDatabase();
    const sources = new SourceRepository(db),
      entities = new EntityRepository(db),
      claims = new ClaimRepository(db);
    for (let i = 0; i < 2; i++) {
      fixtureSources.forEach((x) => sources.upsert(x));
      fixtureEntities.forEach((x) => entities.upsert(x));
      fixtureClaims.forEach((x) => claims.upsert(x));
    }
    expect(entities.list()).toHaveLength(fixtureEntities.length);
    expect(entities.search("Titanstring")[0]).toMatchObject({
      id: "item-titanstring-bow",
      source: { url: "https://bg3.wiki/wiki/Titanstring_Bow" },
      iconUrl: expect.stringContaining("Longbow_PlusOne_Icon.png"),
    });
    expect(entities.get("item-titanstring-bow")?.iconUrl).toContain("Longbow_PlusOne_Icon.png");
    expect(entities.list().find((entity) => entity.id === "item-titanstring-bow")?.iconUrl).toContain("Longbow_PlusOne_Icon.png");
    expect(claims.forEntity("item-titanstring-bow")).toHaveLength(2);
    db.close();
  });
  it("stores ordered conversations", () => {
    const db = openDatabase(),
      r = new ConversationRepository(db),
      now = "2026-09-07T00:00:00.000Z";
    r.upsert({ id: "c", createdAt: now, updatedAt: now });
    r.append({
      id: "m2",
      conversationId: "c",
      ordinal: 1,
      role: "assistant",
      content: "b",
      createdAt: now,
    });
    r.append({
      id: "m1",
      conversationId: "c",
      ordinal: 0,
      role: "user",
      content: "a",
      createdAt: now,
    });
    expect(r.messages("c").map((x) => x.content)).toEqual(["a", "b"]);
    db.close();
  });
  it("normalizes Act tags into engine metadata and rejects later-act equipment", () => {
    const riskyRing = fixtureEntities.find((entity) => entity.id === "item-risky-ring");
    expect(riskyRing?.metadata?.["engine"]).toMatchObject({ availableAct: 2 });
    const build: Build = {
      name: "Act one ring", gameVersion: "Patch 8", level: 1, raceId: "race-human",
      classes: [{ classId: "class-fighter", level: 1 }],
      abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
      choices: [], feats: [], preparedSpells: [], equipment: [{ slot: "ring-1", itemId: "item-risky-ring" }],
    };
    expect(validateBuild(build, new InMemoryEngineRepository(fixtureEntities), { availableAct: 1 }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "act-unavailable", entityId: "item-risky-ring" })]));
  });
  it("validates complete provenance", () => {
    expect(validateProvenance(fixtureEntities, fixtureSources, fixtureClaims)).toEqual([]);
    const titanstring = fixtureEntities.find((entity) => entity.id === "item-titanstring-bow");
    expect(titanstring?.source.url).toBe("https://bg3.wiki/wiki/Titanstring_Bow");
    expect(fixtureEntities.find((entity) => entity.id === "subclass-school-of-divination")?.source.url)
      .toBe("https://bg3.wiki/wiki/Divination_School");
    expect(fixtureEntities.find((entity) => entity.id === "subclass-assassin")?.metadata?.["engine"])
      .toMatchObject({ parentClassId: "class-rogue", minimumClassLevel: 3 });
    expect(fixtureEntities.find((entity) => entity.id === "passive-assassins-alacrity")?.source.url)
      .toBe("https://bg3.wiki/wiki/Assassin's_Alacrity");
    expect(fixtureEntities.find((entity) => entity.id === "passive-assassinate-initiative")?.source.url)
      .toBe("https://bg3.wiki/wiki/Assassinate%3A_Initiative");
    expect(fixtureEntities.find((entity) => entity.id === "passive-assassinate-ambush")?.source.url)
      .toBe("https://bg3.wiki/wiki/Assassinate%3A_Ambush");
    expect(fixtureEntities.find((entity) => entity.id === "action-sneak-attack-ranged")?.metadata?.["engine"])
      .toMatchObject({ ranged: { kind: "sneak-attack", damageDice: { count: 3, sides: 6 }, qualificationWithAdvantage: true, oncePerTurn: true } });
    expect(fixtureEntities.find((entity) => entity.id === "subclass-gloom-stalker")?.metadata?.["engine"])
      .toMatchObject({ initiative: 3 });
    expect(titanstring?.iconUrl).toContain("Longbow_PlusOne_Icon.png");
    expect(fixtureClaims.find((claim) => claim.id === "item-titanstring-bow:engine")).toMatchObject({
      field: "metadata.engine",
      locator: titanstring?.source.url,
      value: expect.objectContaining({ ranged: expect.objectContaining({ sourceEntityId: "item-titanstring-bow" }) }),
    });
    expect(validateProvenance([
      { ...fixtureEntities[0]!, source: { ...fixtureEntities[0]!.source, url: "https://example.test/wiki/Barbarian" } },
    ], fixtureSources, [])).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unregistered-source" })]));
    expect(validateProvenance([
      { ...fixtureEntities[0]!, source: { ...fixtureEntities[0]!.source, url: "https://bg3.wiki/wiki/Unregistered" } },
    ], fixtureSources, [])).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unregistered-source" })]));
    expect(validateProvenance([
      { ...fixtureEntities[0]!, source: { ...fixtureEntities[0]!.source, gameVersion: "Patch 7" } },
    ], fixtureSources, [])).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unregistered-source" })]));
    expect(validateProvenance(fixtureEntities, fixtureSources, [
      { ...fixtureClaims[0]!, sourceId: `bg3-wiki-patch-8:${fixtureEntities[1]!.id}` },
    ])).toEqual(expect.arrayContaining([expect.objectContaining({ code: "source-mismatch", claimId: fixtureClaims[0]!.id })]));
    expect(validateProvenance(fixtureEntities, fixtureSources, [
      { ...fixtureClaims[0]!, locator: fixtureEntities[1]!.source.url },
    ])).toEqual(expect.arrayContaining([expect.objectContaining({ code: "source-mismatch", claimId: fixtureClaims[0]!.id })]));
  });
  it("parses offline XML and HTML", () => {
    expect(
      parseMediaWikiXml(
        `<mediawiki><page><title>Bow</title><id>1</id><revision><id>2</id><text>Damage</text></revision></page></mediawiki>`,
      )[0],
    ).toEqual({ title: "Bow", pageId: "1", revisionId: "2", text: "Damage" });
    expect(
      parseCanonicalHtml(
        `<html><head><link rel="canonical" href="https://bg3.wiki/wiki/Bow"><meta name="description" content="d"><meta property="og:image" content="/w/images/Bow.png"></head><body><main><h1>Bow</h1><p>Damage</p></main></body></html>`,
      ),
    ).toMatchObject({
      title: "Bow",
      description: "d",
      canonicalUrl: "https://bg3.wiki/wiki/Bow",
      iconUrl: "https://bg3.wiki/w/images/Bow.png",
    });
    expect(parseCanonicalHtml(
      `<html><head><link rel="canonical" href="https://bg3.wiki/wiki/Bow"><meta property="og:image" content="https://example.test/tracker.png"></head><body><main><h1>Bow</h1><img src="/unrelated.png"><p>Damage</p></main></body></html>`,
    ).iconUrl).toBeUndefined();
    expect(parseCanonicalHtml(
      `<html><head><link rel="canonical" href="/wiki/Bow"><meta property="og:image" content="/w/images/Bow.png"></head><body><main><h1>Bow</h1></main></body></html>`,
      "https://bg3.wiki/saved/Bow",
    )).toMatchObject({
      canonicalUrl: "https://bg3.wiki/wiki/Bow",
      iconUrl: "https://bg3.wiki/w/images/Bow.png",
    });
  });
  it("exactly and deterministically ranks the complete curated ranged scope", () => {
    const repository = new InMemoryEngineRepository(fixtureEntities);
    const request = { gameVersion: "Patch 8", level: 5 as const, availableAct: 1 as const, combat: { mode: "ranged" as const, targetArmorClass: 15, targetInitiativeModifier: 0, targetDexterityScore: 10, equalTotalAndDexterity: "target-first" as const, surprisedDeniedTurnCountsAsTaken: true, surprise: false as const, guaranteedCritical: false as const, areaTargets: 1 as const }, topK: 5 };
    const first = optimizeBuild(repository, request);
    const second = optimizeBuild(repository, request);
    expect(optimizerResultSchema.parse(first)).toEqual(first);
    expect(first).toEqual(second);
    expect(first.bounds).toMatchObject({ candidateSetSize: 24, evaluatedCandidates: 24, returnedCandidates: 5, searchScope: "curated-l5-act1-ranged-timeline-v3", exactWithinDeclaredScope: true });
    expect(first.validation).toEqual({ generatedCandidates: 24, validCandidates: 24, rejectedCandidates: 0, rejectionReasons: {} });
    expect(first.candidates.map(candidate => candidate.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(first.candidates.every(candidate => candidate.provenance.length >= 6)).toBe(true);
    expect(first.candidates
      .flatMap(candidate => candidate.provenance)
      .find(ref => ref.entityId === "item-titanstring-bow")?.iconUrl,
    ).toBe("https://bg3.wiki/w/images/thumb/3/36/Longbow_PlusOne_Icon.png/300px-Longbow_PlusOne_Icon.png.webp");
    expect(first.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-ranger").every(candidate => candidate.build.choices[0]?.level === 2)).toBe(true);
    expect(first.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-fighter").every(candidate => candidate.provenance.some(ref => ref.entityId === "action-action-surge"))).toBe(true);
    expect(first.candidates[0]!.windows.nova.summary.expected).toBeGreaterThanOrEqual(first.candidates[1]!.windows.nova.summary.expected);
    expect(first.candidates.every(candidate => candidate.windows.nova.summary.nonCritMax <= candidate.windows.nova.summary.critMax)).toBe(true);
    expect(first.candidates.some(candidate => candidate.windows.nova.summary.nonCritMax < candidate.windows.nova.summary.critMax)).toBe(true);
    expect(first.ranking).toEqual({ window: "nova", metric: "expectedDamage", tieBreakers: ["steadyState.expectedDamage", "build.id", "sharpshooterPolicy"] });
    expect(first.candidates.every(candidate => candidate.windows.surprise.status === "unsupported" && candidate.windows.setup.status === "unsupported")).toBe(true);
    expect(first.unsupportedMechanics).not.toEqual(expect.arrayContaining([expect.stringMatching(/surprise initiative|initiative state/i)]));
  });
  it("evaluates all 24 candidates and Assassin timeline conditions", () => {
    const run = (surprisedDeniedTurnCountsAsTaken: boolean) => optimizeBuild(new InMemoryEngineRepository(fixtureEntities), {
      gameVersion: "Patch 8", level: 5, availableAct: 1, topK: 24,
      combat: {
        mode: "ranged", targetInitiativeModifier: 3, targetDexterityScore: 16,
        equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken,
      },
    });
    const result = run(false);
    expect(result.candidates).toHaveLength(24);
    expect(result.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-rogue")).toHaveLength(8);
    expect(result.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-fighter")).toHaveLength(8);
    expect(result.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-ranger")).toHaveLength(8);
    const assassins = result.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-rogue");
    expect(assassins.every(candidate => candidate.policy.archery === "unavailable" && candidate.policy.extraAttack === "unavailable")).toBe(true);
    expect(assassins.every(candidate => candidate.build.raceId === "race-wood-elf")).toBe(true);
    expect(assassins.every(candidate => candidate.windows.opener.events[0]?.count === 1 && candidate.windows.steadyState.events[0]?.count === 1)).toBe(true);
    expect(assassins.every(candidate => [
      "passive-assassins-alacrity", "passive-assassinate-initiative", "passive-assassinate-ambush", "action-sneak-attack-ranged",
    ].every(id => candidate.provenance.some(ref => ref.entityId === id)))).toBe(true);
    expect(result.candidates.filter(candidate => candidate.build.classes[0]?.classId === "class-ranger")
      .every(candidate => candidate.timeline.initiative.candidateModifier === 6)).toBe(true);

    const fighter = result.candidates.find(candidate => candidate.build.classes[0]?.classId === "class-fighter"
      && candidate.weaponId === "item-longbow-plus-one" && candidate.policy.sharpshooter === "disabled")!;
    expect(fighter.timeline.noSurprise.cases.find(value => value.order === "candidate-first")).toMatchObject({
      turnsBeforeTargetFirstActionableTurn: [{ events: [{ kind: "ranged-attack", source: "ordinary", count: 4 }] }],
      appliedFeatures: ["passive-extra-attack", "action-action-surge"],
    });

    const assassin = assassins.find(candidate => candidate.weaponId === "item-longbow-plus-one" && candidate.policy.sharpshooter === "disabled")!;
    expect(assassin.timeline.metric).toBe("probability-kill-before-target-first-actionable-turn");
    expect(assassin.timeline.initiative).toMatchObject({ candidateModifier: 3, candidateDexterityScore: 16, targetModifier: 3, targetDexterityScore: 16, equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken: false });
    expect(assassin.timeline.noSurprise.cases.map(value => value.order).sort()).toEqual(["candidate-first", "target-first"]);
    expect(assassin.timeline.surprised.cases.find(value => value.order === "candidate-first")?.candidateTurns).toBe(2);
    expect(assassin.timeline.surprised.cases.find(value => value.order === "target-first")?.candidateTurns).toBe(1);
    expect(assassin.timeline.surprised.cases.find(value => value.order === "target-first")?.appliedFeatures)
      .toEqual(expect.arrayContaining(["passive-assassinate-initiative", "passive-assassinate-ambush", "action-sneak-attack-ranged"]));
    expect(assassin.timeline.surprised.cases.find(value => value.order === "target-first")?.summary.critMax).toBe(56);

    const countsAsTaken = run(true).candidates.find(candidate => candidate.build.id === assassin.build.id && candidate.policy.sharpshooter === "disabled")!;
    expect(countsAsTaken.timeline.initiative.surprisedDeniedTurnCountsAsTaken).toBe(true);
    expect(countsAsTaken.timeline.surprised.cases.find(value => value.order === "target-first")?.appliedFeatures)
      .not.toContain("passive-assassinate-initiative");
  });
  it("normalizes custom horizons and propagates target HP into optimizer windows", () => {
    const result = optimizeBuild(new InMemoryEngineRepository(fixtureEntities), {
      gameVersion: "Patch 8", level: 5, availableAct: 1, topK: 16,
      combat: { mode: "ranged", targetHitPoints: 1_000, targetInitiativeModifier: 0, targetDexterityScore: 10, equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken: true, horizons: [8, 2, 8] },
    });
    expect(result.request.combat.horizons).toEqual([1, 2, 3, 5, 8]);
    expect(result.candidates.every(candidate => candidate.windows.horizons.map(horizon => horizon.rounds).join(",") === "1,2,3,5,8")).toBe(true);
    expect(result.candidates.every(candidate => candidate.windows.horizons.at(-1)?.window.turns === 8)).toBe(true);
    expect(result.candidates.every(candidate => candidate.windows.nova.probabilityKill === 0)).toBe(true);

    const ranger = result.candidates.find(candidate => candidate.build.classes[0]?.classId === "class-ranger")!;
    expect(ranger.windows.nova.events).toEqual([
      { kind: "ranged-attack", source: "ordinary", count: 2 },
      { kind: "ranged-attack", source: "dread-ambusher", count: 1 },
    ]);
    expect(ranger.windows.nova.resourcesSpent).toEqual([{ resource: "Dread Ambusher", amount: 1, recovery: "encounter" }]);
    expect(ranger.windows.steadyState.resourcesSpent).toEqual([]);
  });

  it("matches hand-derived combat-window oracles", () => {
    const result = optimizeBuild(new InMemoryEngineRepository(fixtureEntities), {
      gameVersion: "Patch 8", level: 5, availableAct: 1, topK: 16,
      combat: { mode: "ranged", targetInitiativeModifier: 0, targetDexterityScore: 10, equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken: true },
    });
    const candidate = (classId: string, sharpshooter: "enabled" | "disabled") =>
      result.candidates.find(value => value.build.classes[0]?.classId === classId
        && value.weaponId === "item-longbow-plus-one"
        && value.policy.sharpshooter === sharpshooter)!;

    expect(candidate("class-fighter", "disabled")).toMatchObject({
      windows: {
        singleAttack: { summary: { expected: expect.closeTo(6.6), nonCritMax: 12, critMax: 20 } },
        opener: { summary: { expected: expect.closeTo(13.2), nonCritMax: 24, critMax: 40 } },
        nova: { summary: { expected: expect.closeTo(26.4), nonCritMax: 48, critMax: 80 } },
        steadyState: { summary: { expected: expect.closeTo(13.2), nonCritMax: 24, critMax: 40 } },
        horizons: expect.arrayContaining([{ rounds: 3, window: expect.objectContaining({ summary: expect.objectContaining({ expected: expect.closeTo(52.8), nonCritMax: 96, critMax: 160 }) }) }]),
      },
    });
    expect(candidate("class-ranger", "disabled")).toMatchObject({
      windows: {
        singleAttack: { summary: { expected: expect.closeTo(6.6), nonCritMax: 12, critMax: 20 } },
        opener: { summary: { expected: expect.closeTo(23.4), nonCritMax: 44, critMax: 76 } },
        nova: { summary: { expected: expect.closeTo(23.4), nonCritMax: 44, critMax: 76 } },
        steadyState: { summary: { expected: expect.closeTo(13.2), nonCritMax: 24, critMax: 40 } },
        horizons: expect.arrayContaining([{ rounds: 3, window: expect.objectContaining({ summary: expect.objectContaining({ expected: expect.closeTo(49.8), nonCritMax: 92, critMax: 156 }) }) }]),
      },
    });
    expect(candidate("class-fighter", "enabled")).toMatchObject({
      windows: {
        singleAttack: { summary: { expected: expect.closeTo(9.475), nonCritMax: 22, critMax: 30 } },
        nova: { summary: { expected: expect.closeTo(37.9), nonCritMax: 88, critMax: 120 } },
        horizons: expect.arrayContaining([{ rounds: 3, window: expect.objectContaining({ summary: expect.objectContaining({ expected: expect.closeTo(75.8), nonCritMax: 176, critMax: 240 }) }) }]),
      },
    });
  });
  it("applies target AC, roll mode, mitigation, and Titanstring independently", () => {
    const repository = new InMemoryEngineRepository(fixtureEntities);
    const run = (combat: { targetArmorClass?: number; rollMode?: "normal" | "advantage" | "disadvantage"; target?: { resistances?: "piercing"[] } } = {}) =>
      optimizeBuild(repository, { gameVersion: "Patch 8", level: 5, availableAct: 1, combat: { mode: "ranged", targetInitiativeModifier: 0, targetDexterityScore: 10, equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken: true, ...combat }, topK: 16 });
    const find = (result: ReturnType<typeof run>, weaponId = "item-longbow-plus-one") =>
      result.candidates.find(candidate => candidate.build.classes[0]?.classId === "class-fighter"
        && candidate.weaponId === weaponId && candidate.policy.sharpshooter === "disabled")!;
    const normal = run();
    expect(find(run({ rollMode: "advantage" })).windows.singleAttack.summary.expected).toBeGreaterThan(find(normal).windows.singleAttack.summary.expected);
    expect(find(run({ rollMode: "disadvantage" })).windows.singleAttack.summary.expected).toBeLessThan(find(normal).windows.singleAttack.summary.expected);
    expect(find(run({ targetArmorClass: 20 })).windows.singleAttack.summary.expected).toBeLessThan(find(normal).windows.singleAttack.summary.expected);
    expect(find(run({ target: { resistances: ["piercing"] } })).windows.singleAttack.summary.expected).toBeLessThan(find(normal).windows.singleAttack.summary.expected);
    expect(find(normal, "item-titanstring-bow").windows.singleAttack.summary.expected).toBeGreaterThan(find(normal).windows.singleAttack.summary.expected);
  });
  it("bounds and allowlists URL manifests", () => {
    expect(
      validateUrlManifest({
        allowedHosts: ["bg3.wiki"],
        entries: [
          {
            url: "https://bg3.wiki/x",
            kind: "canonical-html",
            gameVersion: "Patch 8",
            license: "CC",
          },
        ],
      }).entries,
    ).toHaveLength(1);
    expect(() =>
      validateUrlManifest({
        allowedHosts: ["bg3.wiki"],
        entries: [
          {
            url: "https://evil.test/x",
            kind: "canonical-html",
            gameVersion: "Patch 8",
            license: "CC",
          },
        ],
      }),
    ).toThrow(/allowlisted/);
  });
});
