import Anthropic from "@anthropic-ai/sdk";
import type { GameDataReader } from "./tools.js";
import { executeGameTool, gameTools } from "./tools.js";

export interface StreamSink {
  text(delta: string): void;
  status(status: "working" | "tool" | "paused"): void;
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
        model: "claude-opus-5",
        max_tokens: 64_000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: "You are a BG3 build expert. Use the read-only tools for game facts. Clearly distinguish unavailable data from facts. Never expose internal reasoning or tool payloads.",
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
      const toolTurn: Anthropic.MessageParam = { role: "user", content: results };
      generated.push(toolTurn);
      messages.push(toolTurn);
    }
    throw new Error("Claude exceeded the tool iteration limit");
  }
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
