import type { DataDatabase } from "../db/database.js";
import { sourceRecordSchema, type SourceRecord } from "../types.js";
function decode(row: unknown): SourceRecord {
  const r = row as Record<string, unknown>;
  return sourceRecordSchema.parse({
    ...r,
    ...(r["url"] === null ? { url: undefined } : {}),
    ...(r["contentHash"] === null ? { contentHash: undefined } : {}),
  });
}
export class SourceRepository {
  constructor(private readonly db: DataDatabase) {}
  upsert(input: SourceRecord): SourceRecord {
    const s = sourceRecordSchema.parse(input);
    this.db.sqlite
      .prepare(
        `INSERT INTO sources(id,name,kind,game_version,url,retrieved_at,license,content_hash) VALUES(@id,@name,@kind,@gameVersion,@url,@retrievedAt,@license,@contentHash) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,game_version=excluded.game_version,url=excluded.url,retrieved_at=excluded.retrieved_at,license=excluded.license,content_hash=excluded.content_hash`,
      )
      .run({ ...s, url: s.url ?? null, contentHash: s.contentHash ?? null });
    return s;
  }
  get(id: string): SourceRecord | undefined {
    const r = this.db.sqlite
      .prepare(
        "SELECT id,name,kind,game_version gameVersion,url,retrieved_at retrievedAt,license,content_hash contentHash FROM sources WHERE id=?",
      )
      .get(id);
    return r ? decode(r) : undefined;
  }
  list(): SourceRecord[] {
    return this.db.sqlite
      .prepare(
        "SELECT id,name,kind,game_version gameVersion,url,retrieved_at retrievedAt,license,content_hash contentHash FROM sources ORDER BY id",
      )
      .all()
      .map(decode);
  }
}
