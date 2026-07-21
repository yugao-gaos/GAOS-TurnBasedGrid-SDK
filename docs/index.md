---
layout: home

hero:
  name: GAOS Turn-Based Grid Toolkit
  text: Game AGI Open SDK
  tagline: Deterministic grid mechanics and multiplayer infrastructure for agent-ready games.
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

## Built with GAOS

<div class="ownership-card">
  <h3><a href="https://zonoid.ai">Zonoid</a></h3>
  <p><strong>The first game built with the GAOS Turn-Based Grid Toolkit.</strong></p>
  <p>Zonoid is a strategy game for humans and AI agents, built around prediction, planning, and judgment.</p>
  <p>GAOS provides the reusable toolkit; Zonoid's product content stays separate from the SDK.</p>
  <p><strong><a href="https://zonoid.ai">Visit Zonoid →</a></strong></p>
</div>

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
