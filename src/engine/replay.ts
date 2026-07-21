import type { GridReducer, GridSubmittedAction, GridTurnView } from './contracts.js';

export interface GridTranscriptHeader<TLevel> {
  sessionId: string;
  level: TLevel;
  seed: number;
  /** Wire action index to canonical action index. */
  perm: number[];
  status: 'won' | 'failed';
  stars: number | null;
  actionsUsed: number;
}

export interface GridTranscriptAction {
  n: number;
  wireId: string;
  canonicalId: string;
  x?: number;
  y?: number;
  index?: number;
}

export interface GridRecheckResult {
  ok: boolean;
  problems: string[];
  replayed: { status: string; stars: number | null; actionsUsed: number };
}

/** Re-simulate a transcript and compare its deterministic recorded outcome. */
export function recheckGridTranscript<TLevel, TState, TView extends GridTurnView>(
  reducer: GridReducer<TLevel, TState, TView>,
  header: GridTranscriptHeader<TLevel>,
  actions: GridTranscriptAction[],
): GridRecheckResult {
  const problems: string[] = [];
  for (const action of actions) {
    const wire = Number(/^Action (\d+)$/.exec(action.wireId)?.[1] ?? Number.NaN) - 1;
    const canonical = Number(/^Action (\d+)$/.exec(action.canonicalId)?.[1] ?? Number.NaN) - 1;
    if (header.perm[wire] !== canonical) {
      problems.push(
        `action ${action.n}: wire ${action.wireId} → ${action.canonicalId} contradicts the session permutation`,
      );
    }
  }

  let state = reducer.init(header.level, header.seed);
  let replayError: string | null = null;
  for (const action of actions) {
    const submitted: GridSubmittedAction = {
      id: action.canonicalId,
      ...(action.x !== undefined ? { x: action.x } : {}),
      ...(action.y !== undefined ? { y: action.y } : {}),
      ...(action.index !== undefined ? { index: action.index } : {}),
    };
    try {
      state = reducer.apply(state, submitted);
    } catch (error) {
      replayError = `action ${action.n} (${action.canonicalId}) rejected on replay: ${(error as Error).message}`;
      break;
    }
  }

  const view = reducer.view(state);
  if (replayError) problems.push(replayError);
  if (view.status !== header.status) {
    problems.push(`status: recorded ${header.status}, replayed ${view.status}`);
  }
  if ((view.stars ?? null) !== header.stars) {
    problems.push(`stars: recorded ${header.stars}, replayed ${view.stars ?? null}`);
  }
  if (view.hud.actionsUsed !== header.actionsUsed) {
    problems.push(`actionsUsed: recorded ${header.actionsUsed}, replayed ${view.hud.actionsUsed}`);
  }

  return {
    ok: problems.length === 0,
    problems,
    replayed: {
      status: view.status,
      stars: view.stars ?? null,
      actionsUsed: view.hud.actionsUsed,
    },
  };
}

/** Deterministically derive one level seed from a multi-level run seed. */
export function runLevelSeed(sessionSeed: number, levelIndex: number): number {
  return (sessionSeed ^ (0x9e3779b9 * (levelIndex + 1))) >>> 0;
}
