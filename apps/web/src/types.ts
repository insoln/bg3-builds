import type { Build, BuildMetrics, ReportIssue } from "@bg3-builds/domain";

export type Confidence = "high" | "medium" | "low";
export interface Citation { id: string; label: string; source: string; url?: string; detail?: string }
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
export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; report?: StructuredBuildReport; tools?: ToolActivity[]; error?: string }
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
  | { type: "report"; report: StructuredBuildReport }
  | { type: "message_end" }
  | { type: "error"; error: { code?: string; message: string } };
