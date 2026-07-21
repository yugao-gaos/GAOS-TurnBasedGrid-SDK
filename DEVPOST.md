# GAOS Devpost submission packet

## Category

**Developer Tools**

## One-line elevator pitch — ready to paste

GAOS (Gaming AGI Open SDK) is an open-source, community-driven SDK for building
game-as-benchmark arenas where humans and AI agents compete on equal terms and
are evaluated by the same standards to help advance AGI.

## Project description — ready to paste

GAOS (Gaming AGI Open SDK) is an Apache-2.0 TypeScript and Python toolkit for
building deterministic, simultaneous turn-based grid games that humans and AI
agents can play through the same authoritative rules. It packages reusable
grid mechanics—including movement, recursive turn settlement, pathfinding and
FOV, push chains, projectiles, transport, gates, triggers, scoring, solving,
and replay verification—with an AI-native runtime for concrete legal actions,
seeded episodes, transcripts, batch evaluation, model drivers, MCP tools, and
extensible agent CLIs. This turns games into reproducible behavioral
benchmarks: candidates face identical observations, rules, seeds, and
consequences, while developers can inspect scores, decision traces, and failure
modes. [Zonoid](https://zonoid.ai) is the production reference and live judge
experience, but its pre-existing platform repository is outside the submission
scope. The SDK was created during OpenAI Build Week with Codex and GPT-5.6 Sol
across architecture, coding, review, asset production, publishing, and LLM-play
testing.

## Inspiration

Most AI benchmarks test one answer. We wanted to test sustained behavior:
planning, adapting, recovering from mistakes, and handling consequences. Games
make that measurable through shared rules, repeatable scenarios, scores, and
complete decision traces.

Simultaneous turn-based grids give humans and agents the same state and action
window, removing reaction speed, network latency, and request order from the
contest. Each turn instead tests prediction, spatial reasoning, coordination,
and opponent modeling. GAOS grew from this idea while building Zonoid Labs AGI
Arena.

## What it does

GAOS is an open-source TypeScript and Python toolkit for deterministic,
simultaneous turn-based grid games. One authoritative engine provides movement,
recursive settlement, pathfinding, FOV, pushing, projectiles, transport, gates,
triggers, pickups, scoring, solving, and replay verification. Agent environments,
model drivers, MCP tools, and extensible CLIs add legal actions, seeded episodes,
transcripts, and batch evaluation without graphical UI automation.

The submitted project is GAOS. The Zonoid platform repository is outside the
submission scope, but it was central to production: as the game evolved and
created new requirements, GAOS evolved to generalize, implement, and test the
reusable capabilities needed to meet them.

## How we built it

We extracted Zonoid's product-neutral rules into an Apache-2.0 SDK and built one
deterministic reducer for gameplay, solvers, replays, and agents. We added
TypeScript and Python interfaces, provider-independent model drivers, MCP and
CLI integrations, tests, packages, releases, CI, and a VitePress site.

Codex with GPT-5.6 Sol supported concepting through built-in image generation
and editing; production direction for Seedance, World Labs, and Tripo 3D;
autonomous review and revision; SDK and game coding; documentation and website
publishing; and LLM-play testing. People retained final judgment over scope,
gameplay, visual approvals, and releases.

## Challenges we ran into

The first challenge was the SDK boundary: reusable mechanics, settlement,
scoring, solving, and agent contracts belong in GAOS; Zonoid-specific
characters, campaigns, levels, and seasonal rules do not. The second was
recursive resolution. A move can trigger collisions, pickups, switches, gates,
transport, or more movement, so deterministic settlement must continue in
ordered waves until the state is quiet. We also had to keep model and CLI
extensions provider-neutral.

## Accomplishments that we're proud of

We shipped a public Apache-2.0 repository, a documented v0.9.1 release, prebuilt
npm and Python packages, detailed mechanism pages, replayable transcripts,
solver and scoring support, MCP tools, and extensible model and CLI drivers. Its
deterministic engine is backed by 98 TypeScript and 13 Python tests. Most
importantly, humans, agents, solvers, replays, and Zonoid share one authoritative
reducer—agent support is part of the game contract, not a later automation layer.

## What we learned

AI-native games need a clear state-and-action contract, not screen automation.
Determinism also requires explicit ordering, IDs, seeds, versions, and recursive
effects—not simply removing randomness. Separating the SDK lets Zonoid focus on
authored experiences while GAOS becomes easier to test and extend. The two
projects improve each other through a continuous requirements-and-validation
loop.

## What's next for Zonoid Labs AGI Arena

We will open registration and downloads, expand held-out tasks, multiplayer
evaluation, and leaderboards, and report richer measures such as consistency,
efficiency, recovery, and failure modes. As Zonoid introduces new gameplay and
research needs, reusable solutions will continue to strengthen GAOS. We will
also move the SDK toward 1.0, welcome community contributions, and publish
research data from Zonoid while keeping its product content outside the SDK.

## Required URLs and identifiers

- **Public code repository:**
  https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK
- **Documentation:**
  https://yugao-gaos.github.io/GAOS-TurnBasedGrid-SDK/
- **Live game and prebuilt download:** https://zonoid.ai
- **Latest SDK release:**
  https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/releases/tag/v0.9.1
- **Codex `/feedback` Session ID:**
  `019f8458-7a8d-7010-9227-500c99df5e04`
- **License:** Apache License 2.0

The GAOS SDK is the submitted project. The pre-existing Zonoid platform
repository is outside the submission scope, but it was deeply relevant to
production: new game requirements drove reusable SDK capabilities, which were
then validated through the evolving game.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 Sol participated across the complete production loop:

1. **Concept development:** Used built-in image generation and editing to turn
   early game and character ideas into visual directions that could be judged
   and revised.
2. **Specialist asset production:** Helped translate approved concepts into
   prompts and production instructions for Seedance video, World Labs worlds,
   and Tripo 3D models.
3. **Autonomous review and revision:** Inspected implementations and outputs,
   identified inconsistencies and regressions, proposed corrections, and
   repeated review after changes.
4. **Game and SDK engineering:** Implemented and tested the game, extracted the
   reusable SDK boundary, built deterministic multi-wave settlement and grid
   mechanisms, and added agent environments, model drivers, MCP tools, and
   extensible CLI integrations.
5. **Publishing:** Produced the README, mechanism reference, mission and
   benchmark thesis, release documentation, GitHub Pages site, packages, and
   presentation material.
6. **Agent-play testing:** Because GAOS exposes structured observations and
   concrete legal actions, LLM agents could play the same reducer used by the
   game, generating replayable transcripts for functional and behavioral tests.

The detailed case study is available at
[Building GAOS and Zonoid with GPT-5.6 Sol](https://yugao-gaos.github.io/GAOS-TurnBasedGrid-SDK/building-with-gpt-5-6-sol).

## Installation without rebuilding the SDK

### TypeScript / Node.js

Install the prebuilt public v0.9.1 release archive without a GitHub token:

```sh
mkdir gaos-judge
cd gaos-judge
npm init -y
npm install 'https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/releases/download/v0.9.1/yugao-gaos-turn-based-grid-sdk-0.9.1.tgz'
```

Verify an engine import and deterministic score:

```sh
node --input-type=module -e "import { scoreStars } from '@yugao-gaos/turn-based-grid-sdk/engine'; console.log(scoreStars(6, { three: 6, two: 9 }))"
```

Expected output: `3`.

### Python

Install the prebuilt public wheel:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install 'https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/releases/download/v0.9.1/gaos_turn_based_grid_sdk-0.9.1-py3-none-any.whl'
.venv/bin/python -c "import agilabs_arena; print(agilabs_arena.__name__)"
```

Expected output: `agilabs_arena`. On Windows, use
`.venv\Scripts\python` instead of `.venv/bin/python`.

## Supported platforms

| Surface | Support |
|---|---|
| TypeScript engine, protocol, and agent runtime | ES2022 ESM; Node.js 22 recommended and CI-tested |
| Hosted clients and keyed model drivers | ES2022 ESM runtime with standards-compatible `fetch` |
| Agent CLI launchers | Node.js 22; macOS and Linux tested; the selected external CLI must also be installed |
| Python client and environment | Python 3.10+; Python 3.12 CI-tested |
| Source CI | Ubuntu GitHub Actions; local development also verified on macOS |

The core TypeScript and Python libraries contain no renderer and are not tied
to Godot or the Zonoid platform repository.

## Testing from source

```sh
git clone https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK.git
cd GAOS-TurnBasedGrid-SDK
npm ci
npm run typecheck
npm test
npm run build
npm run docs:build
```

Python verification:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install build pytest
PYTHONPATH=python .venv/bin/python -m pytest python/tests
.venv/bin/python -m build python
```

Live integration tests use `ARENA_BASE_URL` and skip automatically when a
compatible hosted game is unavailable. Unit tests, engine tests, solver/replay
tests, agent tests, and packaging checks run without Zonoid credentials.

## Judge test path

1. Use the public release instructions above to test the SDK without rebuilding
   it from source.
2. Visit [zonoid.ai](https://zonoid.ai), register with a judge email, and
   download the prebuilt live game to see GAOS used by a complete product.
3. Use the [mechanism reference](https://yugao-gaos.github.io/GAOS-TurnBasedGrid-SDK/mechanisms/)
   to inspect each engine guarantee and its product boundary.
4. Use the source commands when full test-suite verification is desired.
