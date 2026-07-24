import { describe, expect, it } from 'vitest';
import {
  AgentEnvironment,
  MultiAgentEnvironment,
  runMultiAgentEpisode,
  type TurnReducer,
  type TurnView,
} from '../src/engine/index.js';

describe('high-frequency agent decisions', () => {
  interface State {
    tick: number;
    actions: string[];
  }

  const reducer: TurnReducer<null, State> = {
    init: () => ({ tick: 0, actions: [] }),
    apply: (state, action) => ({
      tick: state.tick + 1,
      actions: [...state.actions, action.id],
    }),
    view: (state) => ({
      actions: state.tick < 3 ? [{ id: 'hold', params: 'none' }] : [],
      status: state.tick >= 3 ? 'won' : 'playing',
      hud: { actionsUsed: state.tick },
    }),
  };

  it('repeats one decision across frames and records every replayable tick', () => {
    const environment = new AgentEnvironment({
      reducer,
      level: null,
      frameSkip: 4,
    });
    environment.reset();
    const final = environment.step({ id: 'hold' });
    expect(final).toMatchObject({
      done: true,
      reward: 1,
      info: { steps: 3, actionsUsed: 3 },
    });
    const transcript = environment.transcript();
    expect(transcript).toMatchObject({
      version: '1.2',
      frameSkip: 4,
      actions: [
        { n: 1, action: { id: 'hold' } },
        { n: 2, action: { id: 'hold' } },
        { n: 3, action: { id: 'hold' } },
      ],
    });
    const replayed = new AgentEnvironment({ reducer, level: null, frameSkip: 4 });
    replayed.replay(transcript.actions.map(({ action }) => action));
    expect(replayed.transcript()).toEqual(transcript);
  });

  it('ends frame skipping early when a held continuation becomes illegal', () => {
    const changing: TurnReducer<null, State> = {
      ...reducer,
      view: (state) => ({
        actions: state.tick === 0
          ? [{ id: 'charge', params: 'none' }]
          : state.tick === 1
            ? [{ id: 'release', params: 'none' }]
            : [],
        status: state.tick >= 2 ? 'won' : 'playing',
        hud: { actionsUsed: state.tick },
      }),
    };
    const environment = new AgentEnvironment({
      reducer: changing,
      level: null,
      frameSkip: 5,
    });
    environment.reset();
    expect(environment.step({ id: 'charge' })).toMatchObject({
      done: false,
      info: { steps: 1 },
    });
    expect(environment.step({ id: 'release' })).toMatchObject({
      done: true,
      info: { steps: 2 },
    });
  });
});

describe('multi-agent episodes', () => {
  interface State {
    round: number;
    trace: string[];
  }

  interface View extends TurnView {
    privateValue: string;
  }

  const reducer: TurnReducer<null, State, View> = {
    init: () => ({ round: 0, trace: [] }),
    apply: () => {
      throw new Error('simultaneous reducer must not serially apply intents');
    },
    applyIntents: (state, actions) => ({
      round: state.round + 1,
      trace: [...state.trace, ...actions.map(({ seat, id }) => `${seat}:${id}`)],
    }),
    view: (state) => ({
      actions: [],
      status: 'playing',
      participation: { mode: 'simultaneous', seats: ['b', 'a'] },
      outcome: state.round === 0
        ? { kind: 'ongoing' }
        : {
          kind: 'decided',
          ranking: [
            { seat: 'b', rank: 1, score: 2 },
            { seat: 'a', rank: 2 },
          ],
        },
      hud: { actionsUsed: state.round },
      privateValue: 'full',
    }),
    viewFor: (state, seat) => ({
      actions: state.round === 0 ? [{ id: `move-${seat}`, params: 'none' }] : [],
      status: 'playing',
      participation: { mode: 'simultaneous', seats: ['b', 'a'] },
      outcome: state.round === 0
        ? { kind: 'ongoing' }
        : {
          kind: 'decided',
          ranking: [
            { seat: 'b', rank: 1, score: 2 },
            { seat: 'a', rank: 2 },
          ],
        },
      hud: { actionsUsed: state.round },
      privateValue: `only:${seat}`,
    }),
  };

  it('collects seat-scoped actions, commits one canonical batch, and rewards each seat', () => {
    const environment = new MultiAgentEnvironment({
      reducer,
      level: null,
      seats: ['b', 'a'],
      seed: 7,
    });
    const initial = environment.reset();
    expect(initial.participatingSeats).toEqual(['a', 'b']);
    expect(initial.seats.a?.observation.privateValue).toBe('only:a');
    const final = environment.step({
      b: { id: 'move-b' },
      a: { id: 'move-a' },
    });
    expect(final).toMatchObject({
      done: true,
      seats: {
        a: { reward: 0, totalReward: 0 },
        b: { reward: 2, totalReward: 2 },
      },
    });
    const transcript = environment.transcript();
    expect(transcript).toMatchObject({
      version: '1.0',
      seats: ['a', 'b'],
      initialObservations: {
        a: { privateValue: 'only:a' },
        b: { privateValue: 'only:b' },
      },
      rounds: [{
        actions: [
          { id: 'move-a', seat: 'a' },
          { id: 'move-b', seat: 'b' },
        ],
        observations: {
          a: { privateValue: 'only:a' },
          b: { privateValue: 'only:b' },
        },
      }],
      result: {
        totalRewards: { a: 0, b: 2 },
      },
    });
    const replayed = new MultiAgentEnvironment({
      reducer,
      level: null,
      seats: ['a', 'b'],
      seed: 7,
    });
    replayed.replay(transcript.rounds.map(({ actions }) => actions));
    expect(replayed.transcript()).toEqual(transcript);
  });

  it('runs independent seat policies against one shared verifiable transcript', async () => {
    const environment = new MultiAgentEnvironment({
      reducer,
      level: null,
      seats: ['a', 'b'],
    });
    const episode = await runMultiAgentEpisode(environment, {
      a: (turn) => turn.legalActions[0],
      b: (turn) => turn.legalActions[0],
    });
    expect(episode.finalTurn.done).toBe(true);
    expect(episode.transcript.rounds).toHaveLength(1);
  });
});
