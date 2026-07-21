# GAOS Turn-Based Grid SDK

An AI-native SDK for deterministic, turn-based grid environments. It provides
TypeScript and Python clients for games hosted through the GAOS turn protocol,
plus a reusable TypeScript engine and provider-neutral agent runtime. The
repository contains six layers:

- a genre-neutral v1 turn envelope, cursor, retry, and simultaneous-intent
  protocol; and
- Arena-specific clients and observation types for the hosted grid game; and
- reusable movement, pathfinding, sight geometry, scoring, shortest-path
  solving, and replay verification through the `./engine` package subpath; and
- deterministic agent episodes with concrete action discovery, Gym-style
  termination, rewards, transcripts, batch evaluation, and portable tool
  definitions; and
- extensible keyed-model drivers for Anthropic, OpenAI, xAI, and OpenRouter;
  and
- reusable launch recipes and a standalone CLI for Claude Code, Ollama-backed
  Claude Code, Codex, Cursor, Grok, OpenCode, and declarative custom agents.

Product content and policy are not included. Zonoid characters and abilities,
campaign game types, authored levels, and seasonal/server rules stay in the
platform repository.

## TypeScript

The npm package is published through GitHub Packages. Configure the GitHub npm
registry and authenticate with a token that can read packages:

```ini
@yugao-gaos:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```sh
npm install @yugao-gaos/turn-based-grid-sdk
```

Repositories with GitHub access can instead pin an exact release tag without
configuring the npm registry:

```sh
npm install 'git+https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK.git#v0.8.0'
```

Use the hosted Arena client:

```ts
import { ArenaClient } from '@yugao-gaos/turn-based-grid-sdk';

const arena = new ArenaClient('https://api.zonoid.ai', process.env.ARENA_API_KEY);
const session = await arena.createSession({
  gameMode: 'challenge',
  playMethod: 'human',
  levelId: 'od-l1',
});

const next = await arena.submitAction(session.sessionId, { id: 'Action 4' });
console.log(next.grid);
```

Protocol-only hosts can use the subpath without importing Arena adapter types:

```ts
import {
  GameRegistry,
  collectIntent,
  createIntentWindow,
} from '@yugao-gaos/turn-based-grid-sdk/protocol';
```

Deterministic runtimes can consume the reusable engine without importing the
hosted Arena client:

```ts
import {
  planPushChain,
  resolveMoves,
  resolveChainReaction,
  runSettlementCascade,
  scoreStars,
  solveGridLevel,
} from '@yugao-gaos/turn-based-grid-sdk/engine';
```

The product supplies its reducer, levels, character catalog, ability data, and
scoring thresholds. See [Engine boundary](docs/engine.md) for the ownership and
adapter contracts, and [Deterministic turn settlement](docs/settlement.md) for
multi-step same-turn consequence resolution.

Run an agent locally against any injected deterministic reducer:

```ts
import {
  AgentEnvironment,
  runAgentEpisode,
} from '@yugao-gaos/turn-based-grid-sdk/engine';

const environment = new AgentEnvironment({ reducer, level, seed: 42 });
const episode = await runAgentEpisode(
  environment,
  async (turn) => agent.choose(turn.observation, turn.legalActions),
);

console.log(episode.transcript.result);
```

See [Agentic play](docs/agentic-play.md) for local, hosted, batch-evaluation,
Python, and tool/MCP integration patterns.

Run a keyed model directly through the reusable driver contract:

```ts
import {
  createKeyedAgentDriver,
  runAgentDriverEpisode,
} from '@yugao-gaos/turn-based-grid-sdk/agent';

const driver = createKeyedAgentDriver('openai', {
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'your-model-id',
});
const result = await runAgentDriverEpisode(environment, driver);
```

Or use the installed executable. Keys are read from provider environment
variables and are never accepted on the command line:

```sh
gaos-agent drivers
gaos-agent check openai
gaos-agent run openai --module ./environment.mjs --model your-model-id
gaos-agent spawn codex --mcp-url http://127.0.0.1:9000/mcp --prompt "Complete the episode"
OLLAMA_MODEL=qwen3.5 gaos-agent spawn ollama --mcp-url http://127.0.0.1:9000/mcp --prompt "Complete the episode"
```

Node applications can import CLI launch/status APIs from the `./agent-cli`
subpath. The core `./engine` and `./agent` subpaths do not depend on a CLI or a
provider package.

## Python

Python wheels and source distributions are attached to each GitHub release.
The distribution is named `gaos-turn-based-grid-sdk`; the stable import name
remains `agilabs_arena` for compatibility with existing integrations.

```sh
pip install gaos_turn_based_grid_sdk-0.8.0-py3-none-any.whl
```

```python
from agilabs_arena import ArenaClient

arena = ArenaClient("https://api.zonoid.ai", api_key="ak_...")
session_id, turn = arena.create_session(
    game_mode="challenge",
    play_method="human",
    level_id="od-l1",
)
print(turn.grid)
```

See [the Python guide](python/README.md) for the Gymnasium-style environment
and hosted Arena matchmaking API.

## Protocol boundary

The stable `agilabs.turns` v1 contract owns session cursors, idempotent command
submissions, pending/resolved envelopes, and deterministic collection of
simultaneous intents. It deliberately does not define grids, actions, scoring,
authentication, persistence, or game rules.

See [Protocol v1](docs/protocol-v1.md) for the compatibility contract.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build

cd python
PYTHONPATH=. python3 -m pytest tests
python3 -m build
```

Live integration tests use `ARENA_BASE_URL` and skip automatically when a
compatible API host is not available.

## Releases

Package versions follow semantic versioning. A GitHub release with tag
`vX.Y.Z` validates both SDKs, publishes the npm package to GitHub Packages, and
attaches the Python wheel and source distribution to the release.
