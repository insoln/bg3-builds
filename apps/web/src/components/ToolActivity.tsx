import type { ToolActivity as Tool } from "../types";

export function ToolActivity({ tools }: { tools: Tool[] }) {
  if (!tools.length) return null;
  return <div className="tool-list" aria-label="Build analysis progress">{tools.map(tool => <div className={`tool tool--${tool.status}`} key={tool.id}><span className="tool__mark" aria-hidden="true" /><div><strong>{tool.label}</strong>{tool.detail && <p>{tool.detail}</p>}</div><span className="sr-only">{tool.status}</span></div>)}</div>;
}
