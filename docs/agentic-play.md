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

## Keyed model drivers

The `./agent` subpath includes a provider-neutral `AgentDriver` contract and
an extensible `AgentDriverRegistry`. `runAgentDriverEpisode` connects any
driver to `AgentEnvironment`, records each decision, and returns the normal
deterministic transcript.

```ts
import {
  AgentDriverRegistry,
  createKeyedAgentDriver,
  runAgentDriverEpisode,
} from '@yugao-gaos/turn-based-grid-sdk/agent';

const driver = createKeyedAgentDriver('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'your-model-id',
});

const registry = new AgentDriverRegistry([driver]);
const result = await runAgentDriverEpisode(
  environment,
  registry.require('anthropic'),
  { guidance: ['Prefer the shortest winning route.'] },
);
```

Built-in keyed providers are Anthropic, OpenAI, xAI, and OpenRouter. The
OpenAI-compatible driver also accepts a custom base URL and headers. Provider
registries can add or replace definitions without changing the episode loop.
Provider calls use `fetch`, so tests can inject an offline implementation.

Model responses are parsed into the same `GridSubmittedAction` contract and
must exactly match a concrete legal action before the reducer sees them. API
keys are held only by driver instances, are redacted from request failures,
and are not written to transcripts.

## Installed agent CLIs

The Node-only `./agent-cli` subpath owns reusable recipes for MCP-capable agent
CLIs:

- Claude Code
- Ollama + Claude Code
- Codex CLI
- Cursor CLI
- Grok CLI
- OpenCode CLI

The Ollama recipe uses Ollama's official `launch claude` integration: Ollama
hosts the selected local model while Claude Code supplies the headless MCP
agent loop. Install both Ollama and Claude Code, then select a model with
`OLLAMA_MODEL` (default `qwen3.5`):

```sh
OLLAMA_MODEL=qwen3.5 gaos-agent spawn ollama \
  --mcp-url http://127.0.0.1:9000/mcp \
  --prompt "Complete the episode" \
  --tools observe,act
```

The launch is keyless for local models. `ollama run` is intentionally not used
because it is an interactive model prompt, not an MCP agent runtime.

It can resolve executables, run non-token-consuming auth probes, build MCP
configuration, parse transcript streams, and spawn each CLI in a temporary
working directory. Product code supplies the MCP URL, prompt, server name,
and allowed tool names:

```ts
import {
  createDefaultCliAgentRegistry,
  inspectCliAgent,
  spawnCliAgent,
} from '@yugao-gaos/turn-based-grid-sdk/agent-cli';

const spec = createDefaultCliAgentRegistry().require('codex');
console.log(await inspectCliAgent(spec));

const process = spawnCliAgent(spec, {
  mcpUrl: 'http://127.0.0.1:9000/mcp',
  prompt: 'Complete this environment using observe and act.',
  serverName: 'game',
  toolNames: ['observe', 'act'],
});

const exit = await process.completion;
```

CLI configuration files are restricted to the temporary directory and are
removed after exit. A caller can register another `CliAgentSpec`, or set
`GAOS_AGENT_CLIS` to a JSON object with this shape:

```json
{
  "my-agent": {
    "label": "My Agent",
    "bin": "my-agent",
    "args": ["--mcp", "{mcpUrl}", "--prompt", "{prompt}"],
    "files": { ".agent/config.json": "{\"server\":\"{serverName}\"}" }
  }
}
```

Supported placeholders are `{mcpUrl}`, `{prompt}`, `{serverName}`, and
`{allowedTools}`.

## `gaos-agent` executable

The npm package installs `gaos-agent`:

```sh
# Discover and inspect integrations.
gaos-agent drivers
gaos-agent status codex

# Validate a key without making a model call.
export OPENAI_API_KEY=...
gaos-agent check openai

# Run a keyed episode. The module exports createEnvironment({ seed }).
gaos-agent run openai \
  --module ./environment.mjs \
  --model your-model-id \
  --seed 42

# Launch an already-authenticated CLI against any product-owned MCP server.
gaos-agent spawn codex \
  --mcp-url http://127.0.0.1:9000/mcp \
  --prompt "Complete the episode" \
  --tools observe,act
```

Keys are read only from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`,
or `OPENROUTER_API_KEY`. The command intentionally has no API-key argument.
An environment module is ordinary ESM:

```js
import { AgentEnvironment } from '@yugao-gaos/turn-based-grid-sdk/engine';
import { level, reducer } from './my-game.js';

export function createEnvironment({ seed }) {
  return new AgentEnvironment({ reducer, level, seed });
}
```

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

The SDK owns the agent loop, driver contracts, provider transport, CLI launch
mechanics, and deterministic interfaces. Products retain their prompts,
levels, characters, abilities, objectives, reward policy, hosted session
policy, coach rooms, human takeover, anti-cheat rules, authentication, and
leaderboards.
