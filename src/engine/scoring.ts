export interface StarThresholds {
  three: number;
  two: number;
}

export interface BudgetUsage {
  actionsUsed: number;
  maxActions: number;
  energyUsed: number;
  energyCap: number;
}

export type BudgetFailure = 'out_of_energy' | 'out_of_action_budget';

/** Score a completed run from product-supplied action thresholds. */
export function scoreStars(actionsUsed: number, thresholds: StarThresholds): 1 | 2 | 3 {
  if (actionsUsed <= thresholds.three) return 3;
  if (actionsUsed <= thresholds.two) return 2;
  return 1;
}

/**
 * Return the generic budget failure, preserving Energy-before-ActionBudget
 * precedence when both are exhausted on the same turn.
 */
export function budgetFailure(usage: BudgetUsage): BudgetFailure | null {
  if (usage.energyUsed >= usage.energyCap) return 'out_of_energy';
  if (usage.actionsUsed >= usage.maxActions) return 'out_of_action_budget';
  return null;
}

/** Suggest authored star thresholds from a solver-derived minimum. */
export function suggestStarThresholds(minimumActions: number): StarThresholds {
  return {
    three: Math.ceil(minimumActions * 1.34),
    two: Math.ceil(minimumActions * 1.85),
  };
}
