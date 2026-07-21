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
- deterministic multi-wave turn settlement through an explicit consequence
  worklist, including convergence guards, next-turn deferral, and causal traces;
- breadth-first chain reactions, path-projectile advancement, bounded full-flight
  passes, and all-or-nothing push-chain planning/commit ordering;
- latching and automatic gate transitions, including occupancy-safe closing;
- ordered arrival-rule dispatch, neutral multi-resource claim arbitration,
  directed transport proposals/runs, connected link sources, and bounded
  transport/state interlocks;
- shortest cardinal pathfinding, Bresenham traversal, line-of-sight checks, and
  widening cone geometry through injected board/blocker policies;
- seeded random draws and permutations;
- star scoring and Energy/ActionBudget failure ordering;
- breadth-first minimum-action solving over an injected deterministic reducer;
- transcript re-simulation and deterministic per-level run seeds.
- provider-neutral agent episode lifecycle, concrete action validation,
  rewards, safety truncation, transcripts, and batch evaluation.

The product owns content and policy:

- Zonoid character identities, sheets, traits, abilities, and loadouts;
- campaign game-type registration and the mapping from a game type to rules;
- authored boards, levels, thresholds, budgets, dialogue, and objectives;
- authentication, persistence, matchmaking, seasons, and server-only rules.

The dividing rule is: the SDK implements **how a reusable mechanism behaves**;
the product decides **which content uses it, where it is enabled, and with what
values**.

Turn settlement is described in [Deterministic turn settlement](settlement.md).
One submitted turn may resolve through several same-turn waves before the SDK
returns control to the caller.

Geometry APIs accept callbacks for cell existence and blocking. The SDK owns
the algorithm; the product retains its terrain tokens, traversal capabilities,
projectile collision effects, and visibility policy.

## Reusable mechanisms

The engine subpath ships mechanisms directly. Products inject world access and
effects instead of copying their control flow:

```ts
import {
  advancePathProjectiles,
  arbitrateResourceClaims,
  commitPushChain,
  planPushChain,
  proposeDirectedTransport,
  resolveArrival,
  resolveChainReaction,
  resolveFlightPasses,
  resolveGateTransition,
  resolveInterlock,
  resolveTransportRun,
} from '@yugao-gaos/turn-based-grid-sdk/engine';
```

These functions do not assign meaning to tokens. For example,
`resolveChainReaction` guarantees breadth-first, once-per-identity propagation;
the product decides what a node represents, which effects it applies, and which
neighboring nodes it triggers. `advancePathProjectiles` owns one-cell travel
semantics while the product supplies collision decisions and commits damage,
landing, removal, and presentation events.

`planPushChain` is mutation-free. `commitPushChain` then writes farthest-first
and emits arrivals nearest-first, preventing overwrites while retaining causal
animation order. Transport similarly separates reusable directed proposals and
bounded run/interlock behavior from product occupancy, power, and terrain rules.
Gate transitions accept only abstract open/closed state, activation, and
occupancy; products retain their source lookup, board tokens, and visual events.

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

The same reducer adapter powers `AgentEnvironment`. A product therefore needs
no second gameplay implementation for local agents, hosted sessions, solving,
or deterministic replay.

## Scoring configuration

The scoring formula lives here, but the numbers do not:

```ts
scoreStars(actionsUsed, { three: level.stars.three, two: level.stars.two });
```

Likewise, the SDK defines budget-failure precedence while the product supplies
the ActionBudget and Energy caps.
