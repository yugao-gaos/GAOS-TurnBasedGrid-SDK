import {
  AgentEnvironment,
  runAgentEpisode,
  type GridReducer,
  type GridTurnView,
} from '../src/engine/index.js';

type Level = { goal: number };
type State = { position: number; steps: number };

const reducer: GridReducer<Level, State> = {
  init: () => ({ position: 0, steps: 0 }),
  apply: (state, action) => {
    if (action.id !== 'advance') throw new Error('illegal action');
    return { position: state.position + 1, steps: state.steps + 1 };
  },
  view: (state): GridTurnView => ({
    actions: [{ id: 'advance', params: 'none' }],
    status: state.position >= 3 ? 'won' : 'playing',
    hud: { actionsUsed: state.steps },
  }),
};

const environment = new AgentEnvironment({
  reducer,
  level: { goal: 3 },
  seed: 42,
});

const episode = await runAgentEpisode(
  environment,
  (turn) => turn.legalActions[0]!,
);

console.log(JSON.stringify(episode.transcript, null, 2));
