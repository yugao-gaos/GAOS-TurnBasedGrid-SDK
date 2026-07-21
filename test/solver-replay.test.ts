import { describe, expect, it } from 'vitest';
import {
  recheckGridTranscript,
  runLevelSeed,
  solveGridLevel,
  type GridReducer,
  type GridTurnView,
} from '../src/engine/index.js';

interface Level { goal: number }
interface State { at: number; actionsUsed: number }

const reducer: GridReducer<Level, State> = {
  init: () => ({ at: 0, actionsUsed: 0 }),
  apply: (state, action) => {
    if (action.id === 'Action 1') {
      return { at: state.at + 1, actionsUsed: state.actionsUsed + 1 };
    }
    if (action.id === 'Action 2' && action.index !== undefined) {
      return { at: state.at + action.index, actionsUsed: state.actionsUsed + 1 };
    }
    throw new Error('illegal action');
  },
  view: (state): GridTurnView => ({
    actions: [
      { id: 'Action 1', params: 'none' },
      { id: 'Action 2', params: 'index' },
    ],
    status: state.at >= 3 ? 'won' : 'playing',
    ...(state.at >= 3 ? { stars: 3 } : {}),
    hud: { actionsUsed: state.actionsUsed, items: [{ index: 2 }] },
  }),
};

describe('generic grid solver', () => {
  it('finds a shortest reducer-valid action sequence', () => {
    expect(solveGridLevel(reducer, { goal: 3 }, { maxActions: 4 })).toEqual({
      min: 2,
      capped: false,
      explored: 3,
      actions: [
        { id: 'Action 1' },
        { id: 'Action 2', index: 2 },
      ],
    });
  });

  it('reports an exhausted search bound', () => {
    const result = solveGridLevel(reducer, { goal: 3 }, { maxActions: 1 });
    expect(result).toMatchObject({ min: null, capped: false });
  });
});

describe('generic transcript rechecking', () => {
  const header = {
    sessionId: 's1',
    level: { goal: 3 },
    seed: 42,
    perm: [0, 1],
    status: 'won' as const,
    stars: 3,
    actionsUsed: 2,
  };

  it('replays canonical actions and verifies the result', () => {
    expect(recheckGridTranscript(reducer, header, [
      { n: 1, wireId: 'Action 1', canonicalId: 'Action 1' },
      { n: 2, wireId: 'Action 2', canonicalId: 'Action 2', index: 2 },
    ])).toMatchObject({ ok: true, problems: [] });
  });

  it('detects permutation and outcome discrepancies', () => {
    const result = recheckGridTranscript(reducer, { ...header, actionsUsed: 9 }, [
      { n: 1, wireId: 'Action 2', canonicalId: 'Action 1' },
      { n: 2, wireId: 'Action 2', canonicalId: 'Action 2', index: 2 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(2);
  });

  it('derives stable, distinct per-level seeds', () => {
    expect(runLevelSeed(99, 0)).toBe(runLevelSeed(99, 0));
    expect(runLevelSeed(99, 0)).not.toBe(runLevelSeed(99, 1));
  });
});
