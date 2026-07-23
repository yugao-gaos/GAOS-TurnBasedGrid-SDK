# Grid model and reducer contract

The SDK uses a deliberately small grid vocabulary. It does not define terrain
tokens, entity schemas, level files, or a complete world state. Products expose
those concepts through the generic reducer and turn-view contracts.

## Coordinates

`Cell` is a mutable TypeScript tuple in `[x, y]` order:

```ts
type Cell = [number, number];
```

The built-in cardinal vectors assume screen-style coordinates: `x` grows to
the right and `y` grows downward.

```ts
CARDINAL_VECTORS.up    // [ 0, -1]
CARDINAL_VECTORS.down  // [ 0,  1]
CARDINAL_VECTORS.left  // [-1,  0]
CARDINAL_VECTORS.right // [ 1,  0]
```

Boards used by geometry helpers are zero-based rectangles:
`0 <= x < width` and `0 <= y < height`. Movement itself has no board size; its
`isStaticBlocked` callback must reject out-of-bounds cells.

Treat cells stored in state as values. Copy a tuple before retaining it if a
product might mutate the original array.

## Reducer boundary

Reusable solving, replay, and agent execution consume the same adapter:

```ts
interface GridReducer<TLevel, TState, TView extends GridTurnView> {
  init(level: TLevel, seed: number): TState;
  apply(state: TState, action: GridSubmittedAction): TState;
  view(state: TState): TView;
}
```

- `init` must create the same initial state for the same level and seed.
- `apply` validates and resolves one canonical action. It should throw for an
  illegal submission.
- `view` exposes only the observation and legal-action surface needed by SDK
  consumers.

When using the solver, `apply` must not corrupt its input state: several sibling
actions are explored from the same parent. Return an independent state, use
persistent data structures, or clone before mutation.

## Actions

An action definition declares one of three parameter shapes:

| `params` | Submission | Values are discovered from |
|---|---|---|
| `none` | `{ id }` | No additional data |
| `index` | `{ id, index }` | Items, dialogue options, and points of interest |
| `xy` | `{ id, x, y }` | Per-action targets, then the shared target list |

```ts
const action: GridSubmittedAction = {
  id: 'Action 4',
  x: 3,
  y: 2,
};
```

Action ids in the reducer are canonical. A hosted protocol may permute their
wire labels for an agent; [replay verification](replay.md) checks that mapping
before re-simulation.

## Turn observations

`GridTurnView` provides:

- legal action definitions;
- status: `playing`, `won`, or `failed`;
- an optional star result;
- `hud.actionsUsed`; and
- optional indexed choices and targetable cells.

Products may extend the view with a board, entities, inventory, objectives,
events, or any other observation. Generic SDK algorithms ignore those extra
fields unless a supplied callback uses them.

## Product invariants

Before connecting a reducer, test these properties:

1. Equal `(level, seed, action sequence)` inputs produce equal visible results.
2. Every action advertised by `view` is accepted by `apply` for that state.
3. Illegal or stale actions are rejected rather than silently reinterpreted.
4. Terminal states do not advertise actions that continue scored play.
5. State used for solver deduplication excludes presentation-only volatility.

The SDK owns the adapter shape. The product continues to own state layout,
validation, rules, content, serialization, and authoritative persistence.

## Zonoid example

Zonoid implements one universal `GridReducer` for Object Delivery, Object
Usage, Signal Language, The Breach, Intelligence Lies, and Jailbreak Protocol.
The reducer initializes a product `World`, applies the canonical move/use/talk/
inspect actions, and exposes a redacted `TurnView`; the same adapter is used by
human play, agents, the solver, and replay verification.
