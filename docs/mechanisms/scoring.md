# Scoring and budgets

The scoring helpers implement a small product-neutral star model and a stable
failure precedence. Products supply all authored thresholds and resource caps.

## Star thresholds

`scoreStars` uses inclusive action thresholds:

```ts
scoreStars(6, { three: 6, two: 9 });  // 3
scoreStars(7, { three: 6, two: 9 });  // 2
scoreStars(10, { three: 6, two: 9 }); // 1
```

The function assumes the three-star threshold is no greater than the two-star
threshold. It does not validate authored data. A completed run always receives
one, two, or three stars; failure and incomplete-run policy belongs outside this
function.

## Budget failure

`budgetFailure` compares cumulative usage with caps using `>=`:

```ts
const failure = budgetFailure({
  actionsUsed,
  maxActions: level.actionBudget,
  energyUsed,
  energyCap: level.energyCap,
});
```

When both limits are reached on the same turn, `out_of_energy` wins over
`out_of_action_budget`. This explicit precedence keeps client, server, replay,
and agent evaluation from reporting different terminal reasons.

The helper does not spend resources, reject an action before execution, or
decide whether reaching a cap is checked before or after settlement. The product
must call it at its authored point in the turn pipeline.

## Suggested thresholds

`suggestStarThresholds(minimumActions)` derives starting values from a
solver-measured minimum:

```ts
{
  three: Math.ceil(minimumActions * 1.34),
  two: Math.ceil(minimumActions * 1.85),
}
```

These ratios are authoring suggestions, not a claim about difficulty. Validate
them with human and agent play, then store the chosen values in product content.
Changing authored thresholds does not require changing the SDK engine.

## Determinism checklist

- Count canonical submitted actions consistently across all runtimes.
- Define whether rejected/no-op actions consume budget.
- Apply costs and terminal checks at one documented phase.
- Store thresholds and caps with the level version used by replay.

