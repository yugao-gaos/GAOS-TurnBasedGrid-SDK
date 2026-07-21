/**
 * Stable, genre-neutral wire contracts for turn-based games.
 *
 * Observations and commands are deliberately opaque generic values. A grid
 * game may put a text board in an observation; a card game may put hands and
 * piles there. The protocol coordinates turns without freezing either shape.
 * Values crossing the wire must be JSON-serializable.
 */

export const PROTOCOL_ID = 'agilabs.turns' as const;
export const PROTOCOL_VERSION = '1.0' as const;
/** Portable seat ids keep canonical ordering identical across SDK languages. */
export const PARTICIPANT_ID_PATTERN = '^[A-Za-z0-9_.:@-]{1,128}$' as const;
const INVALID_PARTICIPANT_ID_CHAR = /[^A-Za-z0-9_.:@-]/;

export function isParticipantId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 128
    && !INVALID_PARTICIPANT_ID_CHAR.test(value);
}

export interface ProtocolExtensions {
  [key: string]: unknown;
}

export interface TurnCursor {
  /** Stable identity of this revision, unique within a session. */
  turnId: string;
  /** Monotonically increasing resolved-turn revision, starting at zero. */
  revision: number;
}

interface EnvelopeBase extends TurnCursor {
  protocol: typeof PROTOCOL_ID;
  protocolVersion: typeof PROTOCOL_VERSION;
  sessionId: string;
  extensions?: ProtocolExtensions;
}

/** A fully resolved observation. This is the only envelope renderers animate. */
export interface TurnEnvelope<TObservation = unknown> extends EnvelopeBase {
  kind: 'turn';
  turn: TObservation;
}

/**
 * Acknowledges one collected intent without advancing the turn. `turn` is the
 * last resolved observation, so clients can keep rendering while they wait.
 */
export interface PendingEnvelope<TObservation = unknown> extends EnvelopeBase {
  kind: 'pending';
  turn: TObservation;
  acceptedParticipantId?: string;
  submittedParticipants: string[];
  awaitingParticipants: string[];
}

export type TurnResult<TObservation = unknown> =
  | TurnEnvelope<TObservation>
  | PendingEnvelope<TObservation>;

/** One participant's command for a specific unresolved turn. */
export interface CommandSubmission<TCommand = unknown> extends TurnCursor {
  protocol: typeof PROTOCOL_ID;
  protocolVersion: typeof PROTOCOL_VERSION;
  sessionId: string;
  participantId: string;
  /** Required caller-generated idempotency key. Keep it stable for exact
   * retries, and use a new key for each logical command/control substep. */
  submissionId: string;
  command: TCommand;
  extensions?: ProtocolExtensions;
}

export interface CollectedIntent<TCommand = unknown> {
  participantId: string;
  submissionId: string;
  command: TCommand;
}

/**
 * Host-independent game registration seam. A game resolves one complete,
 * canonically ordered intent batch; the SDK never serially applies participant
 * commands. Config, state, observation, and command shapes are game-owned.
 */
export interface GameDefinition<
  TConfig,
  TState,
  TObservation,
  TCommand,
  TCommandDefinition = unknown,
> {
  id: string;
  version: string;
  create(config: TConfig, seed: number): TState;
  participants(state: TState): readonly string[];
  observe(state: TState, participantId: string): TObservation;
  /** Discoverable legal command surface for this participant and revision. */
  legalCommands(state: TState, participantId: string): readonly TCommandDefinition[];
  /** Authoritative host-side validation for an opaque submitted command. */
  isCommandLegal(state: TState, participantId: string, command: TCommand): boolean;
  resolveTurn(
    state: TState,
    intents: readonly CollectedIntent<TCommand>[],
  ): TState;
}

/** Instance-local registry: hosts opt games in explicitly without global state. */
export class GameRegistry {
  private readonly definitions = new Map<
    string,
    Map<string, GameDefinition<unknown, unknown, unknown, unknown, unknown>>
  >();

