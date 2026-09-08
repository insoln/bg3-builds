# Architecture

## Runtime flow

```text
React chat -> POST SSE -> Fastify -> Claude Messages streaming loop
                                  -> read-only game tools
                                  -> fixture-backed EngineRepository
                                  -> deterministic validator/calculator/ranker
```

Claude translates intent and explains tool output. It is not authoritative for
build legality or arithmetic. The provider persists full Anthropic content blocks (including tool-use and
tool-result turns). The public projection exposes user/assistant text plus any
canonical optimization report attached to its originating assistant turn.

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

## Exact ranged optimizer slice

`optimize_build` exhaustively enumerates 16 candidates in a versioned finite
scope: Patch 8, Level 5, Act 1, Fighter/Battle Master or Ranger/Gloom Stalker,
four executable bows, and two Sharpshooter policies. Every candidate passes
static validation before its exact discrete attack, first-round, and three-round
damage PMFs are composed and ranked. Fighter windows include Action Surge;
Battle Master superiority-die damage is excluded because its successful-hit
resource consumption requires a stateful evaluator. The guarantee is therefore
`exact-within-declared-scope`, never global optimality.

## Deliberate first-release limits

Surprise, Executioner and other stateful guaranteed-critical effects,
multi-target/AoE geometry, Arrow of Many Targets, exact DRS/DR event graphs,
complete game corpus, and party-wide unique-item allocation remain outside this
vertical slice. Unsupported mechanics are returned explicitly instead of being
folded into an approximate score.
