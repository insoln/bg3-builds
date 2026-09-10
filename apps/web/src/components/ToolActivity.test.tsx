// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolActivity } from "./ToolActivity";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.useRealTimers());

describe("ToolActivity", () => {
  it("renders honest indeterminate progress and warns after real-event silence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const node = document.createElement("div");
    const root = createRoot(node);
    const tool = { id: "analysis", label: "Build analysis", status: "queued" as const, detail: "Analyzing your request" };
    const activity = { messageId: "a", startedAt: 5_000, lastEventAt: 10_000 };

    act(() => root.render(<ToolActivity tools={[tool]} activity={activity} />));
    const progress = node.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-label")).toBe("Build analysis: Analyzing your request");
    expect(progress?.hasAttribute("aria-valuenow")).toBe(false);
    expect(node.textContent).toContain("5s");
    expect(node.textContent).not.toContain("Taking longer than usual");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(node.textContent).toContain("Taking longer than usual · No recent activity");

    act(() => root.render(<ToolActivity tools={[tool]} activity={{ ...activity, lastEventAt: 70_000 }} />));
    expect(node.textContent).not.toContain("Taking longer than usual");
    act(() => root.unmount());
  });

  it("renders a static terminal state with frozen elapsed time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const node = document.createElement("div");
    const root = createRoot(node);
    act(() => root.render(<ToolActivity
      tools={[{ id: "analysis", label: "Build analysis", status: "complete" }]}
      activity={{ messageId: "a", startedAt: 1_000, lastEventAt: 11_000, endedAt: 11_000 }}
    />));
    expect(node.querySelector('[role="progressbar"]')).toBeNull();
    expect(node.textContent?.match(/Complete/g)).toHaveLength(1);
    expect(node.querySelector(".tool__elapsed")?.getAttribute("aria-hidden")).toBe("true");
    expect(node.textContent).toContain("10s");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(node.textContent).toContain("10s");
    act(() => root.unmount());
  });
});
