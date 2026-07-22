# Python client

The Python distribution provides a zero-runtime-dependency hosted client, a
Gym-style environment, and small agent evaluation helpers. It targets Python
3.10 or newer.

## Install from a release

Python wheels and source distributions are attached to each GitHub release.
Download the wheel for the version you want, then install it:

```sh
pip install gaos_turn_based_grid_sdk-0.9.0-py3-none-any.whl
```

The distribution is named `gaos-turn-based-grid-sdk`. The stable import name
remains `agilabs_arena` for compatibility.

## Hosted client

```python
from agilabs_arena import ArenaClient

arena = ArenaClient("https://api.zonoid.ai", api_key="ak_...", timeout=30.0)
session_id, turn = arena.create_session(
    game_mode="challenge",
    play_method="human",
    level_id="od-l1",
)
print(turn.grid)
```

The client speaks the `agilabs.turns` v1 envelope on `/v1/sessions`. Commands
carry the session cursor, participant, and a deterministic submission ID:
reuse it for an exact retry and create a new one for each logical control step.

## Gym-style environment

```python
from agilabs_arena import ArenaEnv

env = ArenaEnv(
    "od-l1",
    base_url="http://localhost:8899",
    play_method="human",
)
observation, info = env.reset()
print(observation["grid"])
print(observation["concrete_actions"])

observation, reward, terminated, truncated, info = env.step(
    observation["concrete_actions"][0]
)
```

The observation includes both action definitions and fully parameterized
`concrete_actions`. Rewards are terminal stars, or zero before completion.

## Evaluate an agent

```python
from agilabs_arena import ArenaEnv, run_agent_episode

env = ArenaEnv("od-l1", play_method="autonomous_local")
result = run_agent_episode(
    env,
    lambda observation, info: observation["concrete_actions"][0],
)
```

`run_agent_episode` and `evaluate_agent_episodes` accept any duck-typed
Gym-style environment. Gymnasium itself is not a required dependency.

For matchmaking, control revision, and lower-level envelope operations, see
the complete [Python README on GitHub](https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/blob/main/python/README.md).
