import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { Conversation, ConversationStore } from "./contracts.js";

function copy(conversation: Conversation): Conversation {
  return structuredClone(conversation);
}

export class InMemoryConversationStore implements ConversationStore {
  readonly #items = new Map<string, Conversation>();

  async list(): Promise<Conversation[]> {
    return [...this.#items.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(copy);
  }

  async get(id: string): Promise<Conversation | undefined> {
    const value = this.#items.get(id);
    return value && copy(value);
  }

  async create(input: { title?: string | undefined }): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = { id: randomUUID(), createdAt: now, updatedAt: now, messages: [], ...(input.title === undefined ? {} : { title: input.title }) };
    this.#items.set(conversation.id, conversation);
    return copy(conversation);
  }

  async update(id: string, update: { title: string }): Promise<Conversation | undefined> {
    const existing = this.#items.get(id);
    if (!existing) return undefined;
    const next = { ...existing, ...update, updatedAt: new Date().toISOString() };
    this.#items.set(id, next);
    return copy(next);
  }

  async delete(id: string): Promise<boolean> { return this.#items.delete(id); }

  async append(id: string, messages: Anthropic.MessageParam[]): Promise<Conversation | undefined> {
    const existing = this.#items.get(id);
    if (!existing) return undefined;
    const next = { ...existing, messages: [...existing.messages, ...structuredClone(messages)], updatedAt: new Date().toISOString() };
    this.#items.set(id, next);
    return copy(next);
  }
}
