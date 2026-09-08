import type { DataDatabase } from "../db/database.js";
import { claimSchema, type Claim } from "../types.js";
export class ClaimRepository {
  constructor(private readonly db: DataDatabase) {}
  upsert(input: Claim): Claim {
    const c = claimSchema.parse(input);
    this.db.sqlite
      .prepare(
        `INSERT INTO claims(id,entity_id,source_id,field,value_json,evidence,locator) VALUES(@id,@entityId,@sourceId,@field,@value,@evidence,@locator) ON CONFLICT(id) DO UPDATE SET entity_id=excluded.entity_id,source_id=excluded.source_id,field=excluded.field,value_json=excluded.value_json,evidence=excluded.evidence,locator=excluded.locator`,
      )
      .run({
        ...c,
        value: JSON.stringify(c.value),
        locator: c.locator ?? null,
      });
    return c;
  }
  forEntity(entityId: string): Claim[] {
    return (
      this.db.sqlite
        .prepare(
          "SELECT id,entity_id entityId,source_id sourceId,field,value_json value,evidence,locator FROM claims WHERE entity_id=? ORDER BY field,id",
        )
        .all(entityId) as Array<Omit<Claim, "value"> & { value: string }>
    ).map(function decodeClaim(row) {
      return claimSchema.parse({ ...row, value: JSON.parse(row.value) });
    });
  }
}
