import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { MessageProvider } from "../src/provider.js";
import { InMemoryConversationStore } from "../src/store.js";
const provider: MessageProvider = { complete: vi.fn(async (_messages, sink) => { sink.text("Hello"); return [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Hello" }] }]; }) };
describe("API", () => {
 it("serves health and CRUD", async () => { const app=buildApp({store:new InMemoryConversationStore(),provider}); expect((await app.inject({method:"GET",url:"/health"})).statusCode).toBe(200); const created=await app.inject({method:"POST",url:"/api/v1/conversations",payload:{title:"Wizard"}}); const id=created.json().data.id; expect((await app.inject({method:"GET",url:`/api/v1/conversations/${id}`})).json().data.title).toBe("Wizard"); expect((await app.inject({method:"PATCH",url:`/api/v1/conversations/${id}`,payload:{title:"Sorcerer"}})).json().data.title).toBe("Sorcerer"); expect((await app.inject({method:"DELETE",url:`/api/v1/conversations/${id}`})).statusCode).toBe(204); await app.close(); });
 it("streams public text and persists", async () => { const store=new InMemoryConversationStore(); const c=await store.create({}); const app=buildApp({store,provider}); const response=await app.inject({method:"POST",url:`/api/v1/conversations/${c.id}/messages`,payload:{content:"Help"}}); expect(response.body).toContain('event: text_delta\ndata: {"type":"text_delta","delta":"Hello"}'); expect(response.body).toContain("event: message_end"); expect(response.body).not.toContain("tool_use"); expect((await store.get(c.id))?.messages).toHaveLength(2); await app.close(); });
});
