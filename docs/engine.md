# Reusable grid engine

Import the engine through the dedicated package subpath:

```ts
import {
  budgetFailure,
  recheckGridTranscript,
  resolveMoves,
  scoreStars,
  solveGridLevel,
} from '@yugao-gaos/turn-based-grid-sdk/engine';
```

## Ownership boundary

The SDK owns deterministic, product-neutral behavior:

- simultaneous movement collision resolution, including footprints, movement
  chains, rotations, swaps, and priority;
- shortest cardinal pathfinding, Bresenham traversal, line-of-sight checks, and
  widening cone geometry through injected board/blocker policies;
- seeded random draws and permutations;
- star scoring and Energy/ActionBudget failure ordering;
- breadth-first minimum-action solving over an injected deterministic reducer;
- transcript re-simulation and deterministic per-level run seeds.

The product owns content and policy:

- Zonoid character identities, sheets, traits, abilities, and loadouts;
- campaign game-type registration and the mapping from a game type to rules;
- authored boards, levels, thresholds, budgets, dialogue, and objectives;
- authentication, persistence, matchmaking, seasons, and server-only rules.

The dividing rule is: the SDK implements **how a reusable mechanism behaves**;
the product decides **which content uses it, where it is enabled, and with what
values**.

Geometry APIs accept callbacks for cell existence and blocking. The SDK owns
the algorithm; the product retains its terrain tokens, traversal capabilities,
projectile collision effects, and visibility policy.

## Reducer adapter

The solver and replay checker depend on `GridReducer<TLevel, TState>` rather
than a Zonoid registry. A product adapter provides three pure operations:

```ts
interface GridReducer<TLevel, TState> {
  init(level: TLevel, seed: number): TState;
  apply(state: TState, action: GridSubmittedAction): TState;
  view(state: TState): GridTurnView;
}
```

This keeps campaign lookup, level schemas, and character catalogs outside the
SDK while allowing the reusable algorithms to execute the product reducer.

## Scoring configuration

The scoring formula lives here, but the numbers do not:

```ts
scoreStars(actionsUsed, { three: level.stars.three, two: level.stars.two });
```

Likewise, the SDK defines budget-failure precedence while the product supplies
the ActionBudget and Energy caps.
