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
consequences, while developers can inspect not only scores but decision traces
and failure modes. [Zonoid](https://zonoid.ai) is the first game built with GAOS
and provides the live judge experience. The SDK was created during OpenAI Build
Week with Codex and GPT-5.6 Sol, which helped design the architecture,
implement and review code, generate and revise production assets, publish
documentation and releases, and test the game through LLM play.

## Inspiration

Most AI benchmarks measure whether a model can produce a correct answer once.
We wanted to measure whether an agent can keep making coherent decisions as a
world changes around it: planning ahead, adapting to other players, recovering
from mistakes, and living with the consequences of earlier actions. Games make
that behavior observable through shared rules, repeatable scenarios, scores,
and complete decision traces.

A simultaneous turn-based grid is especially useful for this purpose. Humans
and agents receive the same state and action window, so reaction speed, network
latency, and request order do not decide the outcome. Every turn instead tests
prediction, spatial reasoning, coordination, and opponent modeling. Zonoid
Labs AGI Arena began as the game built around that idea; GAOS emerged when we
separated its reusable mechanics and agent interface from its product-specific
characters, levels, and live service.

## What it does

GAOS is an open-source toolkit for building deterministic, simultaneous
turn-based grid games that humans and AI agents can play through the same
authoritative engine. Its TypeScript core provides movement, recursive
multi-wave turn settlement, pathfinding and field of view, push chains,
projectiles, transport, gates, triggers, pickups, scoring, solving, and replay
verification. Its protocol, agent environment, model drivers, MCP tools, and
extensible CLIs expose concrete legal actions, seeded episodes, transcripts,
and batch evaluation without requiring agents to automate a graphical UI.

Zonoid Labs AGI Arena is the first game built with GAOS and the live reference
experience for judges. The submitted project is the GAOS SDK; the pre-existing
Zonoid platform repository is outside the submission scope.

## How we built it

We identified the product-neutral rules inside Zonoid and extracted them into
a standalone Apache-2.0 SDK. We built one deterministic reducer for gameplay,
solvers, replay verification, and agent play, then added TypeScript and Python
interfaces, provider-independent model drivers, MCP tools, CLI integrations,
tests, packaging, GitHub Actions, releases, and a VitePress documentation site.

Codex with GPT-5.6 Sol supported the entire production loop. Its built-in image
generation and editing helped develop the visual concepts. GPT then helped turn
approved concept images into production prompts and direction for Seedance
video, World Labs worlds, and Tripo 3D models. It autonomously reviewed and
revised outputs, coded both the SDK and game, created online documentation and
presentation sites, and tested the product through LLM play. Human direction
remained responsible for product scope, gameplay semantics, visual approvals,
and release decisions.

## Challenges we ran into

The hardest architectural problem was finding the correct boundary: reusable
grid mechanics, settlement, scoring, solving, and agent contracts belong in
the SDK, while Zonoid-specific characters, abilities, campaigns, authored
levels, and seasonal rules belong in the product.

Turn resolution also could not be treated as a single pass. One movement can
cause a collision, pickup, switch press, gate update, transport, or another
movement, so settlement must advance through deterministic waves until the
state becomes quiet. We had to define snapshot qualification, collision and
resource-claim ordering, stable identities, and next-turn deferral carefully
enough that a renderer, server, solver, replay verifier, and agent all reach
the same result. A further challenge was making model and CLI integrations easy
to extend without coupling the engine to one AI provider.

## Accomplishments that we're proud of

We shipped a public Apache-2.0 repository, a documented v0.9.1 release with
prebuilt npm and Python packages, and a working deterministic engine backed by
98 TypeScript tests and 13 Python tests. GAOS now has detailed pages for every
mechanism, a protocol and agent runtime designed together with the engine,
replayable transcripts, solver and scoring support, MCP tools, and extensible
keyed-provider and CLI drivers.

The accomplishment that matters most is architectural: humans, agents,
solvers, replays, and the live Zonoid game can all rely on the same
authoritative reducer. Agent support is therefore part of the game contract,
not an automation layer added after the game was finished.

## What we learned

An AI-native game must begin with a clear state-and-action contract rather than
screen automation. Determinism requires more than removing randomness: event
ordering, stable IDs, seeds, protocol versions, and recursive effects must all
be explicit. Simultaneous turns proved valuable because they preserve strategic
interaction while making comparisons fairer and easier to reproduce.

We also learned that extracting an SDK improves both sides of the boundary. The
game can focus on authored experiences while the reusable engine becomes easier
to test, document, and extend. Codex and GPT-5.6 were most effective when they
could work across concepting, implementation, review, publishing, and agent-play
testing while people retained final judgment over intent and release quality.

## What's next for Zonoid Labs AGI Arena

We will open registration and prebuilt downloads so judges and public players
can experience the live game directly. We plan to expand the held-out task
suites, seeds, multiplayer evaluations, and leaderboards; report richer
behavioral measures such as consistency, invalid-action rate, efficiency,
recovery, and failure modes; and add more reference games, mechanisms, adapters,
and CLI providers. In parallel, we will stabilize GAOS toward 1.0 and invite
community contributions while keeping Zonoid's product content separate from
the open SDK.

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
repository is outside the submission scope; Zonoid is the first hosted game
built with GAOS and the judge-facing demonstration.

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
