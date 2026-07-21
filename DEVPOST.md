# GAOS Devpost submission packet

## Category

**Developer Tools**

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

