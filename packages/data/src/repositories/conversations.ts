import type { DataDatabase } from "../db/database.js";
import {
  conversationSchema,
  messageSchema,
  type Conversation,
  type ConversationMessage,
} from "../types.js";
export class ConversationRepository {
  constructor(private readonly db: DataDatabase) {}
  upsert(input: Conversation): Conversation {
    const c = conversationSchema.parse(input);
    this.db.sqlite
      .prepare(
        `INSERT INTO conversations(id,title,created_at,updated_at) VALUES(@id,@title,@createdAt,@updatedAt) ON CONFLICT(id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at`,
      )
      .run({ ...c, title: c.title ?? null });
    return c;
  }
  append(input: ConversationMessage): ConversationMessage {
    const m = messageSchema.parse(input);
    this.db.sqlite
      .prepare(
        `INSERT INTO conversation_messages(id,conversation_id,ordinal,role,content,created_at) VALUES(@id,@conversationId,@ordinal,@role,@content,@createdAt) ON CONFLICT(id) DO UPDATE SET content=excluded.content,role=excluded.role,created_at=excluded.created_at`,
      )
      .run(m);
    return m;
  }
  messages(id: string): ConversationMessage[] {
    return this.db.sqlite
      .prepare(
        "SELECT id,conversation_id conversationId,ordinal,role,content,created_at createdAt FROM conversation_messages WHERE conversation_id=? ORDER BY ordinal",
      )
      .all(id)
      .map(function decodeMessage(row) {
        return messageSchema.parse(row);
      });
  }
}
