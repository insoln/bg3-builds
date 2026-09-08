import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { chatReducer, initialChatState } from "./chat/reducer";
import { createConversation, listConversations, parseSSE, streamChat } from "./chat/sse";
import { MessageText } from "./components/AssistantMarkdown";
import { OptimizationReportCard } from "./components/OptimizationReport";
import { ToolActivity } from "./components/ToolActivity";
import type { ChatMessage, Conversation } from "./types";

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const conversationTitle = (conversation: Conversation | undefined) =>
  conversation?.title ?? "Untitled build";

function relativeTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const active = conversations.find((conversation) => conversation.id === activeId);
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [draft, setDraft] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const abortRef = useRef<AbortController | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => menuRef.current?.focus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const existing = await listConversations();
        const conversation = existing[0] ?? (await createConversation());
        if (cancelled) return;
        setConversations(existing.length ? existing : [conversation]);
        setActiveId(conversation.id);
        dispatch({ type: "reset", messages: conversation.messages });
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Could not reach the build service.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.messages]);

  useEffect(() => {
    if (!activeId) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeId
          ? {
              ...conversation,
              messages: state.messages,
              updatedAt: new Date().toISOString(),
            }
          : conversation,
      ),
    );
  }, [activeId, state.messages]);

  useEffect(() => {
    if (!sidebarOpen) return;
    sidebarRef.current?.focus();
    const handleDrawerKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
      if (event.key !== "Tab") return;
      const controls = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleDrawerKeys);
    return () => document.removeEventListener("keydown", handleDrawerKeys);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => () => abortRef.current?.abort(), []);
  const title = useMemo(() => conversationTitle(active), [active]);

  const selectConversation = (conversation: Conversation) => {
    abortRef.current?.abort();
    setActiveId(conversation.id);
    closeSidebar();
    dispatch({ type: "reset", messages: conversation.messages });
  };

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || !activeId || state.status === "streaming") return;
    const user: ChatMessage = { id: newId(), role: "user", text: trimmed };
    const assistantId = newId();
    setDraft("");
    setLastPrompt(trimmed);
    dispatch({ type: "submit", user, assistantId });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const stream = await streamChat(activeId, trimmed, controller.signal);
      for await (const event of parseSSE(stream)) dispatch({ type: "event", event });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: "event",
        event: {
          type: "error",
          error: {
            message:
              error instanceof Error ? error.message : "The build request failed.",
          },
        },
      });
    }
  }

  function stop() {
    abortRef.current?.abort();
    dispatch({ type: "stopped" });
  }

  async function newConversation() {
    abortRef.current?.abort();
    setSidebarOpen(false);
    try {
      const conversation = await createConversation();
      setConversations((current) => [conversation, ...current]);
      setActiveId(conversation.id);
      dispatch({ type: "reset", messages: [] });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not start a new conversation.",
      );
    }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#composer">Skip to message</a>
    <aside ref={sidebarRef} className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`} aria-label="Conversations" tabIndex={sidebarOpen ? -1 : undefined}>
      <div className="brand"><span className="brand__die" aria-hidden="true">20</span><div><strong>Tactician’s Ledger</strong><small>Build counsel for Baldur’s Gate 3</small></div><button className="mobile-close" onClick={closeSidebar} aria-label="Close conversations">×</button></div>
      <button className="new-chat" onClick={() => void newConversation()}><span aria-hidden="true">＋</span> Plan another build</button>
      <nav>{conversations.map(c => <button key={c.id} className={c.id === activeId ? "conversation active" : "conversation"} onClick={() => selectConversation(c)} aria-current={c.id === activeId ? "page" : undefined}><span>{conversationTitle(c)}</span><small>{relativeTime(c.updatedAt)}</small></button>)}</nav>
      <div className="sidebar__foot"><span className="status-dot" /> Game data: Patch 8</div>
    </aside>
    {sidebarOpen && <button className="scrim" onClick={closeSidebar} aria-label="Close conversations" />}
    <main className="chat">
      <header className="chat-header"><button ref={menuRef} className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open conversations" aria-expanded={sidebarOpen}>☰</button><div><h1>{title}</h1><p>Rules checked against Patch 8</p></div><span className="mode-mark">Honour ready</span></header>
      <div className="thread" aria-live="polite">{loadError && <div className="error-callout" role="alert"><strong>Build service unavailable</strong><p>{loadError}</p></div>}{state.messages.length === 0 && !loadError && <div className="empty-state"><div className="empty-rune">20</div><h2>What should this hero do?</h2><p>Name a playstyle, party role, difficulty, or item you want to build around.</p><div className="suggestions">{["A durable Honour Mode frontliner", "A no-consumables lightning caster", "A stealth build online in Act 1"].map(text => <button key={text} onClick={() => { setDraft(text); textareaRef.current?.focus(); }}>{text}</button>)}</div></div>}{state.messages.map(message => <article className={`message message--${message.role}`} key={message.id}><div className="message__identity">{message.role === "user" ? "You" : <><span aria-hidden="true">✦</span> Build advisor</>}</div><div className="message__body">{message.text && <MessageText role={message.role} text={message.text} />}<ToolActivity tools={message.tools ?? []} />{message.report && <OptimizationReportCard report={message.report} />}{message.error && <div className="error-callout" role="alert"><strong>Couldn’t finish this build</strong><p>{message.error}</p></div>}{state.status === "streaming" && state.activeMessageId === message.id && !message.text && !(message.tools?.length) && <span className="thinking">Consulting the ledger…</span>}</div></article>)}<div ref={endRef} /></div>
      <div className="composer-wrap"><form id="composer" className="composer" onSubmit={e => { e.preventDefault(); void send(draft); }}><label className="sr-only" htmlFor="message">Describe your build</label><textarea ref={textareaRef} id="message" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }} placeholder="Ask for a build, comparison, or rules check…" rows={1} /><div className="composer__bottom"><span>Enter to send · Shift+Enter for a new line</span>{state.status === "streaming" ? <button type="button" className="send-button stop" onClick={stop} aria-label="Stop generating"><span /></button> : <button type="submit" className="send-button" disabled={!draft.trim() || !activeId} aria-label="Send message">↑</button>}</div></form>{state.status === "error" && <button className="retry" onClick={() => void send(lastPrompt)}>Retry last request</button>}<p className="disclaimer">Builds are calculated from structured game data. Verify modded or recently patched mechanics in game.</p></div>
    </main>
  </div>;
}