  register<TConfig, TState, TObservation, TCommand, TCommandDefinition>(
    definition: GameDefinition<TConfig, TState, TObservation, TCommand, TCommandDefinition>,
  ): void {
    if (
      typeof definition.id !== 'string'
      || !definition.id.trim()
      || typeof definition.version !== 'string'
      || !definition.version.trim()
    ) {
      throw new Error('game id and version are required');
    }
    let versions = this.definitions.get(definition.id);
    if (!versions) {
      versions = new Map();
      this.definitions.set(definition.id, versions);
    }
    if (versions.has(definition.version)) {
      throw new Error(`game already registered: ${definition.id}@${definition.version}`);
    }
    versions.set(
      definition.version,
      definition as GameDefinition<unknown, unknown, unknown, unknown, unknown>,
    );
  }

  get<TConfig, TState, TObservation, TCommand, TCommandDefinition = unknown>(
    id: string,
    version: string,
  ): GameDefinition<TConfig, TState, TObservation, TCommand, TCommandDefinition> | undefined {
    return this.definitions.get(id)?.get(version) as
      | GameDefinition<TConfig, TState, TObservation, TCommand, TCommandDefinition>
      | undefined;
  }
}

/** Plain-JSON state suitable for Durable Object/database persistence. */
export interface IntentWindow<TCommand = unknown> extends TurnCursor {
  sessionId: string;
  /** Canonical lexicographic order used for deterministic resolution. */
  participants: string[];
  intents: Record<string, CollectedIntent<TCommand>>;
}

function hasIntent<TCommand>(window: IntentWindow<TCommand>, participantId: string): boolean {
  return Object.prototype.hasOwnProperty.call(window.intents, participantId);
}

export type IntentCollectionResult<TCommand = unknown> =
  | {
      status: 'pending';
      window: IntentWindow<TCommand>;
      submittedParticipants: string[];
      awaitingParticipants: string[];
    }
  | {
      status: 'ready';
      window: IntentWindow<TCommand>;
      /** Always follows `window.participants`, never request arrival order. */
      intents: CollectedIntent<TCommand>[];
    };

export type IntentErrorCode =
  | 'invalid_protocol'
  | 'wrong_session'
  | 'stale_turn'
  | 'unknown_participant'
  | 'invalid_submission'
  | 'conflicting_intent';

export class IntentCollectionError extends Error {
  constructor(
    public readonly code: IntentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IntentCollectionError';
  }
}

export function makeTurnId(sessionId: string, revision: number): string {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('sessionId must be a non-empty string');
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('revision must be a non-negative safe integer');
  }
  return `${sessionId}:${revision}`;
}

export function createIntentWindow<TCommand>(
  sessionId: string,
  revision: number,
  participantIds: readonly string[],
): IntentWindow<TCommand> {
  makeTurnId(sessionId, revision);
  if (!Array.isArray(participantIds) || participantIds.some(
    (id) => !isParticipantId(id),
  )) {
    throw new Error('participant ids must match the portable ASCII seat-id pattern');
  }
  const participants = [...new Set(participantIds)].sort();
  if (participants.length === 0) throw new Error('at least one participant is required');
  if (participants.length !== participantIds.length) {
    throw new Error('participant ids must be non-empty and unique');
  }
  return {
    sessionId,
    turnId: makeTurnId(sessionId, revision),
    revision,
    participants,
    intents: {},
  };
}

/**
 * Add one intent without mutating the persisted input window. Exact retries
 * are idempotent; stale or conflicting submissions are explicit errors. A
 * ready result may be recomputed for an exact retry. The host must atomically
 * commit resolution, its retry receipt, and the next intent window to ensure
 * the reducer itself runs once.
 */
