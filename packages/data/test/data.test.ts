import { describe, expect, it } from "vitest";
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
import { InMemoryEngineRepository, optimizeBuild, optimizerResultSchema } from "@bg3-builds/domain";
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
  it("validates complete provenance", () => {
    expect(validateProvenance(fixtureEntities, fixtureSources, fixtureClaims)).toEqual([]);
    const titanstring = fixtureEntities.find((entity) => entity.id === "item-titanstring-bow");
    expect(titanstring?.source.url).toBe("https://bg3.wiki/wiki/Titanstring_Bow");
    expect(fixtureEntities.find((entity) => entity.id === "subclass-school-of-divination")?.source.url)
      .toBe("https://bg3.wiki/wiki/Divination_School");
    expect(titanstring?.iconUrl).toContain("Longbow_PlusOne_Icon.png");
    expect(fixtureClaims.find((claim) => claim.id === "item-titanstring-bow:engine")).toMatchObject({
      field: "metadata.engine",
      locator: titanstring?.source.url,
      value: expect.objectContaining({ ranged: expect.objectContaining({ sourceEntityId: "item-titanstring-bow" }) }),
    });
    expect(validateProvenance([
      { ...fixtureEntities[0]!, source: { ...fixtureEntities[0]!.source, url: "https://example.test/wiki/Barbarian" } },
    ], fixtureSources, [])).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unregistered-source" })]));
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
    const request = { gameVersion: "Patch 8", level: 5 as const, availableAct: 1 as const, combat: { mode: "ranged" as const, targetArmorClass: 15, surprise: false as const, guaranteedCritical: false as const, areaTargets: 1 as const }, topK: 5 };
    const first = optimizeBuild(repository, request);
    const second = optimizeBuild(repository, request);
    expect(optimizerResultSchema.parse(first)).toEqual(first);
    expect(first).toEqual(second);
    expect(first.bounds).toMatchObject({ candidateSetSize: 16, evaluatedCandidates: 16, returnedCandidates: 5, exactWithinDeclaredScope: true });
    expect(first.validation).toEqual({ generatedCandidates: 16, validCandidates: 16, rejectedCandidates: 0, rejectionReasons: {} });
    expect(first.candidates.map(candidate => candidate.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(first.candidates.every(candidate => candidate.provenance.length >= 6)).toBe(true);
    expect(first.candidates[0]!.oneRound.expected).toBeGreaterThanOrEqual(first.candidates[1]!.oneRound.expected);
  });
  it("uses target mitigation, roll mode, and Titanstring Strength rider in exact PMFs", () => {
    const repository = new InMemoryEngineRepository(fixtureEntities);
    const normal = optimizeBuild(repository, { gameVersion: "Patch 8", level: 5, availableAct: 1, topK: 16 });
    const resistant = optimizeBuild(repository, { gameVersion: "Patch 8", level: 5, availableAct: 1, combat: { mode: "ranged", targetArmorClass: 15, rollMode: "advantage", target: { resistances: ["piercing"] } }, topK: 16 });
    const normalTitan = normal.candidates.find(candidate => candidate.weaponId === "item-titanstring-bow" && candidate.policy.sharpshooter === "disabled")!;
    const normalLongbow = normal.candidates.find(candidate => candidate.weaponId === "item-longbow-plus-one" && candidate.policy.sharpshooter === "disabled")!;
    expect(normalTitan.attack.expected).toBeGreaterThan(normalLongbow.attack.expected);
    expect(resistant.candidates.find(candidate => candidate.weaponId === "item-titanstring-bow")!.attack.expected).toBeLessThan(normalTitan.attack.expected);
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
