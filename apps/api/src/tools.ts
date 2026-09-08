import type Anthropic from "@anthropic-ai/sdk";
import { buildSchema, entityKindSchema, optimizationRequestSchema, type Build, type EntityKind, type GameEntity, type OptimizationRequest, type OptimizerResult } from "@bg3-builds/domain";
import { z } from "zod";

export interface GameDataReader {
  searchEntities(input: { query?: string; kind?: EntityKind; limit: number }, signal?: AbortSignal): Promise<GameEntity[]>;
  getEntity(id: string, signal?: AbortSignal): Promise<GameEntity | undefined>;
  validateBuild(build: Build, signal?: AbortSignal): Promise<unknown>;
  compareBuilds(left: Build, right: Build, signal?: AbortSignal): Promise<unknown>;
  optimizeBuild(input: OptimizationRequest, signal?: AbortSignal): Promise<OptimizerResult>;
}

export class EmptyGameDataReader implements GameDataReader {
  async searchEntities(): Promise<GameEntity[]> { return []; }
  async getEntity(): Promise<GameEntity | undefined> { return undefined; }
  async validateBuild(build: Build): Promise<unknown> { return { valid: true, build, issues: [] }; }
  async compareBuilds(left: Build, right: Build): Promise<unknown> { return { left: left.name, right: right.name, differences: [] }; }
  async optimizeBuild(): Promise<OptimizerResult> { throw new Error("Build optimization requires loaded game data."); }
}

const schemas = {
  search_entities: z.object({ query: z.string().trim().min(1).max(200).optional(), kind: entityKindSchema.optional(), limit: z.int().min(1).max(25).default(10) }).strict(),
  get_entity: z.object({ id: z.string().trim().min(1).max(160) }).strict(),
  validate_build: z.object({ build: buildSchema }).strict(),
  compare_builds: z.object({ left: buildSchema, right: buildSchema }).strict(),
  optimize_build: z.object({ request: optimizationRequestSchema }).strict(),
};

type ToolName = keyof typeof schemas;

// Strict tool schemas accept only a subset of JSON Schema. These keywords are
// dropped from what Claude sees; the Zod schemas below still validate every
// tool input at runtime, so no constraint is actually relaxed.
const unsupportedSchemaKeywords = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "propertyNames",
  "patternProperties",
]);

function normalizeToolSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeToolSchema);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      if (unsupportedSchemaKeywords.has(key)) return [];
      // Strict mode requires closed objects, so open records become opaque.
      if (key === "additionalProperties" && typeof nested === "object") {
        return [[key, false]];
      }
      return [[key, normalizeToolSchema(nested)]];
    }),
  );
}

function definition(name: ToolName, description: string): Anthropic.Tool {
  const inputSchema = normalizeToolSchema(
    z.toJSONSchema(schemas[name], { target: "draft-7" }),
  ) as Anthropic.Tool.InputSchema;
  return {
    name,
    description,
    input_schema: inputSchema,
    strict: true,
  } as Anthropic.Tool;
}

export const gameTools: Anthropic.Tool[] = [
  definition("search_entities", "Search the available Baldur's Gate 3 classes, races, feats, spells, items, and other entities."),
  definition("get_entity", "Get one Baldur's Gate 3 entity by its exact ID."),
  definition("validate_build", "Validate a complete Baldur's Gate 3 build and return its issues."),
  definition("compare_builds", "Compare two complete Baldur's Gate 3 builds."),
  definition("optimize_build", "Find the best build only within the supported bounded Level 5, Act 1, single-target ranged search. This does not claim a global optimum and rejects surprise, guaranteed critical hits, and area attacks."),
];

export async function executeGameTool(reader: GameDataReader, use: Anthropic.ToolUseBlock, signal?: AbortSignal): Promise<Anthropic.ToolResultBlockParam> {
  try {
    signal?.throwIfAborted();
    let result: unknown;
    switch (use.name as ToolName) {
      case "search_entities": {
        const input = schemas.search_entities.parse(use.input);
        result = await reader.searchEntities({ limit: input.limit, ...(input.query === undefined ? {} : { query: input.query }), ...(input["kind"] === undefined ? {} : { kind: input["kind"] }) }, signal);
        break;
      }
      case "get_entity": result = await reader.getEntity(schemas.get_entity.parse(use.input).id, signal) ?? { found: false }; break;
      case "validate_build": result = await reader.validateBuild(schemas.validate_build.parse(use.input)["build"], signal); break;
      case "compare_builds": {
        const input = schemas.compare_builds.parse(use.input);
        result = await reader.compareBuilds(input["left"], input["right"], signal);
        break;
      }
      case "optimize_build": result = await reader.optimizeBuild(schemas.optimize_build.parse(use.input).request, signal); break;
      default: throw new Error(`Unknown tool: ${use.name}`);
    }
    signal?.throwIfAborted();
    return { type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) };
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    const message = error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : "Tool failed";
    return { type: "tool_result", tool_use_id: use.id, content: message, is_error: true };
  }
}