export function collectIntent<TCommand>(
  window: IntentWindow<TCommand>,
  submission: CommandSubmission<TCommand>,
): IntentCollectionResult<TCommand> {
  validateIntentSubmission(window, submission);
  const existing = hasIntent(window, submission.participantId)
    ? window.intents[submission.participantId]
    : undefined;
  if (existing) {
    if (
      existing.submissionId === submission.submissionId
      && stableJson(existing.command) === stableJson(submission.command)
    ) {
      const submittedParticipants = window.participants.filter((id) => hasIntent(window, id));
      const awaitingParticipants = window.participants.filter((id) => !hasIntent(window, id));
      if (awaitingParticipants.length > 0) {
        return { status: 'pending', window, submittedParticipants, awaitingParticipants };
      }
      return {
        status: 'ready',
        window,
        intents: window.participants.map((id) => window.intents[id]!),
      };
    }
    throw new IntentCollectionError(
      'conflicting_intent',
      `participant ${submission.participantId} submitted a different intent for ${window.turnId}`,
    );
  }

  const intent: CollectedIntent<TCommand> = {
    participantId: submission.participantId,
    submissionId: submission.submissionId,
    command: submission.command,
  };
  const next: IntentWindow<TCommand> = {
    ...window,
    participants: [...window.participants],
    intents: { ...window.intents, [submission.participantId]: intent },
  };
  const submittedParticipants = next.participants.filter((id) => hasIntent(next, id));
  const awaitingParticipants = next.participants.filter((id) => !hasIntent(next, id));
  if (awaitingParticipants.length > 0) {
    return { status: 'pending', window: next, submittedParticipants, awaitingParticipants };
  }
  return {
    status: 'ready',
    window: next,
    intents: next.participants.map((id) => next.intents[id]!),
  };
}

/** Validate the stable wire cursor before interpreting a game-owned command. */
export function validateIntentSubmission<TCommand>(
  window: IntentWindow<unknown>,
  submission: CommandSubmission<TCommand>,
): void {
  if (submission.protocol !== PROTOCOL_ID || submission.protocolVersion !== PROTOCOL_VERSION) {
    throw new IntentCollectionError(
      'invalid_protocol',
      `expected ${PROTOCOL_ID} ${PROTOCOL_VERSION}`,
    );
  }
  if (submission.sessionId !== window.sessionId) {
    throw new IntentCollectionError('wrong_session', 'submission session does not match endpoint');
  }
  if (submission.turnId !== window.turnId || submission.revision !== window.revision) {
    throw new IntentCollectionError(
      'stale_turn',
      `expected turn ${window.turnId} revision ${window.revision}`,
    );
  }
  if (!window.participants.includes(submission.participantId)) {
    throw new IntentCollectionError(
      'unknown_participant',
      `unknown participant ${submission.participantId}`,
    );
  }
  if (typeof submission.submissionId !== 'string' || !submission.submissionId.trim()) {
    throw new IntentCollectionError('invalid_submission', 'submissionId is required');
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function turnEnvelope<TObservation>(
  sessionId: string,
  revision: number,
  turn: TObservation,
  extensions?: ProtocolExtensions,
): TurnEnvelope<TObservation> {
  return {
    protocol: PROTOCOL_ID,
    protocolVersion: PROTOCOL_VERSION,
    kind: 'turn',
    sessionId,
    turnId: makeTurnId(sessionId, revision),
    revision,
    turn,
    ...(extensions ? { extensions } : {}),
  };
}

export function pendingEnvelope<TObservation, TCommand>(
  window: IntentWindow<TCommand>,
  turn: TObservation,
  acceptedParticipantId?: string,
  extensions?: ProtocolExtensions,
): PendingEnvelope<TObservation> {
  const submittedParticipants = window.participants.filter((id) => hasIntent(window, id));
  return {
    protocol: PROTOCOL_ID,
    protocolVersion: PROTOCOL_VERSION,
    kind: 'pending',
    sessionId: window.sessionId,
    turnId: window.turnId,
    revision: window.revision,
    turn,
    ...(acceptedParticipantId ? { acceptedParticipantId } : {}),
    submittedParticipants,
    awaitingParticipants: window.participants.filter((id) => !hasIntent(window, id)),
    ...(extensions ? { extensions } : {}),
  };
}
