# BG3 Builds

A local-first web chat that turns a natural-language Baldur's Gate 3 request
("act 1, level 5, best ranged build") into a concrete, mechanically checked
character configuration.

Claude interprets the request and explains the result. Within each explicitly
declared evaluator scope, legality, availability, and reported numbers are
produced by deterministic TypeScript — never by model arithmetic. Unsupported
mechanics remain labeled limitations rather than silently estimated.

## Workspace

| Package           | Role                                                              |
| ----------------- | ----------------------------------------------------------------- |
| `packages/domain` | Zod contracts plus the pure build engine (validate/calculate/rank) |
| `packages/data`   | SQLite schema, provenance-backed repositories, importers, fixtures |
| `apps/api`        | Fastify REST + SSE, Claude streaming loop with read-only tools     |
| `apps/web`        | React 19 chat UI rendering structured build reports               |

## Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer

## Commands

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify:fixtures
```

Run the API on port 3001 (`pnpm --filter @bg3-builds/api dev`) and the web app
on port 5173 (`pnpm --filter @bg3-builds/web dev`); Vite proxies `/api` and
`/health` to the API. Claude calls require credentials resolved by the standard
Anthropic SDK environment; without them the deterministic engine, fixtures, and
tests still run.

## HTTP contract

```
GET    /health
GET    /api/v1/conversations
POST   /api/v1/conversations
GET    /api/v1/conversations/:id
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id
POST   /api/v1/conversations/:id/messages   -> SSE
```

The message route streams `message_start`, `text_delta`, `tool_status`,
`report`, `message_end`, and `error` events. Each event repeats its
discriminator inside the `data` payload, so both `EventSource`-style and
body-parsing clients read the same shape.

## Known limitations

- Conversations are held in memory; the SQLite store exists in `packages/data`
  but is not wired into the running API yet.
- `better-sqlite3` needs a native build (`pnpm rebuild better-sqlite3`); until
  it is compiled the two SQLite-backed data tests fail to load their binding.
- The exact ranged optimizer exhaustively ranks only its declared Patch 8,
  Level 5, Act 1 scope: Fighter/Battle Master or Ranger/Gloom Stalker, four
  curated bows, and Sharpshooter enabled/disabled. It reports named single-
  attack, opener, Nova, steady-state, and 1/2/3/5/custom-N exact PMF windows,
  ranked by Nova expected damage—not a global optimum. HP-threshold probability
  means kill by the end of the named window against the same continuously
  available target; attacks do not stop or retarget after an earlier kill.
- Window schedules explicitly list Action Surge (short-rest recovery) or Dread
  Ambusher (once per encounter). Battle Master superiority-die damage remains
  excluded until its successful-hit resource consumption is modeled exactly.
- Surprise, setup effects, Executioner/guaranteed critical state, multi-target/
  AoE behavior, Arrow of Many Targets, and full DRS/DR event graphs remain
  unsupported and are reported as limitations rather than estimated.

See `docs/architecture.md`, `docs/data-sources.md`, and
`docs/fixture-coverage.md` for boundaries, provenance rules, and coverage.
