import { fixtureEntities } from "@bg3-builds/data/fixtures";
import { buildApp } from "./app.js";
import { createDefaultProvider } from "./provider.js";
import { FixtureGameDataReader } from "./runtime-reader.js";
import { InMemoryConversationStore } from "./store.js";

const reader = new FixtureGameDataReader(fixtureEntities);
const app = buildApp({
  store: new InMemoryConversationStore(),
  provider: createDefaultProvider(reader),
});

await app.listen({
  host: process.env["HOST"] ?? "0.0.0.0",
  port: Number(process.env["PORT"] ?? 3001),
});
