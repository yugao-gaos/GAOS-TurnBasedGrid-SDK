# Minimum-action solver

`solveGridLevel` performs breadth-first search over any deterministic
`GridReducer`. The first win it finds has minimum submitted-action depth under
the supplied action enumeration and state-equivalence policy.

## Basic use

```ts
const result = solveGridLevel(reducer, level, {
  maxActions: 20,
  maxNodes: 1_000_000,
  seed: 42,
  includeAction: (action) => action.id !== 'Restart',
});
```

The result reports:

- `min`: shortest action count, or `null` when none was found;
- `actions`: the canonical winning sequence, or `null`;
- `explored`: number of unique states admitted, including the initial state;
- `capped`: whether the node limit stopped search.

Search depths begin at one. Supply a normal `playing` initial state; an already
won initial state is not reported as a zero-action solution.

## Action enumeration

By default, `enumerateGridActions` expands the current turn view:

- `none`: one `{ id }` action;
- `index`: one action for every distinct index found in items, dialogue options,
  then points of interest; and
- `xy`: per-action target cells when present, otherwise shared target cells.

Enumeration order breaks ties between equally short solutions. Override
`actions(view)` for richer parameter schemas or when indexed values apply only
to particular actions. `includeAction` can remove legal but search-unhelpful
commands such as restart.

An exception from `reducer.apply` marks that candidate invalid and search
continues. Failed states are not expanded; won states return immediately.

## State identity

The default key shallow-copies object state, removes top-level `lastEvents`,
`actionsUsed`, `narrative`, and `log`, filters cosmetic entities, then applies
`JSON.stringify` and an internal compact fingerprint.

That default is a convenience, not a universal semantic model. Supply
`stateKey(state)` when:

- other volatile presentation fields exist;
- property or entity ordering is not canonical;
- hidden rule state affects future outcomes;
- cosmetic classification differs; or
- the state is not a plain serializable object.

Two states with one key are treated as equivalent forever. Omitting relevant
state can produce a false “unsolvable”; retaining irrelevant history can make
search unnecessarily large.

## Bounds and performance

The default `maxNodes` is 5,000,000. `maxActions` bounds solution depth, while
`maxNodes` bounds memory/work. Hitting `maxNodes` returns `capped: true`; reaching
the depth limit or exhausting the frontier returns `capped: false` with no
solution.

The solver proves minimum action count only for the reducer version, seed,
available actions, filters, and state key used in that run. Record those inputs
when using results to author [star thresholds](scoring.md).

## Zonoid example

Zonoid runs `solveGridLevel` against the same universal reducer used in play
when validating authored boards. The solver enumerates canonical movement,
Use, Talk, Inspect, and targeted actions, finds a minimum-action winning route,
and supplies a baseline for three- and two-star thresholds. Product state such
as fired events, delivered objects, and dialogue evidence stays in the injected
reducer and its state key.

<figure class="mechanism-video">
  <video controls muted playsinline preload="metadata" poster="/mechanisms/push-solver-scoring-centered-poster.jpg" aria-label="Focused Zonoid solver demo board recording">
    <source src="/mechanisms/push-solver-scoring-centered.mp4" type="video/mp4">
    Your browser does not support embedded video.
  </video>
  <figcaption>Focused Zonoid demo board: the solver finds and replays the short push sequence that reaches the objective.</figcaption>
</figure>
