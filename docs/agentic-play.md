# Agentic play

The SDK is AI-native because agents can discover and operate a deterministic
environment without a renderer, a particular model provider, or product-owned
control code.

## Environment contract

`AgentEnvironment` wraps any injected `GridReducer`. One turn contains:

- the complete product observation;
- action definitions and fully parameterized concrete legal actions;
- the last reward and cumulative episode metrics;
- separate `terminated` and `truncated` flags;
- the seed, steps, score, budget usage, and termination reason.

```ts
import { AgentEnvironment } from '@yugao-gaos/turn-based-grid-sdk/engine';

const env = new AgentEnvironment({
  reducer,
  level,
  seed: 42,
  maxSteps: 1_000,
});

let turn = env.reset();
while (!turn.done) {
  const action = await chooseAction(turn.observation, turn.legalActions);
  turn = env.step(action);
}

const transcript = env.transcript();
```

Products may inject reward shaping and custom action enumeration. The default
reward is terminal stars, or `1` for a win without stars. Reducer failure is a
normal termination; reaching `maxSteps` is a safety truncation.

## Evaluation

`runAgentEpisode` accepts synchronous or asynchronous policies.
`evaluateAgentEpisodes` runs a deterministic case list and reports wins,
failures, truncations, mean reward, and mean steps.

```ts
const result = await evaluateAgentEpisodes(
  cases,
  ({ level, seed }) => new AgentEnvironment({ reducer, level, seed }),
  (turn) => myAgent(turn.observation, turn.legalActions),
);
```

## Tool and MCP adapters

`createAgentToolAdapter(environment)` exposes four provider-neutral operations:

- `observe`
- `act`
- `reset`
- `transcript`

The adapter includes JSON input schemas and has no MCP, OpenAI, Anthropic, or
other provider dependency. An MCP server or model tool API can register the
definitions and forward calls to `adapter.call(name, input)`.

## Python

`ArenaEnv` is Gym-style and now exposes `action_definitions` plus
`concrete_actions`. It accepts a concrete action object directly:

```python
from agilabs_arena import ArenaEnv, run_agent_episode

env = ArenaEnv("od-l1", play_method="autonomous_local")
result = run_agent_episode(
    env,
    lambda observation, info: observation["concrete_actions"][0],
)
```

`run_agent_episode` and `evaluate_agent_episodes` accept any duck-typed
Gym-style environment, not only `ArenaEnv`.

## Evaluation actions versus semantic actions

The environment does not require semantic action names. A product can expose
descriptions for ordinary development while using opaque or permuted ids for
evaluations. In both modes the SDK surfaces only actions that are legal in the
current observation.

## Product boundary

The SDK owns the agent loop and deterministic interfaces. Products retain
their levels, characters, abilities, objectives, rewards, hosted session
policy, anti-cheat rules, authentication, and leaderboards.
