# Fixture coverage

The deterministic offline fixture contains a compact cross-section of normalized game entities for build search and engine smoke tests. It includes all 12 base classes, one representative subclass per class, 12 representative races, core combat feats, spells and actions, and 44 key items and consumables across Acts 1–3.

The dataset supports six basic build families: ranged, melee, tank, damage, control, and support. The curated rows are intentionally broad rather than exhaustive: they make local search and representative build generation useful while the import pipeline remains the route to full game-data coverage.

Run `pnpm verify:fixtures`. Verification requires:

- tags for Acts 1, 2, and 3;
- tags for ranged, melee, tank, damage, control, and support;
- exactly 12 base classes;
- 30–45 representative items;
- valid source/entity provenance references and one classification claim per entity.

This fixture is test/demo input, not a complete game database. Item mechanics, acquisition details, patch-specific conditions, and precise numerical effects must be imported as provenance-backed claims before deterministic calculations may rely on them.

The v3 ranged timeline slice relies only on executable fixture metadata for four bows, Archery, Extra Attack, Sharpshooter, Action Surge, Dread Ambusher, Sneak Attack, and Assassin. Its 24 candidates, opener/Nova/steady schedules, recovery cadence, and grouped timeline events/features are curated engine inputs, not behavior inferred from wiki prose. Timeline coverage enumerates all 16 equally likely d4 initiative pairs and keeps no-surprise and surprised branches separate under explicit tie and denied-turn assumptions. Setup effects, arbitrary guaranteed-critical state, and Battle Master superiority-die consumption remain non-executable until equally strict provenance-backed state rules are added.
