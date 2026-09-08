import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export interface DataDatabase {
  sqlite: Database.Database;
  orm: BetterSQLite3Database<typeof schema>;
  close(): void;
}

export function openDatabase(filename = ":memory:"): DataDatabase {
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");

  if (filename !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }

  const migrationUrl = new URL("../../migrations/0001_initial.sql", import.meta.url);
  sqlite.exec(readFileSync(fileURLToPath(migrationUrl), "utf8"));

  const entityColumns = sqlite.pragma("table_info(entities)") as Array<{ name: string }>;
  if (!entityColumns.some(({ name }) => name === "icon_url")) {
    sqlite.exec("ALTER TABLE entities ADD COLUMN icon_url TEXT");
  }

  return {
    sqlite,
    orm: drizzle(sqlite, { schema }),
    close() {
      sqlite.close();
    },
  };
}
