import type Anthropic from "@anthropic-ai/sdk";
import { InMemoryEngineRepository, optimizeBuild } from "@bg3-builds/domain";
import { fixtureEntities } from "@bg3-builds/data";
import { describe, expect, it, vi } from "vitest";
import { AnthropicMessageProvider, type AnthropicMessagesClient, type AnthropicStreamLike } from "../src/provider.js";
import type { GameDataReader } from "../src/tools.js";
function msg(reason: Anthropic.Message["stop_reason"], content: Anthropic.Message["content"]): Anthropic.Message { return { id:"m",type:"message",role:"assistant",model:"claude-opus-5",content,stop_reason:reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1} } as Anthropic.Message; }
function fake(responses: Anthropic.Message[]): AnthropicMessagesClient { return { stream: vi.fn(() => { const next=responses.shift(); if(!next) throw Error("No response"); return { on(_event,listener){ for(const b of next.content) if(b.type==="text") listener(b.text); return this; }, finalMessage:async()=>next, abort:vi.fn() } satisfies AnthropicStreamLike; }) }; }
const reader: GameDataReader={searchEntities:vi.fn(async()=>[]),getEntity:vi.fn(async()=>undefined),validateBuild:vi.fn(),compareBuilds:vi.fn(),optimizeBuild:vi.fn()}; const sink=()=>({text:vi.fn(),status:vi.fn(),report:vi.fn()});
describe("provider",()=>{
 it("streams text",async()=>{const out=sink(); await new AnthropicMessageProvider(fake([msg("end_turn",[{type:"text",text:"Done",citations:null}])]),reader).complete([{role:"user",content:"Hi"}],out,new AbortController().signal); expect(out.text).toHaveBeenCalledWith("Done");});
 it("requires exact tool-provided wiki links",async()=>{const client=fake([msg("end_turn",[])]); await new AnthropicMessageProvider(client,reader).complete([{role:"user",content:"Hi"}],sink(),new AbortController().signal); const system=vi.mocked(client.stream).mock.calls[0]?.[0].system; expect(system).toContain("exact source.url"); expect(system).toContain("Never construct or guess a URL"); expect(system).toContain("exact iconUrl");});
 it("returns parallel results in one user turn",async()=>{const uses=[{type:"tool_use",id:"a",name:"search_entities",input:{limit:2}},{type:"tool_use",id:"b",name:"get_entity",input:{id:"x"}}] as Anthropic.Message["content"]; const result=await new AnthropicMessageProvider(fake([msg("tool_use",uses),msg("end_turn",[])]),reader).complete([{role:"user",content:"Hi"}],sink(),new AbortController().signal); expect(result[1]?.role).toBe("user"); expect(Array.isArray(result[1]?.content)&&result[1].content).toHaveLength(2);});
 it("emits only valid successful optimizer reports",async()=>{
  const optimizerResult=optimizeBuild(new InMemoryEngineRepository(fixtureEntities),{gameVersion:"Patch 8",level:5,availableAct:1,topK:1});
  const optimizingReader={...reader,optimizeBuild:vi.fn(async()=>optimizerResult)};
  const use={type:"tool_use",id:"opt",name:"optimize_build",input:{request:{gameVersion:"Patch 8",level:5,availableAct:1}}} as Anthropic.ToolUseBlock;
  const out=sink();
  await new AnthropicMessageProvider(fake([msg("tool_use",[use]),msg("end_turn",[])]),optimizingReader).complete([{role:"user",content:"Optimize"}],out,new AbortController().signal);
  expect(out.report).toHaveBeenCalledTimes(1);
  expect(out.report).toHaveBeenCalledWith(expect.objectContaining({kind:"optimization",result:optimizerResult}));
  const invalidOut=sink();
  const invalidReader={...reader,optimizeBuild:vi.fn(async()=>({invalid:true}))};
  await new AnthropicMessageProvider(fake([msg("tool_use",[use]),msg("end_turn",[])]),invalidReader as GameDataReader).complete([{role:"user",content:"Optimize"}],invalidOut,new AbortController().signal);
  expect(invalidOut.report).not.toHaveBeenCalled();
 });
 it("resumes pause",async()=>{await expect(new AnthropicMessageProvider(fake([msg("pause_turn",[]),msg("end_turn",[])]),reader).complete([{role:"user",content:"Hi"}],sink(),new AbortController().signal)).resolves.toBeDefined();});
 it("handles refusal",async()=>{await expect(new AnthropicMessageProvider(fake([msg("refusal",[])]),reader).complete([{role:"user",content:"Hi"}],sink(),new AbortController().signal)).resolves.toBeDefined();});
 it("reports max tokens",async()=>{await expect(new AnthropicMessageProvider(fake([msg("max_tokens",[])]),reader).complete([{role:"user",content:"Hi"}],sink(),new AbortController().signal)).rejects.toThrow("token limit");});
 it("honors cancellation",async()=>{const c=new AbortController();c.abort();await expect(new AnthropicMessageProvider(fake([]),reader).complete([{role:"user",content:"Hi"}],sink(),c.signal)).rejects.toBeDefined();});
});
