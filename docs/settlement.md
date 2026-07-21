# Deterministic turn settlement

A submitted turn may contain many resolution steps. The SDK calls those steps
**waves**: wave 0 contains the submitted or derived intents, and consequences
produced by one wave are eligible to run in a later wave of the same turn.
Settlement ends when the same-turn worklist is empty.

This is a cascade, not a loop that blindly reruns the complete game reducer.
Each product rule decides whether a consequence belongs to the current turn or
must be deferred to the next one.

```text
submitted intents
       |
       v
simultaneous movement snapshot
       |
       v
wave 0 -> wave 1 -> wave 2 -> ... -> quiescence
            |          |
            |          +-- collision -> landing -> arrival
            +------------- movement -> switch -> environment update
       |
       +-- explicitly deferred work ----------------> next turn
```

## Kernel boundary

`runSettlementCascade` owns product-neutral execution behavior:

- deterministic ordering within every wave;
- same-turn consequence scheduling;
- pending-work coalescing and once-per-turn identities;
- explicit next-turn deferral;
- a maximum-step convergence guard; and
- a causal trace linking each resolved job to the step that scheduled it.

The product owns rule policy and world meaning:

- which intent or mutation creates a job;
- how a job reads or mutates product state;
- the job priority and stable identity;
- whether duplicate work repeats, coalesces while pending, or runs once;
- which consequences are same-turn and which are next-turn; and
- snapshot qualification and commit rules for simultaneous effects.

The kernel does not infer dependencies from state mutations. A rule explicitly
enqueues its consequences, which keeps replay behavior inspectable and prevents
an unrelated board update from accidentally rerunning every mechanic.

## Scheduling policies

Jobs choose one of three policies:

- `repeat`: every enqueue is a distinct resolution step;
- `coalesce`: duplicate pending work with the same identity is merged, but the
  identity may be scheduled again after it runs; this supports dirty-resource
  fixed points; and
- `once`: the identity may run only once during this settlement call.

An identity is the pair `kind + key`. Products can express narrower scopes by
choosing an appropriate key, such as an arrival id, entity id, resource cell,
or rule id.

Work that must not resolve in the current turn uses `defer`. Deferred jobs are
returned to the caller and are never executed by that settlement call.

## Required product invariants

A product integration should characterize these boundaries before replacing an
existing loop:

1. Which consequences can create more same-turn work?
2. Which state is frozen for simultaneous qualification?
3. Which mutations are committed only after qualification?
4. Which jobs may run more than once, and what proves convergence?
5. Which landings or updates deliberately wait for the next turn?
6. What deterministic key orders otherwise independent work?

The maximum-step limit is a safety guard, not a game rule. A normal turn should
reach quiescence before the limit; exceeding it reports a cycle or a missing
convergence condition.
