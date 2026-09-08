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
  const sourceIds = new Set(sources.map((source) => source.id));
  const entityIds = new Set(entities.map((entity) => entity.id));
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
    if (!entityIds.has(claim.entityId)) {
      issues.push({
        code: "unknown-entity",
        message: "Claim references unknown entity",
        claimId: claim.id,
      });
    }
    if (!sourceIds.has(claim.sourceId)) {
      issues.push({
        code: "unknown-source",
        message: "Claim references unknown source",
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
