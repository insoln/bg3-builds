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

`optimize_build` exhaustively enumerates 24 candidates in the versioned
`curated-l5-act1-ranged-timeline-v3` scope: Patch 8, Level 5, Act 1,
Fighter/Battle Master, Ranger/Gloom Stalker, or Rogue/Assassin; four executable
bows; and two Sharpshooter policies. Every candidate passes static validation
before exact PMFs are composed for single attack, opener, Nova, steady-state,
and requested N-round horizons. The optimizer ranks by Nova expected damage,
then steady-state expected damage and stable identity/policy ties.

A combat window is a declared sequence of independent attack events. Fighter
Nova spends Action Surge once per short rest; Gloom Stalker opener/Nova spends
Dread Ambusher once per encounter. An N-round horizon is one Nova opening plan
followed by N−1 steady-state rounds. It is a same-target damage benchmark: target
death does not stop later attacks or trigger retargeting. `probabilityKill` is the exact PMF mass at or above the requested HP by the end
of that window (shown as **Kill by end**), not an initiative-relative kill
probability.

The separate timeline evaluator computes **Before target's first actionable
turn** by enumerating all 4 × 4 equally likely d4 initiative-roll pairs. It uses
candidate and target initiative modifiers, then Dexterity, then the explicitly
selected equal-total-and-equal-Dexterity outcome. The request also states whether
a denied surprised turn counts as taken. These ambiguities are explicit inputs;
the conversational provider asks rather than inventing defaults. No-surprise and
surprised branches stay separate, and each groups identical order, event schedule,
state, and applied-feature cases while retaining its pair count, probability mass,
turn count, and conditional kill probability. Assassin's first-turn/surprise
features are applied only in the deterministic cases that declare them. The
guarantee is therefore `exact-within-declared-scope`, never global optimality.

## Deliberate first-release limits

Setup remains a typed unsupported window because arbitrary pre-combat effect
state, condition duration, concentration, and persistent effects are not yet
executable. Battle Master superiority-die consumption, Executioner and other
stateful guaranteed-critical effects, multi-target/AoE geometry, Arrow of Many
Targets, exact DRS/DR event graphs, complete game corpus, and party-wide unique-
item allocation remain outside this vertical slice. Unsupported mechanics are
returned explicitly instead of being folded into an approximate score.
