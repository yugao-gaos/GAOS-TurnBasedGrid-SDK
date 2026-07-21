# Quickstart

Use the engine by itself, connect to a GAOS-hosted game, or wrap your own
reducer as an agent environment. All three paths come from the same package.

## Install TypeScript

The package is published through GitHub Packages. Add a project or user
`.npmrc`, then authenticate with a GitHub token that has `read:packages`:

```ini
@yugao-gaos:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```sh
npm install @yugao-gaos/turn-based-grid-sdk
```

You can also pin a repository release without configuring the package registry:

```sh
npm install 'git+https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK.git#v0.9.0'
```

## Choose the narrowest entry point

```ts
// Hosted Arena adapter and public wire types
import { ArenaClient } from '@yugao-gaos/turn-based-grid-sdk';

// Product-neutral turn protocol
import { GameRegistry } from '@yugao-gaos/turn-based-grid-sdk/protocol';

// Deterministic mechanics and agent environment
import { resolveMoves } from '@yugao-gaos/turn-based-grid-sdk/engine';

// Keyed model drivers
import { createKeyedAgentDriver } from '@yugao-gaos/turn-based-grid-sdk/agent';

// Node-only CLI launch and status helpers
import { spawnCliAgent } from '@yugao-gaos/turn-based-grid-sdk/agent-cli';
```

The engine and agent entry points do not import a renderer. The engine also
does not depend on any model provider or CLI package.

## Resolve a reusable mechanism

Movement intents qualify together. Static board policy remains an injected
callback:

```ts
import { resolveMoves } from '@yugao-gaos/turn-based-grid-sdk/engine';

const result = resolveMoves(
  [
    { id: 'alpha', from: [0, 0], to: [1, 0], priority: 0 },
    { id: 'beta', from: [2, 0], to: [1, 0], priority: 1 },
  ],
  (x, y) => x < 0 || y < 0,
);

console.log(result.get('alpha')); // [1, 0]
console.log(result.get('beta'));  // [2, 0]
```

For multi-wave consequences, use [`runSettlementCascade`](/settlement). For
the full mechanism catalog and product adapter boundaries, see the
[`./engine` guide](/engine).

## Make your reducer agent-ready

Implement three deterministic operations: initialize state, apply an action,
and project a turn view.

```ts
import {
  AgentEnvironment,
  type GridReducer,
} from '@yugao-gaos/turn-based-grid-sdk/engine';

const reducer: GridReducer<MyLevel, MyState, MyView> = {
  init: (level, seed) => createState(level, seed),
  apply: (state, action) => applyAction(state, action),
  view: (state) => observeState(state),
};

const environment = new AgentEnvironment({
  reducer,
  level,
  seed: 42,
});

let turn = environment.reset();
while (!turn.done) {
  turn = environment.step(await choose(turn.observation, turn.legalActions));
}

console.log(environment.transcript());
```

`MyView` extends the SDK's `GridTurnView`; its action definitions are expanded
into fully parameterized legal actions before an agent chooses. Continue with
[Agentic play](/agentic-play).

## Connect to a hosted Arena

```ts
import { ArenaClient } from '@yugao-gaos/turn-based-grid-sdk';

const arena = new ArenaClient(
  'https://api.zonoid.ai',
  process.env.ARENA_API_KEY,
);

const session = await arena.createSession({
  gameMode: 'challenge',
  playMethod: 'human',
  levelId: 'od-l1',
});

const next = await arena.submitAction(session.sessionId, { id: 'Action 4' });
console.log(next.grid);
```

## Next steps

- Learn [which layer owns each API](/architecture).
- Integrate [same-turn recursive settlement](/settlement).
- Connect [model drivers, tools, and agent CLIs](/agentic-play).
- Use the [Python client and Gym-style environment](/python).
