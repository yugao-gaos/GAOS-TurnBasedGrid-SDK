export interface TurnOrderState {
  seats: readonly string[];
  current: number;
  direction: 1 | -1;
  turnNumber: number;
  round: number;
  pendingExtra?: readonly string[];
  skips?: Readonly<Record<string, number>>;
}

function assertSeats(seats: readonly string[], allowEmpty = false): void {
  if (!Array.isArray(seats)
    || (!allowEmpty && seats.length === 0)
    || seats.some((seat) => typeof seat !== 'string' || seat.length === 0)) {
    throw new TypeError(`turn order seats must be ${allowEmpty ? '' : 'a non-empty list of '}non-empty strings`);
  }
  if (new Set(seats).size !== seats.length) {
    throw new TypeError('turn order seats must be unique');
  }
}

function assertOrder(order: TurnOrderState, allowEmpty = false): void {
  if (!order || typeof order !== 'object') throw new TypeError('turn order must be an object');
  assertSeats(order.seats, allowEmpty);
  if (order.seats.length === 0) {
    if (order.current !== 0) throw new RangeError('empty turn order current must be zero');
  } else if (!Number.isSafeInteger(order.current)
    || order.current < 0 || order.current >= order.seats.length) {
    throw new RangeError('turn order current must index seats');
  }
  if (order.direction !== 1 && order.direction !== -1) {
    throw new RangeError('turn order direction must be 1 or -1');
  }
  for (const [name, value] of [['turnNumber', order.turnNumber], ['round', order.round]] as const) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive safe integer`);
    }
  }
  if (order.pendingExtra && (!Array.isArray(order.pendingExtra)
    || order.pendingExtra.some((seat) => (
      typeof seat !== 'string' || seat.length === 0 || !order.seats.includes(seat)
    )))) {
    throw new TypeError('pending extra turns must contain current seat ids');
  }
  if (order.skips && Object.entries(order.skips).some(([seat, count]) => (
    !seat || !order.seats.includes(seat) || !Number.isSafeInteger(count) || count < 1
  ))) {
    throw new TypeError('turn order skips must map current seat ids to positive safe integers');
  }
}

function cleanSkips(skips: Record<string, number>): Readonly<Record<string, number>> | undefined {
  const present = Object.fromEntries(
    Object.entries(skips).filter(([, count]) => count > 0),
  );
  return Object.keys(present).length === 0 ? undefined : present;
}

function cleanExtras(extras: string[]): readonly string[] | undefined {
  return extras.length === 0 ? undefined : extras;
}

function consumeSkip(skips: Record<string, number>, seat: string): boolean {
  const count = skips[seat] ?? 0;
  if (count === 0) return false;
  if (count === 1) delete skips[seat];
  else skips[seat] = count - 1;
  return true;
}

/** Create one-based turn and round counters over a deterministic seat rotation. */
export function createTurnOrder(
  seats: readonly string[],
  first = 0,
): TurnOrderState {
  assertSeats(seats);
  if (!Number.isSafeInteger(first) || first < 0 || first >= seats.length) {
    throw new RangeError('first must index turn order seats');
  }
  return {
    seats: [...seats],
    current: first,
    direction: 1,
    turnNumber: 1,
    round: 1,
  };
}

export function activeSeat(order: TurnOrderState): string {
  assertOrder(order, true);
  const seat = order.seats[order.current];
  if (seat === undefined) throw new RangeError('empty turn order has no active seat');
  return seat;
}

/**
 * Advance one turn. Extra turns are FIFO; skipped seats are consumed before
 * activation; every directional wrap increments the round.
 */
export function advanceTurn(order: TurnOrderState): TurnOrderState {
  assertOrder(order);
  const seats = [...order.seats];
  const extras = [...(order.pendingExtra ?? [])];
  const skips = { ...(order.skips ?? {}) };
  let current = order.current;
  let round = order.round;

  while (extras.length > 0) {
    const seat = extras.shift()!;
    const index = seats.indexOf(seat);
    if (index < 0 || consumeSkip(skips, seat)) continue;
    return {
      seats,
      current: index,
      direction: order.direction,
      turnNumber: order.turnNumber + 1,
      round,
      ...(cleanExtras(extras) ? { pendingExtra: cleanExtras(extras) } : {}),
      ...(cleanSkips(skips) ? { skips: cleanSkips(skips) } : {}),
    };
  }

  while (true) {
    const next = current + order.direction;
    if (next < 0 || next >= seats.length) round++;
    current = (next + seats.length) % seats.length;
    if (!consumeSkip(skips, seats[current]!)) break;
  }

  return {
    seats,
    current,
    direction: order.direction,
    turnNumber: order.turnNumber + 1,
    round,
    ...(cleanSkips(skips) ? { skips: cleanSkips(skips) } : {}),
  };
}

export function reverseTurnOrder(order: TurnOrderState): TurnOrderState {
  assertOrder(order, true);
  return {
    ...order,
    seats: [...order.seats],
    direction: order.direction === 1 ? -1 : 1,
    ...(order.pendingExtra ? { pendingExtra: [...order.pendingExtra] } : {}),
    ...(order.skips ? { skips: { ...order.skips } } : {}),
  };
}

export function queueSkip(
  order: TurnOrderState,
  seat: string,
  count = 1,
): TurnOrderState {
  assertOrder(order);
  if (!order.seats.includes(seat)) throw new RangeError(`unknown turn order seat: ${seat}`);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('skip count must be a positive safe integer');
  }
  return {
    ...order,
    seats: [...order.seats],
    skips: {
      ...(order.skips ?? {}),
      [seat]: (order.skips?.[seat] ?? 0) + count,
    },
    ...(order.pendingExtra ? { pendingExtra: [...order.pendingExtra] } : {}),
  };
}

export function queueExtraTurn(order: TurnOrderState, seat: string): TurnOrderState {
  assertOrder(order);
  if (!order.seats.includes(seat)) throw new RangeError(`unknown turn order seat: ${seat}`);
  return {
    ...order,
    seats: [...order.seats],
    pendingExtra: [...(order.pendingExtra ?? []), seat],
    ...(order.skips ? { skips: { ...order.skips } } : {}),
  };
}

export function eliminateSeat(order: TurnOrderState, seat: string): TurnOrderState {
  assertOrder(order);
  const removed = order.seats.indexOf(seat);
  if (removed < 0) throw new RangeError(`unknown turn order seat: ${seat}`);
  const wasActive = removed === order.current;
  const seats = order.seats.filter((candidate) => candidate !== seat);
  const pendingExtra = (order.pendingExtra ?? []).filter((candidate) => candidate !== seat);
  const skips = Object.fromEntries(
    Object.entries(order.skips ?? {}).filter(([candidate]) => candidate !== seat),
  );
  if (seats.length === 0) {
    return {
      seats,
      current: 0,
      direction: order.direction,
      turnNumber: order.turnNumber + (wasActive ? 1 : 0),
      round: order.round,
    };
  }
  if (!wasActive) {
    return {
      seats,
      current: removed < order.current ? order.current - 1 : order.current,
      direction: order.direction,
      turnNumber: order.turnNumber,
      round: order.round,
      ...(cleanExtras(pendingExtra) ? { pendingExtra: cleanExtras(pendingExtra) } : {}),
      ...(cleanSkips(skips) ? { skips: cleanSkips(skips) } : {}),
    };
  }

  const desired = order.direction === 1
    ? removed % seats.length
    : (removed - 1 + seats.length) % seats.length;
  const predecessor = order.direction === 1
    ? (desired - 1 + seats.length) % seats.length
    : (desired + 1) % seats.length;
  return advanceTurn({
    seats,
    current: predecessor,
    direction: order.direction,
    turnNumber: order.turnNumber,
    round: order.round,
    ...(cleanExtras(pendingExtra) ? { pendingExtra: cleanExtras(pendingExtra) } : {}),
    ...(cleanSkips(skips) ? { skips: cleanSkips(skips) } : {}),
  });
}

export function reorderSeats(
  order: TurnOrderState,
  seats: readonly string[],
): TurnOrderState {
  assertOrder(order, true);
  assertSeats(seats);
  if (order.seats.length > 0 && (
    seats.length !== order.seats.length
    || seats.some((seat) => !order.seats.includes(seat))
  )) {
    throw new RangeError('reordered seats must be a permutation of the current seats');
  }
  const previousActive = order.seats[order.current];
  const current = previousActive === undefined ? 0 : Math.max(0, seats.indexOf(previousActive));
  const pendingExtra = (order.pendingExtra ?? []).filter((seat) => seats.includes(seat));
  const skips = Object.fromEntries(
    Object.entries(order.skips ?? {}).filter(([seat]) => seats.includes(seat)),
  );
  return {
    seats: [...seats],
    current,
    direction: order.direction,
    turnNumber: order.turnNumber,
    round: order.round,
    ...(cleanExtras(pendingExtra) ? { pendingExtra: cleanExtras(pendingExtra) } : {}),
    ...(cleanSkips(skips) ? { skips: cleanSkips(skips) } : {}),
  };
}
