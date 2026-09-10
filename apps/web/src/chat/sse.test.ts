import { describe, expect, it } from "vitest";
import { parseSSE } from "./sse";
const stream = (chunks: string[]) => new ReadableStream<Uint8Array>({ start(controller) { const encoder = new TextEncoder(); chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk))); controller.close(); } });
async function consume(chunks: string[]): Promise<void> { for await (const event of parseSSE(stream(chunks))) void event; }
describe("parseSSE", () => {
 it("parses recorded events split across chunks", async () => { const events = []; for await (const event of parseSSE(stream(['data: {"type":"message_start","messageId":"a1"}\n\ndata: {"type":"text_', 'delta","delta":"Hello"}\n\ndata: {"type":"message_end"}\n\n']))) events.push(event); expect(events).toEqual([{type:"message_start",messageId:"a1"},{type:"text_delta",delta:"Hello"},{type:"message_end"}]); });
 it("supports multiline data", async () => { const events=[]; for await (const event of parseSSE(stream(['data: {"type":"text_delta",\ndata: "delta":"line"}\n\ndata: {"type":"message_end"}\n\n']))) events.push(event); expect(events[0]).toEqual({type:"text_delta",delta:"line"}); });
 it("rejects malformed JSON", async () => { const consume=async()=>{for await(const event of parseSSE(stream(["data: nope\n\n"]))) void event}; await expect(consume()).rejects.toThrow("invalid streaming event"); });
 it("rejects a clean EOF without a terminal event", async () => { const consume=async()=>{for await(const event of parseSSE(stream(['data: {"type":"text_delta","delta":"partial"}\n\n']))) void event}; await expect(consume()).rejects.toThrow("ended before completion"); });
 it.each([
  ['a tool status without a valid status', '{"type":"tool_status","tool":{"id":"rules","label":"Check rules","status":"invalid"}}'],
  ['an error without a message', '{"type":"error","error":{"code":"STREAM_ERROR"}}'],
 ])("rejects %s", async (_description, event) => {
  const consume = async () => { for await (const parsed of parseSSE(stream([`data: ${event}\n\n`]))) void parsed; };
  await expect(consume()).rejects.toThrow("invalid streaming event");
 });
});
