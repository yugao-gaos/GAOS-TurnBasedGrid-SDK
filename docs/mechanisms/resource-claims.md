# Resource-claim arbitration

`arbitrateResourceClaims` resolves actions that were independently legal in a
shared snapshot but cannot all consume or mutate the same resource. Examples
include two actors taking one pickup, overlapping beams consuming a cell, or a
flight and placement both reserving the same destination.

## Neutral all-fail policy

```ts
const result = arbitrateResourceClaims([
  { id: 'take:a', resources: ['pickup:2,1'], claim: actionA },
  { id: 'take:b', resources: ['pickup:2,1'], claim: actionB },
  { id: 'safe', resources: ['pickup:8,1'], claim: actionC },
]);
```

Any claim sharing **any** resource with another claim becomes contested in
full. The SDK does not pick a priority or lexical winner. In this example only
`safe` is accepted.

For a multi-resource claim, conflict on one resource contests the whole action:

```text
beam claims [cell:4, cell:5]
flight claims [cell:5]
→ both actions are contested
```

This avoids partial execution of an atomic action.

## Result ordering

The result contains:

- `accepted`, preserving input claim order;
- `contested`, also preserving input claim order; and
- `conflicts`, a map whose resource keys are inserted in lexical order and
  whose claim-id arrays preserve discovery order.

Duplicate resources inside one claim are deduplicated and do not cause a
self-conflict. Duplicate claim ids throw because trace identity would otherwise
be ambiguous. A claim with no resources is accepted.

## Snapshot discipline

Qualify all candidate actions against the same pre-commit snapshot, build their
complete resource sets, arbitrate once, then commit only `accepted`. Do not
remove resources as claims are enumerated; that would turn the result into
input-order priority.

```ts
const arbitration = arbitrateResourceClaims(qualified);
for (const { claim } of arbitration.accepted) commit(claim);
for (const conflict of arbitration.contested) emitCollision(conflict);
```

## Product responsibilities

The product defines resource identity and what a contested action means. It may
fail, bounce, wait, refund, or enqueue a different effect. If the design needs
initiative or random winner selection, implement that policy outside this
neutral helper and record the chosen result in deterministic state or transcript.

## Zonoid example

Zonoid qualifies pickups, throws, landings, bat flights, and overlapping
effects against one pre-commit world snapshot. If two independent intents claim
the same Relic, destination, or flight cell, the platform passes both claims to
the SDK and accepts neither. This keeps simultaneous turns fair; Zonoid then
emits the appropriate bounce, collision, or no-op event.

<figure class="mechanism-video">
  <video controls muted playsinline preload="metadata" poster="/mechanisms/projectile-resource-use-centered-poster.jpg" aria-label="Focused Zonoid resource claim demo board recording">
    <source src="/mechanisms/projectile-resource-use-centered.mp4" type="video/mp4">
    Your browser does not support embedded video.
  </video>
  <figcaption>Focused Zonoid demo board: the projectile claims its destination only after path and occupancy checks succeed.</figcaption>
</figure>
