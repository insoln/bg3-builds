import { describe, expect, it, vi } from "vitest";
import { optimizationReportSchema, optimizeBuild, InMemoryEngineRepository } from "@bg3-builds/domain";
import { fixtureEntities } from "@bg3-builds/data";
import { attachReports, buildApp } from "../src/app.js";
import type { MessageProvider } from "../src/provider.js";
import { InMemoryConversationStore } from "../src/store.js";
const provider: MessageProvider = { complete: vi.fn(async (_messages, sink) => { sink.text("Hello"); return [{ role: "assistant" as const, content: [{ type: "text" as const, text: "Hello" }] }]; }) };
const report = optimizationReportSchema.parse({
 kind: "optimization", title: "Act 1 ranged Top 1", summary: "Bounded result.",
 result: optimizeBuild(new InMemoryEngineRepository(fixtureEntities), { gameVersion: "Patch 8", level: 5, availableAct: 1, topK: 1, combat: { mode: "ranged", targetInitiativeModifier: 0, targetDexterityScore: 10, equalTotalAndDexterity: "target-first", surprisedDeniedTurnCountsAsTaken: true } }),
 generatedAt: "2026-09-08T00:00:00.000Z",
});
describe("API", () => {
 it("attaches reports to the final generated assistant message", () => {
  const reports = [{ kind: "optimization" }] as never[];
  const generated = [
   { role: "assistant" as const, content: [] },
   { role: "user" as const, content: [] },
   { role: "assistant" as const, content: [] },
  ];
  expect(attachReports(reports, 4, generated)).toEqual([
   { assistantMessageIndex: 6, report: reports[0] },
  ]);
 });
 it("serves health and CRUD", async () => { const app=buildApp({store:new InMemoryConversationStore(),provider}); expect((await app.inject({method:"GET",url:"/health"})).statusCode).toBe(200); const created=await app.inject({method:"POST",url:"/api/v1/conversations",payload:{title:"Wizard"}}); const id=created.json().data.id; expect((await app.inject({method:"GET",url:`/api/v1/conversations/${id}`})).json().data.title).toBe("Wizard"); expect((await app.inject({method:"PATCH",url:`/api/v1/conversations/${id}`,payload:{title:"Sorcerer"}})).json().data.title).toBe("Sorcerer"); expect((await app.inject({method:"DELETE",url:`/api/v1/conversations/${id}`})).statusCode).toBe(204); await app.close(); });
 it("streams public text and persists", async () => { const store=new InMemoryConversationStore(); const c=await store.create({}); const app=buildApp({store,provider}); const response=await app.inject({method:"POST",url:`/api/v1/conversations/${c.id}/messages`,payload:{content:"Help"}}); expect(response.body).toContain('event: text_delta\ndata: {"type":"text_delta","delta":"Hello"}'); expect(response.body).toContain('"status":"complete"'); expect(response.body.indexOf('"status":"complete"')).toBeLessThan(response.body.indexOf("event: message_end")); expect(response.body).not.toContain("tool_use"); expect((await store.get(c.id))?.messages).toHaveLength(2); await app.close(); });
 it("persists, streams, and reloads a report on its originating assistant turn", async () => {
  const store = new InMemoryConversationStore();
  const conversation = await store.create({});
  const reportingProvider: MessageProvider = { complete: vi.fn(async (_messages, sink) => {
   sink.report(report);
   return [
    { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "tool", name: "optimize_build", input: {} }] },
    { role: "user" as const, content: [{ type: "tool_result" as const, tool_use_id: "tool", content: "{}" }] },
    { role: "assistant" as const, content: [{ type: "text" as const, text: "Best bounded build" }] },
   ];
  }) };
  const app = buildApp({ store, provider: reportingProvider });
  const response = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.id}/messages`, payload: { content: "Optimize" } });
  expect(response.body.indexOf("event: report")).toBeGreaterThan(-1);
  expect(response.body.indexOf("event: report")).toBeLessThan(response.body.indexOf("event: message_end"));
  expect((await store.get(conversation.id))?.reports).toEqual([{ assistantMessageIndex: 3, report }]);
  const reloaded = (await app.inject({ method: "GET", url: `/api/v1/conversations/${conversation.id}` })).json().data;
  expect(reloaded.messages).toEqual([
   expect.objectContaining({ role: "user", text: "Optimize" }),
   expect.objectContaining({ role: "assistant", text: "Best bounded build", report }),
  ]);
  await app.close();
 });
 it("reloads a persisted report even when its assistant turn has no text", async () => {
  const store = new InMemoryConversationStore();
  const conversation = await store.create({});
  const reportingProvider: MessageProvider = { complete: vi.fn(async (_messages, sink) => {
   sink.report(report);
   return [{ role: "assistant" as const, content: [] }];
  }) };
  const app = buildApp({ store, provider: reportingProvider });
  await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.id}/messages`, payload: { content: "Optimize" } });
  const reloaded = (await app.inject({ method: "GET", url: `/api/v1/conversations/${conversation.id}` })).json().data;
  expect(reloaded.messages.at(-1)).toEqual(expect.objectContaining({ role: "assistant", text: "", report }));
  await app.close();
 });
 it("does not stream an unpersisted report when generation fails", async () => {
  const store = new InMemoryConversationStore();
  const conversation = await store.create({});
  const failingProvider: MessageProvider = { complete: vi.fn(async (_messages, sink) => {
   sink.report({ kind: "optimization" } as never);
   throw new Error("later model iteration failed");
  }) };
  const app = buildApp({ store, provider: failingProvider });
  const response = await app.inject({ method: "POST", url: `/api/v1/conversations/${conversation.id}/messages`, payload: { content: "Optimize" } });
  expect(response.body).toContain("event: error");
  expect(response.body).toContain('"status":"error"');
  expect(response.body.indexOf('"status":"error"')).toBeLessThan(response.body.indexOf("event: error"));
  expect(response.body).not.toContain("event: report");
  expect((await store.get(conversation.id))?.reports).toEqual([]);
  await app.close();
 });
});
