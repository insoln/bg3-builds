import type { GameEntity } from "@bg3-builds/domain";
import { gameEntitySchema } from "@bg3-builds/domain";
import type { DataDatabase } from "../db/database.js";
type EntityRow = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  description: string | null;
  tags_json: string;
  source_json: string;
  icon_url: string | null;
  metadata_json: string | null;
};
function decode(row: EntityRow): GameEntity {
  const metadata = row.metadata_json;
  return gameEntitySchema.parse({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    text: {
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
    },
    tags: JSON.parse(row.tags_json),
    source: JSON.parse(row.source_json),
    ...(row.icon_url ? { iconUrl: row.icon_url } : {}),
    ...(metadata ? { metadata: JSON.parse(metadata) } : {}),
  });
}
export class EntityRepository {
  constructor(private readonly db: DataDatabase) {}
  upsert(value: GameEntity): GameEntity {
    const e = gameEntitySchema.parse(value);
    this.db.sqlite
      .prepare(
        `INSERT INTO entities(id,slug,kind,name,description,tags_json,source_json,icon_url,metadata_json,game_version) VALUES(@id,@slug,@kind,@name,@description,@tags,@source,@iconUrl,@metadata,@version) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,kind=excluded.kind,name=excluded.name,description=excluded.description,tags_json=excluded.tags_json,source_json=excluded.source_json,icon_url=excluded.icon_url,metadata_json=excluded.metadata_json,game_version=excluded.game_version,updated_at=CURRENT_TIMESTAMP`,
      )
      .run({
        id: e.id,
        slug: e.slug,
        kind: e.kind,
        name: e.text.name,
        description: e.text.description ?? null,
        tags: JSON.stringify(e.tags),
        source: JSON.stringify(e.source),
        iconUrl: e.iconUrl ?? null,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
        version: e.source.gameVersion,
      });
    return e;
  }
  get(id: string): GameEntity | undefined {
    const r = this.db.sqlite
      .prepare(
        "SELECT id,slug,kind,name,description,tags_json,source_json,icon_url,metadata_json FROM entities WHERE id=?",
      )
      .get(id) as EntityRow | undefined;
    return r ? decode(r) : undefined;
  }
  list(): GameEntity[] {
    return (
      this.db.sqlite
        .prepare(
          "SELECT id,slug,kind,name,description,tags_json,source_json,icon_url,metadata_json FROM entities ORDER BY name,id",
        )
        .all() as EntityRow[]
    ).map(decode);
  }
  search(query: string, limit = 25): GameEntity[] {
    if (!query.trim()) return [];
    const rows = this.db.sqlite
      .prepare(
        `SELECT e.id,e.slug,e.kind,e.name,e.description,e.tags_json,e.source_json,e.icon_url,e.metadata_json FROM entity_fts f JOIN entities e ON e.rowid=f.rowid WHERE entity_fts MATCH ? ORDER BY bm25(entity_fts),e.name LIMIT ?`,
      )
      .all(query, Math.max(1, Math.min(100, limit))) as EntityRow[];
    return rows.map(decode);
  }
}
