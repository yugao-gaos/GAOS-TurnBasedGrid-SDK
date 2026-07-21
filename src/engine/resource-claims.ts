export interface ResourceClaim<TClaim> {
  /** Stable action/claim identity. */
  id: string;
  /** Stable resource identities consumed or mutated by this action. */
  resources: readonly string[];
  claim: TClaim;
}

export interface ResourceArbitration<TClaim> {
  accepted: Array<ResourceClaim<TClaim>>;
  contested: Array<ResourceClaim<TClaim>>;
  /** Claim ids grouped by contested resource. */
  conflicts: Map<string, string[]>;
}

/**
 * Neutrally arbitrate snapshot-qualified resource claims. Any action sharing a
 * resource with another action is contested in full; no lexical winner exists.
 */
export function arbitrateResourceClaims<TClaim>(
  claims: readonly ResourceClaim<TClaim>[],
): ResourceArbitration<TClaim> {
  const ids = new Set<string>();
  const byResource = new Map<string, string[]>();
  for (const entry of claims) {
    if (ids.has(entry.id)) throw new Error(`duplicate resource claim id: ${entry.id}`);
    ids.add(entry.id);
    for (const resource of new Set(entry.resources)) {
      const resourceClaims = byResource.get(resource) ?? [];
      resourceClaims.push(entry.id);
      byResource.set(resource, resourceClaims);
    }
  }

  const conflicts = new Map<string, string[]>();
  const contestedIds = new Set<string>();
  for (const resource of [...byResource.keys()].sort()) {
    const resourceClaims = byResource.get(resource)!;
    if (resourceClaims.length < 2) continue;
    conflicts.set(resource, [...resourceClaims]);
    for (const id of resourceClaims) contestedIds.add(id);
  }
  return {
    accepted: claims.filter(({ id }) => !contestedIds.has(id)),
    contested: claims.filter(({ id }) => contestedIds.has(id)),
    conflicts,
  };
}
