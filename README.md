# GAOS Turn-Based Grid SDK

TypeScript and Python clients for turn-based games hosted through the GAOS
turn protocol. The repository contains two layers:

- a genre-neutral v1 turn envelope, cursor, retry, and simultaneous-intent
  protocol; and
- Arena-specific clients and observation types for the hosted grid game.

Game rules are not included. The API host or a separately distributed local
engine remains authoritative.

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
npm install 'git+https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK.git#v0.1.1'
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

## Python

Python wheels and source distributions are attached to each GitHub release.
The distribution is named `gaos-turn-based-grid-sdk`; the stable import name
remains `agilabs_arena` for compatibility with existing integrations.

```sh
pip install gaos_turn_based_grid_sdk-0.1.1-py3-none-any.whl
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
