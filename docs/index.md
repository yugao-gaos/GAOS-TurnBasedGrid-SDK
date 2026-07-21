---
layout: home

hero:
  name: GAOS Turn-Based Grid Toolkit
  text: Gaming AGI Open SDK
  tagline: Games as benchmarks for human and AI agents.
  actions:
    - theme: brand
      text: Start building
      link: /quickstart
    - theme: alt
      text: Explore the engine
      link: /mechanisms/
    - theme: alt
      text: Why games?
      link: /mission

features:
  - title: Deterministic by construction
    details: Resolve simultaneous movement, consequence cascades, transport, projectiles, gates, triggers, rays, and scoring with replayable outcomes.
  - title: AI-native, not AI-attached
    details: Expose concrete legal actions, deterministic seeds, transcripts, batch evaluation, model drivers, and MCP-capable CLI launchers from one environment contract.
  - title: Product-neutral mechanisms
    details: The SDK owns how reusable mechanics behave. Your product retains characters, levels, objectives, tuning, authentication, and presentation.
---

**Deterministic grid mechanics and multiplayer infrastructure for agent-ready games.**

## Our mission

**Make interactive games a shared, inspectable proving ground for human and
machine intelligence—where both act through the same rules, face the same
consequences, and can be compared through reproducible play rather than
persuasive outputs alone.**

Games measure behavior across a sequence of consequential choices. Grids keep
that behavior structured and inspectable. Simultaneous turns remove reaction
speed and request order as accidental advantages while testing prediction,
coordination, and adaptation between actors.

[Why games—and why simultaneous turn-based play—make strong benchmarks →](/mission)

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

[How we built GAOS and Zonoid with GPT-5.6 Sol →](/building-with-gpt-5-6-sol)

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

[Read the complete mechanism reference →](/mechanisms/)

[See the architecture map →](/architecture)
