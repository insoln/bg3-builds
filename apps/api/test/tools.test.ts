import type Anthropic from "@anthropic-ai/sdk";
import type { Build, GameEntity } from "@bg3-builds/domain";
import { describe, expect, it } from "vitest";
import { FixtureGameDataReader } from "../src/runtime-reader.js";
import { executeGameTool, gameTools } from "../src/tools.js";

const source = { source: "test", gameVersion: "1" };
const entity = (id: string, kind: GameEntity["kind"], engine?: Record<string, unknown>): GameEntity => ({
  id,
  slug: id,
  kind,
  text: { name: id },
  tags: [],
  source,
  ...(engine === undefined ? {} : { metadata: { engine } }),
});

const reader = new FixtureGameDataReader([
  entity("fighter", "class"),
  entity("human", "race"),
  entity("late-ring", "item", { slot: "ring-1", availableAct: 3 }),
]);

const build = (name: string, equipment: Build["equipment"] = []): Build => ({
  name,
  gameVersion: "1",
  level: 4,
  raceId: "human",
  classes: [{ classId: "fighter", level: 4 }],
  abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
  choices: [],
  feats: [],
  preparedSpells: [],
  equipment,
});

const toolUse = (name: "validate_build" | "compare_builds" | "optimize_build", input: unknown): Anthropic.ToolUseBlock => ({
  type: "tool_use",
  id: "tool-use-id",
  name,
  input,
});

const result = async (name: "validate_build" | "compare_builds" | "optimize_build", input: unknown): Promise<unknown> => {
  const response = await executeGameTool(reader, toolUse(name, input));
  expect(response.is_error).not.toBe(true);
  return JSON.parse(response.content as string);
};

describe("runtime game tools", () => {
  it("passes availableAct to validation and returns the rejection", async () => {
    await expect(result("validate_build", {
      build: build("Unavailable", [{ slot: "ring-1", itemId: "late-ring" }]),
      availableAct: 2,
    })).resolves.toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ code: "act-unavailable" })],
    });
  });

  it("validates both candidates and never ranks an invalid candidate", async () => {
    await expect(result("compare_builds", {
      left: build("Available"),
      right: build("Unavailable", [{ slot: "ring-1", itemId: "late-ring" }]),
      availableAct: 2,
    })).resolves.toMatchObject({
      accepted: false,
      validation: {
        left: { valid: true },
        right: { valid: false, issues: [expect.objectContaining({ code: "act-unavailable" })] },
      },
      rejected: [expect.objectContaining({ build: "right" })],
      rankings: [],
    });
  });

  it("ranks only after both candidates validate", async () => {
    await expect(result("compare_builds", {
      left: build("Alpha"),
      right: build("Beta"),
      availableAct: 1,
    })).resolves.toMatchObject({
      accepted: true,
      rejected: [],
      rankings: expect.arrayContaining([expect.objectContaining({ build: expect.objectContaining({ name: expect.any(String) }) })]),
    });
  });

  it("exposes and forwards optimizer window inputs", async () => {
    const optimize = gameTools.find((tool) => tool.name === "optimize_build");
    const requestSchema = (optimize?.input_schema as { properties: { request: { properties: { combat: { properties: Record<string, unknown> } } } } }).properties.request;
    expect(Object.keys(requestSchema.properties.combat.properties)).toEqual(expect.arrayContaining(["targetHitPoints", "horizons"]));

    const input = { request: { gameVersion: "Patch 8", level: 5, availableAct: 1, combat: { mode: "ranged", targetHitPoints: 75, horizons: [6] } } };
    const response = await executeGameTool({
      ...reader,
      optimizeBuild: async request => ({ request } as never),
    }, toolUse("optimize_build", input));
    expect(response.is_error).not.toBe(true);
    expect(JSON.parse(response.content as string)).toMatchObject(input);

    const invalid = await executeGameTool(reader, toolUse("optimize_build", { request: { gameVersion: "Patch 8", level: 5, availableAct: 1, combat: { mode: "ranged", targetHitPoints: 0 } } }));
    expect(invalid.is_error).toBe(true);
  });

  it("exposes closed, explicit ability score properties in build tool schemas", () => {
    const validate = gameTools.find((tool) => tool.name === "validate_build");
    const buildSchema = (validate?.input_schema as { properties: { build: { properties: { abilityScores: { properties: Record<string, unknown>; additionalProperties: boolean } } } } }).properties.build;
    const abilityScores = buildSchema.properties.abilityScores;

    expect(abilityScores.additionalProperties).toBe(false);
    expect(Object.keys(abilityScores.properties).sort()).toEqual(["charisma", "constitution", "dexterity", "intelligence", "strength", "wisdom"]);
  });
});
