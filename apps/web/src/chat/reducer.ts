import type { ChatMessage, StreamEvent } from "../types";

export interface StreamActivity {
  messageId: string;
  startedAt: number;
  lastEventAt: number;
  endedAt?: number;
}

export interface ChatState {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  activeMessageId?: string;
  streamActivity?: StreamActivity;
}

export type ChatAction =
  | { type: "submit"; user: ChatMessage; assistantId: string; now: number }
  | { type: "event"; event: StreamEvent; receivedAt: number }
  | { type: "stopped"; now: number }
  | { type: "reset"; messages: ChatMessage[] };

export const initialChatState: ChatState = { messages: [], status: "idle" };

function finishTools(
  tools: NonNullable<ChatMessage["tools"]>,
  status: "complete" | "error" | "stopped",
): NonNullable<ChatMessage["tools"]> {
  if (!tools.some((tool) => tool.status === "queued" || tool.status === "running")) {
    return tools;
  }
  return tools.map((tool) =>
    tool.status === "queued" || tool.status === "running"
      ? { ...tool, status }
      : tool,
  );
}

function finishActiveTools(
  messages: ChatMessage[],
  activeMessageId: string | undefined,
  status: "complete" | "error" | "stopped",
): ChatMessage[] {
  if (!activeMessageId) return messages;
  return messages.map((message) => {
    if (message.id !== activeMessageId) return message;
    const currentTools = message.tools;
    if (currentTools === undefined) return message;
    const tools = finishTools(currentTools, status);
    return tools === currentTools ? message : { ...message, tools };
  });
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "reset") return { messages: action.messages, status: "idle" };
  if (action.type === "submit") return {
    messages: [...state.messages, action.user, { id: action.assistantId, role: "assistant", text: "", tools: [] }],
    status: "streaming",
    activeMessageId: action.assistantId,
    streamActivity: {
      messageId: action.assistantId,
      startedAt: action.now,
      lastEventAt: action.now,
    },
  };
  if (action.type === "stopped") return {
    messages: finishActiveTools(state.messages, state.activeMessageId, "stopped"),
    status: "idle",
    ...(state.streamActivity === undefined
      ? {}
      : { streamActivity: { ...state.streamActivity, endedAt: action.now } }),
  };
  const event = action.event;
  const streamActivity = state.streamActivity === undefined
    ? undefined
    : { ...state.streamActivity, lastEventAt: action.receivedAt };
  if (event.type === "message_start") {
    const pendingId = state.activeMessageId;
    const messages = pendingId
      ? state.messages.map((message) => message.id === pendingId ? { ...message, id: event.messageId } : message)
      : [...state.messages, { id: event.messageId, role: "assistant" as const, text: "", tools: [] }];
    return {
      ...state,
      messages,
      activeMessageId: event.messageId,
      status: "streaming",
      ...(streamActivity === undefined
        ? {}
        : { streamActivity: { ...streamActivity, messageId: event.messageId } }),
    };
  }
  if (event.type === "message_end") return {
    messages: finishActiveTools(state.messages, state.activeMessageId, "complete"),
    status: "idle",
    ...(streamActivity === undefined
      ? {}
      : { streamActivity: { ...streamActivity, endedAt: action.receivedAt } }),
  };
  const activeId = state.activeMessageId;
  if (!activeId) return state;
  const messages = state.messages.map((message): ChatMessage => {
    if (message.id !== activeId) return message;
    if (event.type === "text_delta") return { ...message, text: message.text + event.delta };
    if (event.type === "report") return { ...message, report: event.report };
    if (event.type === "error") {
      const tools = message.tools === undefined
        ? undefined
        : finishTools(message.tools, "error");
      return {
        ...message,
        error: event.error.message,
        ...(tools === undefined ? {} : { tools }),
      };
    }
    if (event.type === "tool_status") {
      const tools = message.tools ?? [];
      const index = tools.findIndex(tool => tool.id === event.tool.id);
      return { ...message, tools: index < 0 ? [...tools, event.tool] : tools.map((tool, i) => i === index ? event.tool : tool) };
    }
    return message;
  });
  if (event.type === "error") return {
    messages,
    status: "error",
    ...(streamActivity === undefined
      ? {}
      : { streamActivity: { ...streamActivity, endedAt: action.receivedAt } }),
  };
  return {
    ...state,
    messages,
    ...(streamActivity === undefined ? {} : { streamActivity }),
  };
}
