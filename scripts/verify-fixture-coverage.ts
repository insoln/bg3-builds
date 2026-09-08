import {
  fixtureClaims,
  fixtureCoverage,
  fixtureEntities,
  fixtureSources,
} from "../packages/data/dist/fixtures/index.js";
import { validateProvenance } from "../packages/data/dist/provenance.js";

const requiredTags = [
  ...fixtureCoverage.acts,
  ...fixtureCoverage.archetypes,
] as const;
const absentTags = requiredTags.filter(
  (tag) => !fixtureEntities.some((entity) => entity.tags.includes(tag)),
);
const classCount = fixtureEntities.filter((entity) => entity.kind === "class").length;
const itemCount = fixtureEntities.filter((entity) => entity.kind === "item").length;
const issues = validateProvenance(fixtureEntities, fixtureSources, fixtureClaims);

if (classCount !== 12) {
  issues.push({
    code: "class-coverage",
    message: `Expected 12 base classes, found ${classCount}`,
  });
}
if (itemCount < 30 || itemCount > 45) {
  issues.push({
    code: "item-coverage",
    message: `Expected 30-45 representative items, found ${itemCount}`,
  });
}

if (absentTags.length || issues.length) {
  console.error(JSON.stringify({ absentTags, issues }, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    `Fixture coverage OK: ${fixtureEntities.length} entities, ` +
      `${classCount} classes, ${itemCount} items, ${fixtureClaims.length} claims; ` +
      requiredTags.join(", "),
  );
}
