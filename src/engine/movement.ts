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
  const ids = movers.map((mover) => mover.id);
  const current = new Map<string, Cell>(movers.map((mover) => [mover.id, mover.from]));
  const destination = new Map<string, Cell>(movers.map((mover) => [mover.id, mover.to]));
  const priorities = new Map<string, number>(movers.map((mover) => [mover.id, mover.priority]));
  const moving = (id: string): boolean => !same(destination.get(id)!, current.get(id)!);
  const revert = (id: string): Map<string, Cell> => destination.set(id, current.get(id)!);

  let changed = true;
  while (changed) {
    changed = false;
    const stayers = ids.filter((id) => !moving(id));
    for (const id of ids) {
      if (!moving(id)) continue;
      const mover = movers.find((candidate) => candidate.id === id)!;
      const targetCells = cellsAt(mover, destination.get(id)!);
      if (
        targetCells.some(([x, y]) => isStaticBlocked(x, y, id))
        || stayers.some((otherId) => {
          if (otherId === id) return false;
          const other = movers.find((candidate) => candidate.id === otherId)!;
          return overlaps(targetCells, cellsAt(other, current.get(otherId)!));
        })
      ) {
        revert(id);
        changed = true;
        continue;
      }

      const swap = ids.find((otherId) => {
        if (otherId === id || !moving(otherId)) return false;
        const other = movers.find((candidate) => candidate.id === otherId)!;
        return overlaps(targetCells, cellsAt(other, current.get(otherId)!))
          && overlaps(cellsAt(other, destination.get(otherId)!), cellsAt(mover, current.get(id)!));
      });
      if (swap) {
        const consented = mover.swapOk?.includes(swap)
          || movers.find((candidate) => candidate.id === swap)?.swapOk?.includes(id);
        if (!consented) {
          revert(id);
          revert(swap);
          changed = true;
          continue;
        }
      }

      const rivals = ids.filter((otherId) => {
        if (otherId === id || !moving(otherId)) return false;
        const other = movers.find((candidate) => candidate.id === otherId)!;
        return overlaps(targetCells, cellsAt(other, destination.get(otherId)!));
      });
      if (rivals.length > 0) {
        const group = [id, ...rivals];
        const winner = group.reduce((a, b) => (
          priorities.get(a)! <= priorities.get(b)! ? a : b
        ));
        for (const member of group) {
          if (member !== winner) revert(member);
        }
        changed = true;
      }
    }
  }

  return destination;
}
