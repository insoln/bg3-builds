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
    expect(entities.search("Titanstring")[0]?.id).toBe("item-titanstring-bow");
    expect(claims.forEntity("item-titanstring-bow")).toHaveLength(1);
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
  it("validates complete provenance", () =>
    expect(
      validateProvenance(fixtureEntities, fixtureSources, fixtureClaims),
    ).toEqual([]));
  it("parses offline XML and HTML", () => {
    expect(
      parseMediaWikiXml(
        `<mediawiki><page><title>Bow</title><id>1</id><revision><id>2</id><text>Damage</text></revision></page></mediawiki>`,
      )[0],
    ).toEqual({ title: "Bow", pageId: "1", revisionId: "2", text: "Damage" });
    expect(
      parseCanonicalHtml(
        `<html><head><link rel="canonical" href="https://bg3.wiki/x"><meta name="description" content="d"></head><body><main><h1>Bow</h1><p>Damage</p></main></body></html>`,
      ),
    ).toMatchObject({
      title: "Bow",
      description: "d",
      canonicalUrl: "https://bg3.wiki/x",
    });
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
