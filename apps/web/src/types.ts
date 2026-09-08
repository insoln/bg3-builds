import {
  optimizationReportSchema,
  type Build,
  type BuildMetrics,
  type OptimizationReport,
  type ReportIssue,
} from "@bg3-builds/domain";

export type Confidence = "high" | "medium" | "low";
export interface Citation { id: string; label: string; source: string; url?: string; iconUrl?: string; detail?: string }
export interface CalculationRow { label: string; expression: string; result: string; citationIds?: string[] }
export interface Assumption { id: string; label: string; value: string; impact?: string }
export interface AcquisitionStep { act: 1 | 2 | 3; title: string; location?: string; items: string[]; missable?: boolean }
export interface StructuredBuildReport {
  title: string;
  summary: string;
  build: Build;
  valid: boolean;
  confidence: Confidence;
  metrics?: BuildMetrics;
  issues: ReportIssue[];
  calculations: CalculationRow[];
  assumptions: Assumption[];
  acquisition: AcquisitionStep[];
  citations: Citation[];
  unsupportedMechanics?: string[];
}

export type ToolStatus = "queued" | "running" | "complete" | "error";
export interface ToolActivity { id: string; label: string; status: ToolStatus; detail?: string }
export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; report?: OptimizationReport; tools?: ToolActivity[]; error?: string }
export interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export type StreamEvent =
  | { type: "message_start"; messageId: string }
  | { type: "text_delta"; delta: string }
  | { type: "tool_status"; tool: ToolActivity }
  | { type: "report"; report: OptimizationReport }
  | { type: "message_end" }
  | { type: "error"; error: { code?: string; message: string } };

export function parseStreamEvent(value: unknown): StreamEvent {
  if (typeof value !== "object" || value === null || !("type" in value) || typeof value.type !== "string") throw new Error("Invalid streaming event.");
  const event = value as { type: string; [key: string]: unknown };
  if (event.type === "report") return { type: "report", report: optimizationReportSchema.parse(event["report"]) };
  if (event.type === "message_start" && typeof event["messageId"] === "string") return { type: "message_start", messageId: event["messageId"] };
  if (event.type === "text_delta" && typeof event["delta"] === "string") return { type: "text_delta", delta: event["delta"] };
  if (event.type === "message_end") return { type: "message_end" };
  if (event.type === "tool_status" && typeof event["tool"] === "object" && event["tool"] !== null) return { type: "tool_status", tool: event["tool"] as ToolActivity };
  if (event.type === "error" && typeof event["error"] === "object" && event["error"] !== null && typeof (event["error"] as { message?: unknown }).message === "string") return { type: "error", error: event["error"] as { code?: string; message: string } };
  throw new Error("Invalid streaming event.");
}
