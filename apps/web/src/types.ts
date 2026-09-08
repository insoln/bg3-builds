import {
  optimizationReportSchema,
  type Build,
  type BuildMetrics,
  type OptimizationReport,
  type ReportIssue,
} from "@bg3-builds/domain";
import { z } from "zod";

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
export interface ToolActivity { id: string; label: string; status: ToolStatus; detail?: string | undefined }
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
  | { type: "error"; error: { code?: string | undefined; message: string } };

const toolActivitySchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["queued", "running", "complete", "error"]),
  detail: z.string().optional(),
}).strict();

const streamEventSchema: z.ZodType<StreamEvent> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message_start"), messageId: z.string() }).strict(),
  z.object({ type: z.literal("text_delta"), delta: z.string() }).strict(),
  z.object({ type: z.literal("tool_status"), tool: toolActivitySchema }).strict(),
  z.object({ type: z.literal("report"), report: optimizationReportSchema }).strict(),
  z.object({ type: z.literal("message_end") }).strict(),
  z.object({
    type: z.literal("error"),
    error: z.object({ code: z.string().optional(), message: z.string() }).strict(),
  }).strict(),
]);

export function parseStreamEvent(value: unknown): StreamEvent {
  return streamEventSchema.parse(value);
}
