import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { ZodError } from "zod";
import {
  conversationIdSchema,
  createConversationSchema,
  sendMessageSchema,
  toPublicConversation,
  updateConversationSchema,
  type ConversationStore,
  type PersistedReport,
} from "./contracts.js";
import type { OptimizationReport } from "@bg3-builds/domain";
import type { MessageProvider, StreamSink } from "./provider.js";

export interface AppDependencies {
  store: ConversationStore;
  provider: MessageProvider;
}

const ok = <T>(data: T) => ({ ok: true as const, data });
const error = (code: string, message: string) => ({
  ok: false as const,
  error: { code, message },
});

type StreamChannel = StreamSink & {
  start(messageId: string): void;
  end(): void;
  fail(message: string): void;
};

export function attachReports(
  reports: OptimizationReport[],
  messageOffset: number,
  generated: Anthropic.MessageParam[],
): PersistedReport[] {
  const report = reports.at(-1);
  if (report === undefined) return [];

  const generatedAssistantIndex = generated.reduce(
    (index, message, currentIndex) => message.role === "assistant" ? currentIndex : index,
    -1,
  );
  if (generatedAssistantIndex < 0) return [];

  return [{
    assistantMessageIndex: messageOffset + generatedAssistantIndex,
    report,
  }];
}

function sse(reply: FastifyReply): StreamChannel {
  reply.hijack();
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const send = (event: { type: string } & Record<string, unknown>) =>
    reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  const sendBuildAnalysisStatus = (
    status: "queued" | "running" | "complete" | "error",
    detail?: string,
  ) => send({
    type: "tool_status",
    tool: {
      id: "build-analysis",
      label: "Build analysis",
      status,
      ...(detail === undefined ? {} : { detail }),
    },
  });

  return {
    start: (messageId) => send({ type: "message_start", messageId }),
    text: (delta) => send({ type: "text_delta", delta }),
    report: (report) => send({ type: "report", report }),
    status: (status) => sendBuildAnalysisStatus(
      status === "tool" ? "running" : "queued",
    ),
    end: () => {
      sendBuildAnalysisStatus("complete");
      send({ type: "message_end" });
      reply.raw.end();
    },
    fail: (message) => {
      sendBuildAnalysisStatus("error", message);
      send({ type: "error", error: { code: "STREAM_ERROR", message } });
      reply.raw.end();
    },
  };
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });
  const conversationTails = new Map<string, Promise<void>>();

  const serialize = async <T>(id: string, task: () => Promise<T>): Promise<T> => {
    const previous = conversationTails.get(id) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    conversationTails.set(id, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (conversationTails.get(id) === tail) conversationTails.delete(id);
    }
  };

  app.setErrorHandler((cause, _request, reply) =>
    cause instanceof ZodError
      ? reply.status(400).send(error("VALIDATION_ERROR", "Request validation failed"))
      : reply.status(500).send(error("INTERNAL_ERROR", "Internal server error")),
  );

  app.get("/health", async () => ok({ status: "ok" }));
  app.get("/api/v1/conversations", async () =>
    ok((await dependencies.store.list()).map(toPublicConversation)),
  );
  app.post("/api/v1/conversations", async (request, reply) =>
    reply
      .status(201)
      .send(
        ok(
          toPublicConversation(
            await dependencies.store.create(
              createConversationSchema.parse(request.body ?? {}),
            ),
          ),
        ),
      ),
  );
  app.get("/api/v1/conversations/:id", async (request, reply) => {
    const id = conversationIdSchema.parse((request.params as { id: unknown }).id);
    const item = await dependencies.store.get(id);
    return item
      ? ok(toPublicConversation(item))
      : reply.status(404).send(error("NOT_FOUND", "Conversation not found"));
  });
  app.patch("/api/v1/conversations/:id", async (request, reply) => {
    const id = conversationIdSchema.parse((request.params as { id: unknown }).id);
    const item = await dependencies.store.update(
      id,
      updateConversationSchema.parse(request.body),
    );
    return item
      ? ok(toPublicConversation(item))
      : reply.status(404).send(error("NOT_FOUND", "Conversation not found"));
  });
  app.delete("/api/v1/conversations/:id", async (request, reply) =>
    (await dependencies.store.delete(
      conversationIdSchema.parse((request.params as { id: unknown }).id),
    ))
      ? reply.status(204).send()
      : reply.status(404).send(error("NOT_FOUND", "Conversation not found")),
  );
  app.post("/api/v1/conversations/:id/messages", async (request, reply) => {
    const id = conversationIdSchema.parse((request.params as { id: unknown }).id);
    const input = sendMessageSchema.parse(request.body);
    return serialize(id, async () => {
      const conversation = await dependencies.store.get(id);
      if (!conversation) {
        return reply
          .status(404)
          .send(error("NOT_FOUND", "Conversation not found"));
      }

      const userMessage = { role: "user" as const, content: input.content };
      await dependencies.store.append(id, [userMessage]);
      const channel = sse(reply);
      const pendingReports: OptimizationReport[] = [];
      const providerSink: StreamSink = {
        text: channel.text,
        status: channel.status,
        report: (report) => pendingReports.push(report),
      };
      channel.start(randomUUID());
      const controller = new AbortController();
      const cancel = () => controller.abort(new Error("Client disconnected"));
      request.raw.once("aborted", cancel);
      reply.raw.once("close", cancel);
      try {
        const generated = await dependencies.provider.complete(
          [...conversation.messages, userMessage],
          providerSink,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          await dependencies.store.append(id, generated);
          const reports = attachReports(pendingReports, conversation.messages.length + 1, generated);
          if (reports.length > 0) await dependencies.store.appendReports(id, reports);
          for (const { report } of reports) channel.report(report);
          channel.end();
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          const message = cause instanceof Error ? cause.message : "Generation failed";
          channel.fail(message);
        }
      } finally {
        request.raw.off("aborted", cancel);
        reply.raw.off("close", cancel);
      }
    });
  });

  return app;
}
