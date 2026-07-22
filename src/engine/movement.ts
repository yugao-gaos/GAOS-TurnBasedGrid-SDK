/** A grid cell in `[x, y]` coordinates. */
export type Cell = [number, number];

/** One simultaneous movement intent. */
export interface Mover {
  id: string;
  from: Cell;
  to: Cell;
  /** Lower values win contested destinations. */
  priority: number;
  /** Rectangular footprint from the top-left anchor. Defaults to 1x1. */
  footprint?: { width: number; height: number };
  /** Mover ids with which a head-on two-cycle is explicitly allowed. */
  swapOk?: string[];
}

const same = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];

const cellsAt = (mover: Mover, at: Cell): Cell[] => {
  const width = mover.footprint?.width ?? 1;
  const height = mover.footprint?.height ?? 1;
  const cells: Cell[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) cells.push([at[0] + dx, at[1] + dy]);
  }
  return cells;
};

const overlaps = (a: Cell[], b: Cell[]): boolean => (
  a.some((ac) => b.some((bc) => same(ac, bc)))
);

function validateMover(mover: Mover): void {
  if (typeof mover.id !== 'string' || !mover.id.trim()) {
    throw new TypeError('mover id must be a non-empty string');
  }
  if (!Number.isFinite(mover.priority)) {
    throw new TypeError(`mover ${mover.id} priority must be finite`);
  }
  for (const [label, cell] of [['from', mover.from], ['to', mover.to]] as const) {
    if (!Array.isArray(cell) || cell.length !== 2 || cell.some((value) => !Number.isSafeInteger(value))) {
      throw new TypeError(`mover ${mover.id} ${label} must be a pair of safe integers`);
    }
  }
  if (mover.footprint && (
    !Number.isSafeInteger(mover.footprint.width) || mover.footprint.width < 1
    || !Number.isSafeInteger(mover.footprint.height) || mover.footprint.height < 1
  )) {
    throw new RangeError(`mover ${mover.id} footprint must use positive safe integers`);
  }
  if (mover.swapOk && (!Array.isArray(mover.swapOk)
    || mover.swapOk.some((id) => typeof id !== 'string' || !id.trim()))) {
    throw new TypeError(`mover ${mover.id} swapOk must contain non-empty mover ids`);
  }
}

/**
 * Resolve all movement intents simultaneously.
 *
 * `isStaticBlocked` reports terrain and other hard blockers, but must not
 * include movers passed to this function. Movement reversion is monotonic, so
 * blocked chains settle while genuine rotations remain legal.
 */
export function resolveMoves(
  movers: Mover[],
  isStaticBlocked: (x: number, y: number, moverId?: string) => boolean,
): Map<string, Cell> {
  for (const mover of movers) validateMover(mover);
  if (new Set(movers.map((mover) => mover.id)).size !== movers.length) {
    throw new TypeError('mover ids must be unique');
  }
  const ids = movers.map((mover) => mover.id).sort();
  const sourceById = new Map(movers.map((mover) => [mover.id, mover]));
  const byId = new Map(ids.map((id) => [id, sourceById.get(id)!]));
  const current = new Map<string, Cell>(ids.map((id) => [id, byId.get(id)!.from]));
  const destination = new Map<string, Cell>(ids.map((id) => [id, byId.get(id)!.to]));
  const priorities = new Map<string, number>(ids.map((id) => [id, byId.get(id)!.priority]));
  const moving = (id: string): boolean => !same(destination.get(id)!, current.get(id)!);
  const revert = (id: string): Map<string, Cell> => destination.set(id, current.get(id)!);

  while (true) {
    const stayers = ids.filter((id) => !moving(id));
    const toRevert = new Set<string>();
    for (const id of ids) {
      if (!moving(id)) continue;
      const mover = byId.get(id)!;
      const targetCells = cellsAt(mover, destination.get(id)!);
      if (
        targetCells.some(([x, y]) => isStaticBlocked(x, y, id))
        || stayers.some((otherId) => {
          if (otherId === id) return false;
          const other = byId.get(otherId)!;
          return overlaps(targetCells, cellsAt(other, current.get(otherId)!));
        })
      ) {
        toRevert.add(id);
      }
    }
    if (toRevert.size > 0) {
      for (const id of toRevert) revert(id);
      continue;
    }

    for (const id of ids) {
      if (!moving(id)) continue;
      const mover = byId.get(id)!;
      const targetCells = cellsAt(mover, destination.get(id)!);
      const swap = ids.find((otherId) => {
        if (otherId === id || !moving(otherId)) return false;
        const other = byId.get(otherId)!;
        return overlaps(targetCells, cellsAt(other, current.get(otherId)!))
          && overlaps(cellsAt(other, destination.get(otherId)!), cellsAt(mover, current.get(id)!));
      });
      if (swap) {
        const consented = mover.swapOk?.includes(swap)
          || byId.get(swap)?.swapOk?.includes(id);
        if (!consented) {
          toRevert.add(id);
          toRevert.add(swap);
        }
      }
    }
    if (toRevert.size > 0) {
      for (const id of toRevert) revert(id);
      continue;
    }

    for (const id of ids) {
      if (!moving(id)) continue;
      const mover = byId.get(id)!;
      const targetCells = cellsAt(mover, destination.get(id)!);
      const rivals = ids.filter((otherId) => {
        if (otherId === id || !moving(otherId)) return false;
        const other = byId.get(otherId)!;
        return overlaps(targetCells, cellsAt(other, destination.get(otherId)!));
      });
      if (rivals.length > 0) {
        const group = [id, ...rivals];
        const winner = group.reduce((a, b) => {
          const priorityDelta = priorities.get(a)! - priorities.get(b)!;
          return priorityDelta < 0 || (priorityDelta === 0 && a <= b) ? a : b;
        });
        for (const member of group) {
          if (member !== winner) toRevert.add(member);
        }
      }
    }
    if (toRevert.size === 0) break;
    for (const id of toRevert) revert(id);
  }

  return destination;
}
