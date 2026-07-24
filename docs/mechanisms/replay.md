# Replay verification

`recheckTranscript` verifies an action-label permutation, re-simulates
canonical actions through a deterministic reducer, and compares the recorded
terminal summary with the replayed result.

## Transcript inputs

The header records the level, seed, wire-to-canonical permutation, final status,
stars, action count, and optional transcript visibility. Visibility is `full`
or `seat:<id>`; omission retains full-view compatibility. Each action records
both its externally visible wire id and canonical reducer id plus optional
coordinates, index, `boardId`, `zoneId`, `seat`, a declarative `targets`
tuple, or non-negative integer
`tick`.

```ts
const result = recheckTranscript(reducer, header, transcriptActions);
if (!result.ok) console.error(result.problems);
```

Action labels must use the exact one-based form `Action N`. For each entry, the
checker parses both labels and verifies:

```text
header.perm[wireNumber - 1] === canonicalNumber - 1
```

A bad mapping is reported but does not prevent canonical re-simulation, allowing
one pass to reveal both permutation and outcome problems.

## Re-simulation

The checker initializes the reducer with the recorded level and seed, then
submits canonical actions in array order. Optional `x`, `y`, `index`, `boardId`,
`zoneId`, `seat`, and `targets` fields are copied when present. The first rejected action stops
replay and adds its number, id, and error message to the problem list.

Ticks must be monotonic. Omitted ticks continue the preceding tick, starting
at zero. Pass `applyEmptyTick` as the fourth argument when scheduled product
systems must advance through gaps:

```ts
recheckTranscript(reducer, header, actions, {
  applyEmptyTick: (state, tick) => advanceScheduledSystems(state, tick),
});
```

Without that callback, an empty tick is an identity step.

After replay it compares:

- status;
- stars, normalizing absent values to `null`; and
- `hud.actionsUsed`.

The returned `replayed` summary is available whether verification succeeds or
fails.

## What it does not verify

This helper does not authenticate a transcript, check session ownership,
compare every intermediate event or seat-scoped observation, or prove that the
recorded level definition has not changed. Products
should version or hash content and use server-side signatures when those
properties matter.

## Per-level run seeds

`runLevelSeed(sessionSeed, levelIndex)` derives a deterministic unsigned 32-bit
seed for each level in a multi-level run. Level indices are zero-based. Keep
their ordering stable; inserting a level changes the derived seeds of later
levels unless the product stores an explicit level identity mapping.

## Compatibility rule

A transcript is replayable only with compatible reducer logic, content, action
ids, and randomness. Version those together. Verification should select the
historical adapter before calling this helper rather than replaying old data
through current rules.

## Zonoid example

When a Zonoid scored session finishes, the server stores the level version,
seed, action-label permutation, canonical action log, and terminal summary.
Before a result reaches the official benchmark, Zonoid selects the matching
universal reducer and re-simulates the transcript with this SDK helper. A
desync, rejected action, altered permutation, or forged star count is reported
instead of being accepted as a leaderboard result.

<figure class="mechanism-video">
  <video controls muted playsinline preload="metadata" poster="/mechanisms/replay-poster.jpg" aria-label="Focused Zonoid deterministic replay demo board recording">
    <source src="/mechanisms/replay.mp4" type="video/mp4">
    Your browser does not support embedded video.
  </video>
  <figcaption>Zonoid Story Level 1: the same seed and solver-verified 19-action solution runs twice to completion, producing an identical final state.</figcaption>
</figure>
