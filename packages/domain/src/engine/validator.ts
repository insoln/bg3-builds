import { buildSchema, type Build, type EntityKind, type ReportIssue } from "../schemas/index.js";
import { engineMetadata } from "./metadata.js";
import type { EngineRepository } from "./repository.js";
import type { ExplainTrace, ValidationOptions, ValidationResult } from "./types.js";

const issue = (code: string, message: string, path: Array<string | number> = [], entityId?: string): ReportIssue => ({ code, severity: "error", message, path, ...(entityId ? { entityId } : {}) });

export function validateBuild(build: Build, repository: EngineRepository, options: ValidationOptions = {}): ValidationResult {
  const issues: ReportIssue[] = [];
  const trace: ExplainTrace[] = [];
  const parsed = buildSchema.safeParse(build);
  if (!parsed.success) {
    for (const problem of parsed.error.issues) issues.push(issue("schema", problem.message, problem.path as Array<string | number>));
    return { valid: false, issues, trace: [{ step: "schema", message: "Build failed schema validation", output: false }] };
  }
  build = parsed.data;

  const checkAvailability = (id: string, path: Array<string | number>): void => {
    const availableAct = engineMetadata(repository.getEntity(id)).availableAct;
    if (options.availableAct !== undefined && availableAct !== undefined && availableAct > options.availableAct) {
      issues.push(issue("act-unavailable", `${id} is unavailable in Act ${options.availableAct}`, path, id));
    }
  };
  const checkReference = (id: string, expectedKind: EntityKind, path: Array<string | number>): void => {
    const entity = repository.getEntity(id);
    if (!entity) issues.push(issue("unknown-entity", `Unknown ${expectedKind}: ${id}`, path, id));
    else if (entity.kind !== expectedKind) issues.push(issue("wrong-entity-kind", `${id} is ${entity.kind}, expected ${expectedKind}`, path, id));
    else checkAvailability(id, path);
  };
  checkReference(build.raceId, "race", ["raceId"]);
  if (build.subraceId) checkReference(build.subraceId, "subrace", ["subraceId"]);
  if (build.backgroundId) checkReference(build.backgroundId, "background", ["backgroundId"]);
  const classIds = new Set<string>();
  build.classes.forEach((entry, index) => {
    checkReference(entry.classId, "class", ["classes", index, "classId"]);
    if (classIds.has(entry.classId)) issues.push(issue("duplicate-class", `Class ${entry.classId} is listed more than once`, ["classes", index, "classId"], entry.classId));
    classIds.add(entry.classId);
    if (entry.subclassId) {
      const path = ["classes", index, "subclassId"] as Array<string | number>;
      checkReference(entry.subclassId, "subclass", path);
      const subclass = repository.getEntity(entry.subclassId);
      if (subclass?.kind === "subclass") {
        const metadata = engineMetadata(subclass);
        if (metadata.parentClassId !== entry.classId) {
          issues.push(issue("subclass-parent-mismatch", `${entry.subclassId} is not a subclass of ${entry.classId}`, path, entry.subclassId));
        }
        if (metadata.minimumClassLevel === undefined || entry.level < metadata.minimumClassLevel) {
          issues.push(issue("subclass-level-locked", `${entry.subclassId} requires at least ${metadata.minimumClassLevel ?? "a declared"} ${entry.classId} level`, path, entry.subclassId));
        }
      }
    }
  });
  build.feats.forEach((id, index) => checkReference(id, "feat", ["feats", index]));
  build.preparedSpells.forEach((entry, index) => {
    checkReference(entry.spellId, "spell", ["preparedSpells", index, "spellId"]);
    if (entry.sourceClassId) checkReference(entry.sourceClassId, "class", ["preparedSpells", index, "sourceClassId"]);
  });

  const levelSum = build.classes.reduce((sum, entry) => sum + entry.level, 0);
  trace.push({ step: "class-levels", message: "Compared class level sum with character level", input: { levelSum, level: build.level }, output: levelSum === build.level });
  if (levelSum !== build.level && !issues.some((entry) => entry.path[0] === "classes")) issues.push(issue("class-level-sum", `Class levels (${levelSum}) must equal build level (${build.level})`, ["classes"]));

  const slots = new Map<string, number>();
  let twoHandedMelee = false;
  let shieldOffHand = false;
  build.equipment.forEach((equipped, index) => {
    const entity = repository.getEntity(equipped.itemId);
    if (!entity) issues.push(issue("unknown-entity", `Unknown item: ${equipped.itemId}`, ["equipment", index, "itemId"], equipped.itemId));
    else if (entity.kind !== "item") issues.push(issue("wrong-entity-kind", `${equipped.itemId} is not an item`, ["equipment", index, "itemId"], equipped.itemId));
    const metadata = engineMetadata(entity);
    if (metadata.slot && metadata.slot !== equipped.slot) issues.push(issue("invalid-item-slot", `${equipped.itemId} cannot be equipped in ${equipped.slot}`, ["equipment", index, "slot"], equipped.itemId));
    if (options.availableAct && metadata.availableAct && metadata.availableAct > options.availableAct) issues.push(issue("act-unavailable", `${equipped.itemId} is unavailable in Act ${options.availableAct}`, ["equipment", index, "itemId"], equipped.itemId));
    if (slots.has(equipped.slot)) issues.push(issue("slot-conflict", `Equipment slot ${equipped.slot} is occupied more than once`, ["equipment", index, "slot"]));
    slots.set(equipped.slot, index);
    if (equipped.slot === "melee-main-hand" && metadata.handedness === "two-handed") twoHandedMelee = true;
    if (equipped.slot === "melee-off-hand" && (metadata.shield || entity?.tags.includes("shield"))) shieldOffHand = true;
  });
  if (twoHandedMelee && slots.has("melee-off-hand")) issues.push(issue("two-hand-conflict", "A two-handed melee weapon conflicts with melee off-hand equipment", ["equipment"]));
  if (twoHandedMelee && shieldOffHand) issues.push(issue("shield-conflict", "A shield cannot be used with a two-handed melee weapon", ["equipment"]));

  trace.push({ step: "legality", message: "Validated levels, availability, and equipment", output: issues.length === 0 });
  return { valid: issues.length === 0, issues, trace };
}
