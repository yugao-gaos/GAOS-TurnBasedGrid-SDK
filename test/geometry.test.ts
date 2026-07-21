import { describe, expect, it } from 'vitest';
import {
  bresenhamLine,
  coneFieldCells,
  lineOfSightClear,
  shortestGridPath,
} from '../src/engine/index.js';

describe('grid geometry', () => {
  it('traces lines without including the origin', () => {
    expect(bresenhamLine([1, 1], [4, 2])).toEqual([[2, 1], [3, 2], [4, 2]]);
  });

  it('finds a shortest path around blockers', () => {
    expect(shortestGridPath({
      width: 5,
      height: 4,
      start: [1, 1],
      goal: [3, 1],
      isBlocked: ([x, y]) => x === 2 && y === 1,
    })).toEqual([[1, 0], [2, 0], [3, 0], [3, 1]]);
  });

  it('can allow an occupied goal without allowing occupied intermediates', () => {
    expect(shortestGridPath({
      width: 4,
      height: 3,
      start: [1, 1],
      goal: [2, 1],
      isBlocked: ([x, y]) => x === 2 && y === 1,
      allowBlockedGoal: true,
    })).toEqual([[2, 1]]);
  });

  it('stops sight at intermediate blockers but not at the target', () => {
    expect(lineOfSightClear([0, 0], [3, 0], ([x]) => x === 2)).toBe(false);
    expect(lineOfSightClear([0, 0], [2, 0], ([x]) => x === 2)).toBe(true);
  });

  it('computes a widening cone using injected board policy', () => {
    const cells = coneFieldCells({
      from: [2, 3],
      direction: 'up',
      range: 2,
      cellExists: ([x, y]) => x >= 0 && y >= 0 && x < 5 && y < 5,
      isBlocked: ([x, y]) => x === 2 && y === 1,
    });
    expect(cells).toEqual([[2, 2], [3, 1], [1, 1]]);
  });
});
