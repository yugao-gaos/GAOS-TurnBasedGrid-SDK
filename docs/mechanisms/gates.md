# Gates

`resolveGateTransition` is a pure state machine for abstract open/closed gates.
The product supplies activation and occupancy after resolving its switches,
links, power, pressure plates, or other sources.

## Modes

- `latch`: activation opens a closed gate permanently. Loss of activation does
  not close it.
- `automatic`: activation opens the gate; loss of activation closes it only
  when the gate cell is unoccupied.

## Transition table

| Current | Active | Occupied | Mode | Result |
|---|---:|---:|---|---|
| closed | true | any | either | open / `opened` |
| closed | false | any | either | unchanged |
| open | true | any | either | unchanged |
| open | false | any | latch | unchanged |
| open | false | false | automatic | closed / `closed` |
| open | false | true | automatic | unchanged |

Omitted `occupied` behaves as false. Occupancy protects only automatic closing;
it does not prevent an active closed gate from opening.

```ts
const next = resolveGateTransition({
  mode: gate.mode,
  state: gate.state,
  active: linkedSources.some((source) => source.active),
  occupied: actors.some((actor) => sameCell(actor.at, gate.at)),
});

if (next.changed) {
  gate.state = next.state;
  events.push({ type: next.transition, gateId: gate.id });
}
```

## Settlement integration

Gate activation often participates in a same-turn cycle: movement presses a
switch, linked state updates, a gate opens, transport advances, then the switch
changes again. Run transitions as explicit jobs or inside a bounded
[transport interlock](transport.md), not through an unbounded global update loop.

Evaluate occupancy from committed authoritative state at the moment closing is
considered. Animation position should never decide whether a gate can close.

## Product responsibilities

The SDK does not define source lookup, AND/OR link logic, keys, locks, gate
cells, crushing, pathfinding updates, sounds, or animation. It returns the next
abstract state plus `changed` and a nullable transition so products can commit
and present the result exactly once.

