// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown, MessageText } from "./AssistantMarkdown";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(markdown: string) {
  const node = document.createElement("div");
  const root = createRoot(node);
  act(() => root.render(<AssistantMarkdown>{markdown}</AssistantMarkdown>));
  return { node, unmount: () => act(() => root.unmount()) };
}

describe("AssistantMarkdown", () => {
  it("renders GFM structure", () => {
    const view = render("## Build\n\n**Strong**\n\n- First\n- Second\n\n`code`\n\n| A | B |\n|---|---|\n| 1 | 2 |");
    expect(view.node.querySelector("h2")?.textContent).toBe("Build");
    expect(view.node.querySelector("strong")?.textContent).toBe("Strong");
    expect(view.node.querySelectorAll("li")).toHaveLength(2);
    expect(view.node.querySelector("code")?.textContent).toBe("code");
    expect(view.node.querySelector("table")).not.toBeNull();
    view.unmount();
  });

  it("allows safe links and blocks active HTML and unsafe URLs", () => {
    const view = render("[Wiki](https://bg3.wiki/wiki/Ranger) [bad](javascript:alert(1)) <script>alert(1)</script>");
    const link = view.node.querySelector("a");
    expect(link?.href).toBe("https://bg3.wiki/wiki/Ranger");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toBe("noopener noreferrer");
    expect(view.node.querySelectorAll("a")).toHaveLength(1);
    expect(view.node.querySelector("script")).toBeNull();
    expect(view.node.querySelector("[onclick]")).toBeNull();
    expect(view.node.textContent).toContain("bad");
    expect(view.node.textContent).toContain("alert(1)");
    view.unmount();
  });

  it("restricts icons to BG3 Wiki and recovers when a streaming URL changes", () => {
    const node = document.createElement("div");
    const root = createRoot(node);
    act(() => root.render(<AssistantMarkdown>![Bow](https://bg3.wiki/w/images/partial.png) ![Tracker](https://example.com/t.png)</AssistantMarkdown>));
    const image = node.querySelector("img");
    expect(image?.alt).toBe("Bow");
    expect(node.textContent).toContain("Tracker");
    act(() => image?.dispatchEvent(new Event("error")));
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toContain("Bow");
    act(() => root.render(<AssistantMarkdown>![Bow](https://bg3.wiki/w/images/final.png)</AssistantMarkdown>));
    expect(node.querySelector<HTMLImageElement>("img")?.src).toBe("https://bg3.wiki/w/images/final.png");
    act(() => root.unmount());
  });

  it("renders incomplete streaming markdown without throwing", () => {
    const view = render("**still streaming");
    expect(view.node.textContent).toBe("**still streaming");
    view.unmount();
  });

  it("keeps user-authored Markdown literal", () => {
    const node = document.createElement("div");
    const root = createRoot(node);
    act(() => root.render(<MessageText role="user" text="**not bold**" />));
    expect(node.textContent).toBe("**not bold**");
    expect(node.querySelector("strong")).toBeNull();
    act(() => root.unmount());
  });
});
