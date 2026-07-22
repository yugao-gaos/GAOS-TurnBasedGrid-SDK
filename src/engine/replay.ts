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
  const validSeed = Number.isSafeInteger(header.seed) && header.seed >= 0 && header.seed <= 0xffff_ffff;
  if (!validSeed) problems.push('seed must be an unsigned 32-bit integer');
  const permutation: unknown[] = Array.isArray(header.perm) ? header.perm : [];
  const permutationLength = permutation.length;
  const validPermutation = Array.isArray(header.perm)
    && permutation.every((entry) => Number.isSafeInteger(entry)
      && (entry as number) >= 0 && (entry as number) < permutationLength)
    && new Set(permutation).size === permutationLength;
  if (!validPermutation) problems.push('perm must be a complete bijection over its declared length');

  const sequenceBase = actions.length > 0 && (actions[0]?.n === 0 || actions[0]?.n === 1)
    ? actions[0].n
    : undefined;
  if (actions.length > 0 && sequenceBase === undefined) {
    problems.push('action numbering must start at 0 or 1');
  }
  const parsedActions = actions.map((action, offset) => {
    if (!Number.isSafeInteger(action.n) || sequenceBase === undefined || action.n !== sequenceBase + offset) {
      problems.push(`action at index ${offset} has non-contiguous sequence number ${String(action.n)}`);
    }
    const parseId = (value: unknown, field: string): number | undefined => {
      if (typeof value !== 'string') {
        problems.push(`action ${String(action.n)} ${field} must use Action N syntax`);
        return undefined;
      }
      const match = /^Action ([1-9]\d*)$/.exec(value);
      const number = match ? Number(match[1]) : Number.NaN;
      if (!Number.isSafeInteger(number) || number < 1 || number > permutationLength) {
        problems.push(`action ${String(action.n)} ${field} must be within Action 1..${permutationLength}`);
        return undefined;
      }
      return number - 1;
    };
    for (const field of ['x', 'y', 'index'] as const) {
      if (action[field] !== undefined && !Number.isSafeInteger(action[field])) {
        problems.push(`action ${String(action.n)} ${field} must be a safe integer`);
      }
    }
    const wire = parseId(action.wireId, 'wireId');
    const canonical = parseId(action.canonicalId, 'canonicalId');
    if (validPermutation && wire !== undefined && canonical !== undefined
      && permutation[wire] !== canonical) {
      problems.push(
        `action ${action.n}: wire ${action.wireId} → ${action.canonicalId} contradicts the session permutation`,
      );
    }
    return { action, valid: wire !== undefined && canonical !== undefined
      && ['x', 'y', 'index'].every((field) => (
        action[field as 'x' | 'y' | 'index'] === undefined
        || Number.isSafeInteger(action[field as 'x' | 'y' | 'index'])
      )) };
  });

  let state = reducer.init(header.level, validSeed ? header.seed : 0);
  let replayError: string | null = null;
  for (const { action, valid } of parsedActions) {
    if (reducer.view(state).status !== 'playing') {
      problems.push(`action ${action.n} appears after terminal state`);
      break;
    }
    if (!valid) continue;
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
