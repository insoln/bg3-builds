import Anthropic from "@anthropic-ai/sdk";
import {
  optimizationReportSchema,
  optimizerResultSchema,
  type OptimizationReport,
} from "@bg3-builds/domain";
import { executeGameTool, gameTools, type GameDataReader } from "./tools.js";

export interface StreamSink {
  text(delta: string): void;
  status(status: "working" | "tool" | "paused"): void;
  report(report: OptimizationReport): void;
}

export interface MessageProvider {
  complete(messages: Anthropic.MessageParam[], sink: StreamSink, signal: AbortSignal): Promise<Anthropic.MessageParam[]>;
}

export interface AnthropicStreamLike {
  on(event: "text", listener: (delta: string) => void): AnthropicStreamLike;
  finalMessage(): Promise<Anthropic.Message>;
  abort(): void;
}

type CurrentMessageStreamParams = Omit<Anthropic.MessageStreamParams, "thinking"> & {
  thinking: { type: "adaptive" };
  output_config: { effort: "high" };
};

export interface AnthropicMessagesClient {
  stream(params: CurrentMessageStreamParams): AnthropicStreamLike;
}

export class AnthropicMessageProvider implements MessageProvider {
  constructor(
    private readonly messagesClient: AnthropicMessagesClient,
    private readonly reader: GameDataReader,
    private readonly maxIterations = 12,
  ) {}

  async complete(initial: Anthropic.MessageParam[], sink: StreamSink, signal: AbortSignal): Promise<Anthropic.MessageParam[]> {
    const messages = structuredClone(initial);
    const generated: Anthropic.MessageParam[] = [];

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      if (signal.aborted) throw signal.reason ?? new Error("Request cancelled");
      sink.status("working");
      const stream = this.messagesClient.stream({
        model: "combo/smart",
        max_tokens: 64_000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: "You are a BG3 build expert. For requests asking for the best, strongest, optimal, or min-max build, call optimize_build rather than claiming one from prose; state its bounded scope and limitations. Use the read-only tools for game facts and respond in readable Markdown. When first mentioning a class, subclass, race, feat, spell, item, action, or passive returned by a tool, link its display name using the exact source.url from that tool result when present. You may include a small linked icon only when the tool result contains an exact iconUrl. Never construct or guess a URL from a name, ID, or slug; use ordinary text when the tool result has no URL. Link availability must not change the factual answer. Clearly distinguish unavailable data from facts. Numerical damage, durability, probability, ranking, or optimization claims must come directly from deterministic tool output; never calculate, extrapolate, or invent them in prose. If a requested mechanic is unsupported by the tools (including surprise, guaranteed critical state, Battle Master superiority-die consumption, AoE, or Arrow of Many Targets), stop at a clear limitation and do not offer a hypothetical numerical model unless the user explicitly asks for a labeled non-game hypothetical. Never expose internal reasoning or tool payloads.",
        tools: gameTools,
        messages,
      });
      const abort = () => stream.abort();
      signal.addEventListener("abort", abort, { once: true });
      stream.on("text", (delta) => sink.text(delta));

      let response: Anthropic.Message;
      try { response = await stream.finalMessage(); }
      finally { signal.removeEventListener("abort", abort); }

      const assistant: Anthropic.MessageParam = { role: "assistant", content: response.content };
      generated.push(assistant);
      messages.push(assistant);

      if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") return generated;
      if (response.stop_reason === "refusal") {
        if (!response.content.some((block) => block.type === "text" && block.text.length > 0)) sink.text("The request was declined.");
        return generated;
      }
      if (response.stop_reason === "max_tokens") throw new Error("Claude reached the response token limit");
      if (response.stop_reason === "pause_turn") { sink.status("paused"); continue; }
      if (response.stop_reason !== "tool_use") throw new Error(`Unsupported stop reason: ${String(response.stop_reason)}`);

      const uses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
      if (uses.length === 0) throw new Error("Claude requested tools without any tool calls");
      sink.status("tool");
      const results = await Promise.all(uses.map((use) => executeGameTool(this.reader, use, signal)));
      for (const report of optimizationReports(uses, results)) sink.report(report);
      const toolTurn: Anthropic.MessageParam = { role: "user", content: results };
      generated.push(toolTurn);
      messages.push(toolTurn);
    }
    throw new Error("Claude exceeded the tool iteration limit");
  }
}

function parseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function optimizationReports(
  uses: Anthropic.ToolUseBlock[],
  results: Anthropic.ToolResultBlockParam[],
): OptimizationReport[] {
  const reports: OptimizationReport[] = [];

  for (const [index, use] of uses.entries()) {
    if (use.name !== "optimize_build") continue;
    const result = results[index];
    if (result?.is_error || typeof result?.content !== "string") continue;

    const parsed = optimizerResultSchema.safeParse(parseJson(result.content));
    if (!parsed.success) continue;

    reports.push(optimizationReportSchema.parse({
      kind: "optimization",
      title: `Act 1 ranged Nova Top ${parsed.data.bounds.returnedCandidates}: ${parsed.data.candidates[0]!.build.name}`,
      summary: `Exactly evaluated all ${parsed.data.bounds.evaluatedCandidates} legal candidates in the declared curated scope and ranked them by Nova expected damage. Opener, steady-state, and requested N-round windows are reported separately. This is not a global optimum.`,
      result: parsed.data,
      generatedAt: new Date().toISOString(),
    }));
  }

  return reports;
}

export class DeterministicFallbackProvider implements MessageProvider {
  async complete(messages: Anthropic.MessageParam[], sink: StreamSink, signal: AbortSignal): Promise<Anthropic.MessageParam[]> {
    if (signal.aborted) throw signal.reason ?? new Error("Request cancelled");
    const last = messages.at(-1);
    const input = typeof last?.content === "string" ? last.content : "your request";
    const text = `Anthropic credentials are not configured. I saved your message (${input.length} characters), but live BG3 assistance is unavailable.`;
    sink.text(text);
    return [{ role: "assistant", content: [{ type: "text", text }] }];
  }
}

export function createDefaultProvider(reader: GameDataReader): MessageProvider {
  try {
    // The zero-argument client resolves API keys, auth tokens, ant profiles, and WIF.
    const client = new Anthropic();
    // This cast isolates older locally-installed SDK declarations from the current API shape.
    return new AnthropicMessageProvider(client.messages as unknown as AnthropicMessagesClient, reader);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || (error instanceof Error && error.message.includes("Could not resolve authentication"))) {
      return new DeterministicFallbackProvider();
    }
    throw error;
  }
}
