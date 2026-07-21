---
layout: home

hero:
  name: GAOS Turn-Based Grid SDK
  text: Deterministic mechanics for agent-ready games
  tagline: Build, solve, replay, and evaluate turn-based grid environments without coupling reusable rules to a particular campaign or renderer.
  actions:
    - theme: brand
      text: Start building
      link: /quickstart
    - theme: alt
      text: Explore the engine
      link: /engine

features:
  - title: Deterministic by construction
    details: Resolve simultaneous movement, consequence cascades, transport, projectiles, gates, triggers, rays, and scoring with replayable outcomes.
  - title: AI-native, not AI-attached
    details: Expose concrete legal actions, deterministic seeds, transcripts, batch evaluation, model drivers, and MCP-capable CLI launchers from one environment contract.
  - title: Product-neutral mechanisms
    details: The SDK owns how reusable mechanics behave. Your product retains characters, levels, objectives, tuning, authentication, and presentation.
---

## One reducer, every way to play

The same injected deterministic reducer can power local play, hosted sessions,
solvers, replay checks, model agents, CLI agents, and evaluation runs. There is
no second, approximate implementation just for automation.

```text
Product reducer + authored content
              |
              v
   GAOS deterministic engine
       /       |        \
  renderer   solver   AgentEnvironment
                         |
                 tools / drivers / CLIs
```

## A deliberate ownership boundary

<div class="ownership-grid">
  <div class="ownership-card">
    <h3>SDK owns</h3>
    <p>Reusable algorithms, deterministic ordering, settlement, protocol primitives, replay, scoring behavior, agent lifecycle, and integration contracts.</p>
  </div>
  <div class="ownership-card">
    <h3>Your product owns</h3>
    <p>Characters, abilities, authored levels, game modes, objectives, thresholds, world tokens, prompts, hosting policy, seasons, and presentation.</p>
  </div>
</div>

The rule is simple: the SDK defines **how a reusable mechanism behaves**. The
product decides **where it is used and what it means**.

[See the architecture map →](/architecture)
