import type Anthropic from "@anthropic-ai/sdk";
import type { OptimizationReport } from "@bg3-builds/domain";
import { z } from "zod";

export const conversationIdSchema = z.string().uuid();
export const createConversationSchema = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict();
export const updateConversationSchema = z.object({ title: z.string().trim().min(1).max(120) }).strict();
export const sendMessageSchema = z.object({ content: z.string().trim().min(1).max(20_000) }).strict();

export interface PersistedReport {
  assistantMessageIndex: number;
  report: OptimizationReport;
}

export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: Anthropic.MessageParam[];
  reports: PersistedReport[];
}

export interface ConversationStore {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | undefined>;
  create(input: { title?: string | undefined }): Promise<Conversation>;
  update(id: string, update: { title: string }): Promise<Conversation | undefined>;
  delete(id: string): Promise<boolean>;
  append(id: string, messages: Anthropic.MessageParam[]): Promise<Conversation | undefined>;
  appendReports(id: string, reports: PersistedReport[]): Promise<Conversation | undefined>;
}

export type PublicMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  report?: OptimizationReport;
};
export type PublicConversation = Omit<Conversation, "messages"> & {
  messages: PublicMessage[];
};

export function toPublicConversation(conversation: Conversation): PublicConversation {
  return {
    ...conversation,
    messages: conversation.messages.flatMap((message, index): PublicMessage[] => {
      const id = `${conversation.id}:${index}`;
      // Only the visible half of the transcript reaches the UI; system turns and
      // tool-result turns (which carry no text blocks) are dropped here.
      const role = message.role;
      if (role !== "user" && role !== "assistant") return [];
      if (typeof message.content === "string") {
        return [{ id, role, text: message.content }];
      }
      const text = message.content
        .filter((block): block is Anthropic.TextBlockParam => block.type === "text")
        .map((block) => block.text)
        .join("");
      const report = conversation.reports.find((attachment) => attachment.assistantMessageIndex === index)?.report;
      return text || report !== undefined
        ? [{ id, role, text, ...(report === undefined ? {} : { report }) }]
        : [];
    }),
  };
}
