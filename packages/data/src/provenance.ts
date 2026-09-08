import type { GameEntity } from "@bg3-builds/domain";
import type { Claim, SourceRecord } from "./types.js";

export interface ProvenanceIssue {
  code: string;
  message: string;
  entityId?: string;
  claimId?: string;
}

function sourceKey(url: string, gameVersion: string): string {
  return `${url}\0${gameVersion}`;
}

export function validateProvenance(
  entities: readonly GameEntity[],
  sources: readonly SourceRecord[],
  claims: readonly Claim[],
): ProvenanceIssue[] {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const sourcesWithUrls = sources.filter(
    (source): source is SourceRecord & { url: string } => source.url !== undefined,
  );
  const registeredSources = new Set(
    sourcesWithUrls.map((source) => sourceKey(source.url, source.gameVersion)),
  );
  const issues: ProvenanceIssue[] = [];

  for (const entity of entities) {
    if (!entity.source.source.trim()) {
      issues.push({
        code: "missing-source",
        message: "Entity source is empty",
        entityId: entity.id,
      });
    }

    if (
      entity.source.url
      && !registeredSources.has(sourceKey(entity.source.url, entity.source.gameVersion))
    ) {
      issues.push({
        code: "unregistered-source",
        message: "Entity URL/version has no registered source",
        entityId: entity.id,
      });
    }
  }

  for (const claim of claims) {
    const entity = entitiesById.get(claim.entityId);
    const source = sourcesById.get(claim.sourceId);
    if (!entity) {
      issues.push({
        code: "unknown-entity",
        message: "Claim references unknown entity",
        claimId: claim.id,
      });
    }
    if (!source) {
      issues.push({
        code: "unknown-source",
        message: "Claim references unknown source",
        claimId: claim.id,
      });
    } else if (
      entity?.source.url
      && (source.url !== entity.source.url
        || source.gameVersion !== entity.source.gameVersion
        || claim.locator !== entity.source.url)
    ) {
      issues.push({
        code: "source-mismatch",
        message: "Claim source and locator do not match the entity canonical source",
        entityId: claim.entityId,
        claimId: claim.id,
      });
    }
    if (!claim.evidence.trim()) {
      issues.push({
        code: "missing-evidence",
        message: "Claim has no evidence",
        claimId: claim.id,
      });
    }
  }

  return issues;
}
