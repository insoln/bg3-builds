import { useEffect, useState } from "react";
import type { StreamActivity } from "../chat/reducer";
import type { ToolActivity as Tool } from "../types";

const INACTIVITY_WARNING_MS = 60_000;

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  return `${remainder}s`;
}

export function ToolActivity({
  tools,
  activity,
}: {
  tools: Tool[];
  activity?: StreamActivity;
}) {
  const [now, setNow] = useState(() => Date.now());
  const hasActiveTool = tools.some(
    (tool) => tool.status === "queued" || tool.status === "running",
  );

  useEffect(() => {
    if (!hasActiveTool || activity === undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activity, hasActiveTool]);

  if (!tools.length) return null;
  const displayTime = activity?.endedAt ?? now;
  const elapsed = activity === undefined
    ? undefined
    : formatElapsed(displayTime - activity.startedAt);
  const inactive = hasActiveTool
    && activity !== undefined
    && now - activity.lastEventAt >= INACTIVITY_WARNING_MS;

  return <div className="tool-list" aria-label="Build analysis progress">
    {tools.map((tool) => {
      const active = tool.status === "queued" || tool.status === "running";
      const statusLabel = tool.status === "complete"
        ? "Complete"
        : tool.status === "error"
          ? "Couldn’t complete"
          : tool.status === "stopped"
            ? "Stopped"
            : undefined;
      const phase = tool.detail ?? (tool.status === "queued"
        ? "Analyzing your request"
        : tool.status === "running"
          ? "Checking game data"
          : undefined);

      return <div className={`tool tool--${tool.status}`} key={tool.id}>
        <span className="tool__mark" aria-hidden="true" />
        <div className="tool__content">
          <div className="tool__heading">
            <strong>{tool.label}</strong>
            {elapsed && <span className="tool__elapsed" aria-hidden="true">{elapsed}</span>}
          </div>
          {phase && <p>{phase}</p>}
          {active && <div
            className="tool__progress"
            role="progressbar"
            aria-label={`${tool.label}: ${phase}`}
          ><span /></div>}
          {inactive && <p className="tool__warning" role="status">
            Taking longer than usual · No recent activity
          </p>}
          {statusLabel && <span className="tool__terminal">{statusLabel}</span>}
        </div>
      </div>;
    })}
  </div>;
}
