# Turn order and lockstep

`TurnOrderState` is a neutral sequential-seat cursor. It tracks seat order,
direction, one-based turn and round counters, queued skips, and FIFO extra
turns without owning phases, actions, reactions, or elimination rules.

```ts
let order = createTurnOrder(['north', 'south']);
order = queueSkip(order, 'south');
order = advanceTurn(order); // north remains active; south's skip is consumed
order = queueExtraTurn(order, 'north');
```

The helpers are immutable:

- `advanceTurn` consumes a queued extra turn before rotating normally and
  consumes queued skips while searching for an eligible seat;
- `reverseTurnOrder` changes direction without moving the current seat;
- `eliminateSeat` removes a seat and advances when it was active;
- `reorderSeats` preserves the active seat while accepting a permutation of
  the current seats; and
- `activeSeat` returns the current seat or throws when none remain.

Products own the exact moment an action, response window, or phase advances
the cursor. Store the returned order in authoritative state so replay observes
the same sequence.

## Participation and outcomes

`TurnView.participation` explicitly distinguishes:

```ts
{ mode: 'sequential', activeSeat: 'north' }
{ mode: 'simultaneous', seats: ['north', 'south'] }
```

The older `activeSeat` field remains sequential compatibility sugar.
Multi-seat games may report `outcome: { kind: 'ongoing' }` or a decided
ranking. Rankings use ascending rank and may include a per-seat score; tied
seats share a rank. Required solo `status` remains available for old
consumers.

## Deterministic lockstep

`LockstepInput` groups authored actions by integer tick and seat.
`canonicalizeLockstepInputs` orders groups by tick and then by lexical seat id,
while preserving the action order inside each group. `resimulate` starts from
a supplied rollback snapshot and applies that canonical stream:

```ts
const state = resimulate(reducer, rollbackSnapshot, inputs, {
  applyEmptyTick: (state, tick) => advanceScheduledSystems(state, tick),
});
```

When ticks have gaps, `applyEmptyTick` is called for each missing tick. Without
that callback, empty ticks intentionally have no effect. A supplied action may
omit `seat` and receive its group seat; a conflicting seat is rejected.
When the reducer implements `applyIntents`, every canonical action at one tick
is passed as a single atomic batch. Legacy reducers without that method receive
the same actions serially in canonical order.

`stateDigest(state)` provides a compact deterministic FNV-1a digest over JSON
by default. For authoritative networking, provide a canonical serializer that
sorts unordered maps and excludes presentation-only data. Compare digests only
between compatible reducer, content, serializer, and numeric-runtime versions.

Time is input: wall clocks, frame duration, and scheduler timing must not alter
reducer state unless converted to an explicit tick action or deterministic
state value. Mint ids from deterministic counters or seeded streams, not
process randomness. Avoid engine-dependent transcendental floating-point math
in cross-runtime lockstep, or quantize its result before it reaches state.
