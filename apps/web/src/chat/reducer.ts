import type { ChatMessage, StreamEvent } from "../types";

export interface ChatState { messages: ChatMessage[]; status: "idle" | "streaming" | "error"; activeMessageId?: string }
export type ChatAction = { type: "submit"; user: ChatMessage; assistantId: string } | { type: "event"; event: StreamEvent } | { type: "stopped" } | { type: "reset"; messages: ChatMessage[] };

export const initialChatState: ChatState = { messages: [], status: "idle" };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "reset") return { messages: action.messages, status: "idle" };
  if (action.type === "submit") return {
    messages: [...state.messages, action.user, { id: action.assistantId, role: "assistant", text: "", tools: [] }],
    status: "streaming", activeMessageId: action.assistantId,
  };
  if (action.type === "stopped") return { messages: state.messages, status: "idle" };
  const event = action.event;
  if (event.type === "message_start") {
    const pendingId = state.activeMessageId;
    const messages = pendingId
      ? state.messages.map((message) => message.id === pendingId ? { ...message, id: event.messageId } : message)
      : [...state.messages, { id: event.messageId, role: "assistant" as const, text: "", tools: [] }];
    return { ...state, messages, activeMessageId: event.messageId, status: "streaming" };
  }
  if (event.type === "message_end") return { messages: state.messages, status: "idle" };
  const activeId = state.activeMessageId;
  if (!activeId) return state;
  const messages = state.messages.map((message): ChatMessage => {
    if (message.id !== activeId) return message;
    if (event.type === "text_delta") return { ...message, text: message.text + event.delta };
    if (event.type === "report") return { ...message, report: event.report };
    if (event.type === "error") return { ...message, error: event.error.message };
    if (event.type === "tool_status") {
      const tools = message.tools ?? [];
      const index = tools.findIndex(tool => tool.id === event.tool.id);
      return { ...message, tools: index < 0 ? [...tools, event.tool] : tools.map((tool, i) => i === index ? event.tool : tool) };
    }
    return message;
  });
  if (event.type === "error") return { messages, status: "error" };
  return { ...state, messages };
}
