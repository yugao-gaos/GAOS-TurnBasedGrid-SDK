# Architecture map

The SDK is organized around one boundary: reusable behavior belongs in the
SDK; authored meaning and product policy stay with the game.

## Package entry points

| Entry point | Purpose | Runtime assumptions |
| --- | --- | --- |
| package root | GAOS-hosted Arena client and Arena observation types | `fetch` |
| `./protocol` | Generic turn envelopes, cursors, idempotency, simultaneous intents, game registry | JSON-serializable values |
| `./engine` | Grid mechanics, geometry, settlement, solver, replay, scoring, agent environment and tools | Injected world/reducer policy |
| `./agent` | Provider-neutral driver contract and keyed HTTP model drivers | `fetch` and a provider key |
| `./agent-cli` | CLI discovery, launch recipes, MCP configuration, subprocess lifecycle | Node.js |
| Python distribution | Hosted client, Gym-style environment, agent evaluation helpers | Python 3.10+, standard library only at runtime |

Choose the narrowest entry point your integration needs. A deterministic game
engine should not need the hosted Arena adapter; an MCP server should not need
to depend on a model provider.

## Mechanism map

| Concern | SDK mechanism | Product supplies |
| --- | --- | --- |
| Movement | simultaneous destinations, footprints, collisions, rotations, swaps, priority | terrain and static-blocker policy |
| Turn consequences | ordered worklist, waves, coalescing, once-only work, deferral, convergence guard, causal trace | job meaning, mutations, stable keys and priorities |
| Propagation | breadth-first once-per-identity chain reactions | neighbors and effects |
| Projectiles and pushes | path advancement, flight passes, atomic push planning and commit order | collision, damage, landing and visuals |
| Gates and triggers | latch/automatic transitions, authored-order one-shot triggering | sources, conditions, effects and persistence |
| Rays and visibility | ordered ray traversal, Bresenham lines, line of sight, cone geometry | blockers, hits, damage and visibility policy |
| Transport | link components, directed proposals, bounded runs and interlocks | power, occupancy and world mutation |
| Decisions | generic behavior-tree traversal and shortest-path search | conditions, leaf actions and traversability |
| Outcomes | star calculation and budget-failure precedence | thresholds and budgets |
| Verification | seeded randomness, solving, transcript re-simulation | reducer, levels and action schema |

Read [Reusable grid engine](/engine) for API contracts and examples.

## One deterministic core

```text
                  product content and policy
                            |
                     GridReducer adapter
                            |
          +-----------------+-----------------+
          |                 |                 |
       gameplay          solver/replay   AgentEnvironment
          |                                   |
      renderer/API                    tools + model drivers
                                             |
                                       MCP-capable CLIs
```

The reducer adapter prevents local agents, hosted sessions, replay verification,
and ordinary gameplay from drifting into separate rule implementations.

## SDK versus product ownership

### SDK

- deterministic algorithms and ordering;
- reusable mechanism state transitions;
- generic turn and agent lifecycle contracts;
- replay, solver, scoring behavior, tools and integration adapters; and
- provider and CLI extension points.

### Product

- characters, abilities, items, dialogue, levels, objectives and game modes;
- board tokens, numeric tuning, thresholds and reward policy;
- prompts, matchmaking, authentication, persistence and anti-cheat rules; and
- rendering, animation, sound, seasonal content and server-only policy.

The SDK may report that a ray stopped at a cell. The product decides whether
that cell is a wall, a shield, a character, or a visual-only effect. The SDK
may settle a trigger in authored order. The product decides what the condition
means and which mutation follows.

## Why this is AI-native

Agent support is part of the engine contract, not a UI automation layer:

1. A seeded reducer produces deterministic observations and outcomes.
2. The environment exposes complete, concrete legal actions.
3. Illegal model output is rejected before reaching the reducer.
4. Every decision produces a versioned transcript suitable for replay.
5. The same cases can be evaluated across local policies, keyed models, or
   MCP-capable CLIs.

That makes agent play reproducible, provider-neutral, headless, and directly
comparable with human or renderer-driven play.
