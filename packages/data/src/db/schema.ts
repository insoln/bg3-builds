import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const sources = sqliteTable("sources", {
  id: text().primaryKey(),
  name: text().notNull(),
  kind: text().notNull(),
  gameVersion: text("game_version").notNull(),
  url: text(),
  retrievedAt: text("retrieved_at").notNull(),
  license: text().notNull(),
  contentHash: text("content_hash"),
});
export const entities = sqliteTable(
  "entities",
  {
    id: text().primaryKey(),
    slug: text().notNull(),
    kind: text().notNull(),
    name: text().notNull(),
    description: text(),
    tagsJson: text("tags_json").notNull(),
    sourceJson: text("source_json").notNull(),
    iconUrl: text("icon_url"),
    metadataJson: text("metadata_json"),
    gameVersion: text("game_version").notNull(),
  },
  (t) => [
    uniqueIndex("entities_slug_kind_version").on(t.slug, t.kind, t.gameVersion),
  ],
);
export const claims = sqliteTable("claims", {
  id: text().primaryKey(),
  entityId: text("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  field: text().notNull(),
  valueJson: text("value_json").notNull(),
  evidence: text().notNull(),
  locator: text(),
});
export const conversations = sqliteTable("conversations", {
  id: text().primaryKey(),
  title: text(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const conversationMessages = sqliteTable("conversation_messages", {
  id: text().primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  ordinal: integer().notNull(),
  role: text().notNull(),
  content: text().notNull(),
  createdAt: text("created_at").notNull(),
});
