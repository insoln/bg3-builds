// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { StructuredReport } from "./Report";
import { sampleReport } from "../mock";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe("StructuredReport", () => {
  it("renders structured fields and literal text", () => {
    const node = document.createElement("div");
    const root = createRoot(node);
    act(() => root.render(<StructuredReport report={{ ...sampleReport, title: "**Literal build**" }} />));
    expect(node.querySelector("h2")?.textContent).toBe("**Literal build**");
    expect(node.textContent).toContain("Legal build");
    expect(node.textContent).toContain("Unsupported mechanic");
    expect(node.querySelector("h2 strong")).toBeNull();
    act(() => root.unmount());
  });

  it("links exact citation URLs and keeps unsafe citations as text", () => {
    const node = document.createElement("div");
    const root = createRoot(node);
    const citations = [
      { id: "1", label: "Titanstring Bow", source: "BG3 Wiki", url: "https://bg3.wiki/wiki/Titanstring_Bow", iconUrl: "https://bg3.wiki/w/images/Bow.png" },
      { id: "2", label: "Unsafe", source: "Unknown", url: "javascript:alert(1)" },
    ];
    act(() => root.render(<StructuredReport report={{ ...sampleReport, citations, calculations: [{ ...sampleReport.calculations[0]!, citationIds: ["1", "2"] }] }} />));
    const links = [...node.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links).toHaveLength(2);
    expect(links.every(link => link.href === "https://bg3.wiki/wiki/Titanstring_Bow")).toBe(true);
    expect(node.querySelector<HTMLImageElement>(".citations img")?.src).toBe("https://bg3.wiki/w/images/Bow.png");
    expect(node.textContent).toContain("Unsafe");
    expect(links.some(link => link.href.startsWith("javascript:"))).toBe(false);
    act(() => root.unmount());
  });
});
