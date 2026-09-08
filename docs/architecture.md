# Architecture

## Runtime flow

```text
React chat -> POST SSE -> Fastify -> Claude Messages streaming loop
                                  -> read-only game tools
                                  -> fixture-backed EngineRepository
                                  -> deterministic validator/calculator/ranker
```

Claude translates intent and explains tool output. It is not authoritative for
build legality or arithmetic. The provider persists full Anthropic content
blocks (including tool-use and tool-result turns), while the public conversation
projection exposes only user/assistant text.

## Package boundaries

- `packages/domain` owns portable Zod contracts and a pure deterministic engine.
  It has no database, HTTP, UI, or model dependency.
- `packages/data` owns SQLite, FTS5, provenance records, curated fixtures, and
  local MediaWiki XML/canonical HTML ingestion.
- `apps/api` owns transport, conversation orchestration, and the Anthropic SDK.
  Ports (`ConversationStore`, `GameDataReader`, `MessageProvider`) keep the
  Fastify routes independently testable.
- `apps/web` owns transient streaming state and structured report rendering. It
  does not parse build cards from Claude Markdown.

## Current composition

The API composition root uses `FixtureGameDataReader`, which adapts the curated
fixture collection to the domain engine. Conversations currently use the
in-memory store. A SQLite conversation repository exists but needs an adapter
to the API's full structured Anthropic transcript contract before it can replace
the memory implementation without losing tool blocks.

## Data boundary

`bg3.wiki` is not a runtime service dependency. Imports consume local XML or
saved canonical HTML, with an optional bounded allowlisted URL manifest.
Normalized facts retain source URL, game version/revision, retrieval date,
license notice, evidence, and locator. Unsupported mechanics remain searchable
text and produce warnings rather than fabricated numeric behavior.

## Deliberate first-release limits

The generator is a bounded deterministic template search over the fixture set,
not a proof of the global optimum. Exact patch/difficulty-specific DRS event
graphs, full combat simulation, complete game corpus, party-wide unique-item
allocation, auth, and deployment are outside this vertical slice.
