// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { StructuredReport } from "./Report";
import { sampleReport } from "../mock";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe("StructuredReport",()=>{ it("renders structured fields and literal text",()=>{ const node=document.createElement("div"); const root=createRoot(node); act(()=>root.render(<StructuredReport report={{...sampleReport,title:"**Literal build**"}}/>)); expect(node.querySelector("h2")?.textContent).toBe("**Literal build**"); expect(node.textContent).toContain("Legal build"); expect(node.textContent).toContain("Unsupported mechanic"); expect(node.querySelector("h2 strong")).toBeNull(); act(()=>root.unmount()); }); });
