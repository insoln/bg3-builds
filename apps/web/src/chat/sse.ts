import { parseStreamEvent, type Conversation, type StreamEvent } from "../types";

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  let terminalEventReceived = false;

  const emit = (): StreamEvent | undefined => {
    if (!dataLines.length) return;
    const payload = dataLines.join("\n");
    dataLines = [];
    try {
      const event = parseStreamEvent(JSON.parse(payload));
      if (event.type === "message_end" || event.type === "error") {
        terminalEventReceived = true;
      }
      return event;
    } catch {
      throw new Error("The server sent an invalid streaming event.");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (line === "") {
        const event = emit();
        if (event) yield event;
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (done) break;
  }
  if (buffer.startsWith("data:")) dataLines.push(buffer.slice(5).trimStart());
  const event = emit();
  if (event) yield event;
  if (!terminalEventReceived) {
    throw new Error("The build response ended before completion.");
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Non-JSON errors retain the HTTP status message.
    }
    throw new Error(message);
  }
  return ((await response.json()) as ApiSuccess<T>).data;
}

export function listConversations(): Promise<Conversation[]> {
  return apiRequest<Conversation[]>("/api/v1/conversations");
}

export function createConversation(title?: string): Promise<Conversation> {
  return apiRequest<Conversation>("/api/v1/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title ? { title } : {}),
  });
}

export async function streamChat(
  conversationId: string,
  content: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ content }),
      signal,
    },
  );
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Non-JSON errors retain the HTTP status message.
    }
    throw new Error(message);
  }
  if (!response.body) {
    throw new Error("The server did not return a response stream.");
  }
  return response.body;
}
