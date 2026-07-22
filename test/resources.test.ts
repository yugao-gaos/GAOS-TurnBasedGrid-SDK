import { describe, expect, it } from 'vitest';
import {
  changeResource,
  commitResourceTransaction,
  defineResources,
  initializeResourceBalances,
  planResourceTransaction,
  resourceAtLeast,
} from '../src/engine/index.js';

const resources = defineResources({
  energy: { initial: 10, min: 0, max: 20 },
  coins: { initial: 0, min: 0 },
});

describe('resource balances', () => {
  it('adds defaults for new definitions without losing saved or unknown balances', () => {
    expect(initializeResourceBalances(resources, { energy: 4, future: 9 })).toEqual({
      energy: 4,
      future: 9,
      coins: 0,
    });
  });

  it('applies multiple resources atomically with authored-order change records', () => {
    const balances = { energy: 10, coins: 2 };
    const plan = planResourceTransaction(resources, balances, {
      id: 'ring_bell',
      requirements: [resourceAtLeast('energy', 3)],
      effects: [changeResource('energy', -3), changeResource('coins', 1)],
    });

    expect(plan).toEqual({
      ok: true,
      balances: { energy: 7, coins: 3 },
      changes: [
        {
          type: 'resource.changed', transactionId: 'ring_bell', effectIndex: 0,
          resourceId: 'energy', previous: 10, delta: -3, current: 7,
        },
        {
          type: 'resource.changed', transactionId: 'ring_bell', effectIndex: 1,
          resourceId: 'coins', previous: 2, delta: 1, current: 3,
        },
      ],
    });
    expect(balances).toEqual({ energy: 10, coins: 2 });
    expect(commitResourceTransaction(balances, plan)).toBe(true);
    expect(balances).toEqual({ energy: 7, coins: 3 });
  });

  it('rejects unmet requirements without applying effects', () => {
    const balances = { energy: 2, coins: 0 };
    const plan = planResourceTransaction(resources, balances, {
      id: 'ring_bell',
      requirements: [resourceAtLeast('energy', 3)],
      effects: [changeResource('energy', -3)],
    });

    expect(plan).toEqual({
      ok: false,
      balances,
      changes: [],
      failure: {
        code: 'resource_requirement_not_met', resourceId: 'energy',
        requirementIndex: 0, required: 3, available: 2,
      },
    });
  });

  it('rejects the whole plan when any effect exceeds a bound', () => {
    const balances = { energy: 19, coins: 2 };
    const plan = planResourceTransaction(resources, balances, {
      id: 'collect_battery',
      effects: [changeResource('coins', 1), changeResource('energy', 2)],
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) throw new Error('expected rejection');
    expect(plan.changes).toEqual([]);
    expect(plan.balances).toBe(balances);
    expect(plan.failure).toEqual({
      code: 'resource_bounds_exceeded', resourceId: 'energy', effectIndex: 1,
      attempted: 21, min: 0, max: 20,
    });
  });

  it('returns a structured failure for unknown resources', () => {
    const plan = planResourceTransaction(resources, { energy: 10, coins: 0 }, {
      id: 'cast',
      effects: [changeResource('mana', -1)],
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) throw new Error('expected rejection');
    expect(plan.failure).toEqual({
      code: 'resource_not_defined', resourceId: 'mana', phase: 'effect', index: 0,
    });
  });

  it.each([
    { amount: -1, error: RangeError },
    { amount: Number.NaN, error: TypeError },
    { amount: Number.POSITIVE_INFINITY, error: TypeError },
    { amount: Number.NEGATIVE_INFINITY, error: TypeError },
  ])('rejects invalid minimum $amount at factory and plan boundaries', ({ amount, error }) => {
    expect(() => resourceAtLeast('energy', amount)).toThrow(error);
    expect(() => planResourceTransaction(resources, { energy: 10 }, {
      id: 'raw_requirement',
      requirements: [{ type: 'resource.minimum', resourceId: 'energy', amount }],
      effects: [],
    })).toThrow(error);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects invalid delta %s at factory and plan boundaries', (delta) => {
    expect(() => changeResource('energy', delta)).toThrow(TypeError);
    expect(() => planResourceTransaction(resources, { energy: 10 }, {
      id: 'raw_delta',
      effects: [{ type: 'resource.delta', resourceId: 'energy', delta }],
    })).toThrow(TypeError);
  });
});
