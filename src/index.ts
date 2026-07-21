/**
 * TypeScript client for the GAOS-hosted Arena session API.
 * Stable wire-format types come from this package's protocol module; Arena observation
 * types remain the adapter layer in this package. Used by the renderer and
 * any Node-based agent harness — no game logic lives here, the server (or the
 * bundled engine, for local play) is authoritative.
 */

import {
  PROTOCOL_ID,
  PROTOCOL_VERSION,
  isParticipantId,
  type CommandSubmission,
  type PendingEnvelope,
  type TurnCursor,
  type TurnEnvelope,
  type TurnResult,
} from './protocol.js';

export {
  PARTICIPANT_ID_PATTERN,
  PROTOCOL_ID,
  PROTOCOL_VERSION,
  isParticipantId,
  type CommandSubmission,
  type GameDefinition,
  type PendingEnvelope,
  type TurnCursor,
  type TurnEnvelope,
  type TurnResult,
} from './protocol.js';

/** Namespaced hosted-Arena concurrency extension; additive to Turns v1. */
export const ARENA_CONTROL_EXTENSION = 'agilabs.arena' as const;

export interface ActionDef {
  id: string;
  params: 'none' | 'xy' | 'index';
  text?: string;
}

export interface VisualEvent {
  type: string;
  [key: string]: unknown;
}

export interface TurnCharacter {
  id: string;
  /** Owning participant/seat in simultaneous modes such as Arena. */
  participantId?: string;
  team: string;
  /** Top-left footprint anchor in wire coordinates `[x, y]`. */
  at: [number, number];
  footprint?: { width: number; height: number };
  elevated?: boolean;
  character?: string;
  cast?: string;
  controlMode?: 'direct' | 'conversation';
  activationGroup?: string;
  conversionLocked?: boolean;
  abilities?: string[];
  statuses?: Array<{
    kind: string;
    phase?: string;
    remaining?: number;
    capacity?: number;
    radius?: number;
    dir?: [number, number];
    range?: number;
  }>;
}

export interface TurnUnit extends TurnCharacter {
  hp: number;
  maxHp: number;
}

export interface TurnHud {
  /** Visible Archive File position in client coordinates [x, y]. */
  archiveAt?: [number, number];
  actionsUsed: number;
  maxActions: number;
  actionBudgetUsed?: number;
  actionBudgetMax?: number;
  energyUsed?: number;
  energyCap?: number;
  carrying: number | null;
  items?: Array<{
    index: number;
    kind: string;
    shape?: number;
    charge?: number;
    targetRange: number;
    targetKind: string;
  }>;
  /** Existing battle-unit integrity contract. */
  units?: TurnUnit[];
  /** Batteries seated in plug sockets, including their remaining charge. */
  pluggedBatteries?: Array<{ at: [number, number]; charge: number }>;
  /** Additive cast/control observation, also present outside combat. */
  characters?: TurnCharacter[];
  mode?: string;
  targetableCells?: Array<[number, number]>;
  actionTargeting?: Record<string, {
    targetableCells: Array<[number, number]>;
    npcPathPreviewOrigin?: [number, number];
    npcPathPreviewKind?: 'move' | 'pickup' | 'throw' | 'ray' | 'footprint' | 'direction' | 'hack' | 'shield';
    npcPathPreviewFootprint?: [number, number];
    npcPathPreviewRange?: number;
  }>;
  npcPathPreviewOrigin?: [number, number];
  npcPathPreviewKind?: 'move' | 'pickup' | 'throw' | 'ray' | 'footprint' | 'direction' | 'hack' | 'shield';
  npcPathPreviewFootprint?: [number, number];
  npcPathPreviewRange?: number;
  npcPathPreviewTarget?: [number, number];
  npcPathPreviewCells?: Array<[number, number]>;
  dialogueOptions?: Array<{ index: number; text: string }>;
  pois?: Array<{ index: number; label: string; at: [number, number] }>;
  /** Interrogation / stealth cover meter (Intelligence-Lies, Jailbreak). */
  suspicion?: number;
  suspicionCap?: number;
  /** Multi-goal objective slot (Jailbreak): visible + hidden goals. */
  objectives?: Array<{ id: string; label: string; done: boolean }>;
  /** Seat-relative terminal Arena result. Draws retain status="failed" for
   * protocol compatibility and are distinguished here. */
  arenaOutcome?: 'won' | 'lost' | 'draw';
  /** Cells currently inside a guard's sightline (Jailbreak). */
  watchedCells?: Array<[number, number]>;
  /** Destinations a commanded NPC is walking toward (Signal Language). */
  waypoints?: Array<[number, number]>;
  /** Conversation anchor — who the agent is addressing (dialogue GUI). */
  talkingTo?: {
    id: string;
    at: [number, number];
    character?: string;
    emotion?: string;
    speaker?: 'npc' | 'player';
  };
  dialogueSpeaker?: 'npc' | 'player';
  dialogueEmotion?: string;
}

export interface Turn {
  turnNumber: number;
  /** Seat-local UI/control substep. Arena may advance this without resolving the world turn. */
  controlRevision?: number;
  narrative: string | null;
  grid: string;
  visualEvents: VisualEvent[];
  actions: ActionDef[];
  status: 'playing' | 'won' | 'failed';
  stars?: number;
  hud: TurnHud;
}

export interface SessionRequest {
  gameMode: 'story' | 'challenge' | 'escape';
  playMethod: 'human' | 'coach' | 'autonomous_local' | 'autonomous_scored';
  /** Per-level sessions (human/coach/autonomous_local practice). */
  levelId?: string;
  /** Play a published community level instead of an official one (any
   *  unscored play method: human, coach, autonomous_local). */
  communityLevelId?: string;
  /** Editor playtest: play this exact LevelConfig inline, so drafts and
   *  just-saved edits run verbatim without a publish or worker reload. */
  level?: unknown;
  /**
   * Challenge autonomous_scored: the run spans this game type's FULL scored
   * level set as one session (level_advance events roll it level-to-level).
   * A single-level scored request is not a valid shape.
   */
  gameId?: string;
  seasonId?: string;
  /** Debug console only: override the level's capability locks (e.g. ['attack']). */
  unlocks?: string[];
  /** Required player seats for games with a simultaneous `resolveTurn` adapter. */
  participants?: string[];
}

export interface ActionSubmit {
  id: string;
  x?: number;
  y?: number;
  index?: number;
}

export interface RunSummary {
  gameId: string;
  levels: number;
  results: Array<{ levelId: string; status: 'won' | 'failed'; stars: number | null; actionsUsed: number }>;
  totalStars: number;
  totalSteps: number;
}

export interface SubmitSummary {
  sessionId: string;
  status: 'won' | 'failed';
  stars: number | null;
  actionsUsed: number;
  transcriptLength: number;
  /** Present for game-type scored runs: the per-level results and totals. */
  run?: RunSummary;
}

export interface SessionBinding extends TurnCursor {
  sessionId: string;
  participantId: string;
  protocol: typeof PROTOCOL_ID;
  protocolVersion: typeof PROTOCOL_VERSION;
  /** Latest seat-local Arena control substep, when exposed by the game observation. */
  controlRevision?: number;
}

export interface SessionStart {
  sessionId: string;
  turn: Turn;
  /** Opaque concurrency binding to retain when handing a session between UIs. */
  binding: SessionBinding;
}

export interface ArenaQueueRequest {
  /** Public Arena exhibition map selected for this queue entry. */
  mapId: string;
  /** Game-owned roster/team preset; it is not an authenticated seat id. */
  teamId: string;
  /** Retry key. Omit only when the caller will not retry an ambiguous request. */
  requestId?: string;
}

export interface ArenaCatalog {
  maps: Array<{
    id: string;
    gameId: string;
    version: number;
    name: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    members: Array<{
      id: string;
      characterId: string;
      control: 'direct' | 'conversation';
    }>;
  }>;
}

export interface ArenaQueueTicket {
  queueId: string;
  ticketId: string;
  state: 'waiting' | 'matching' | 'matched' | 'completed' | 'cancelled' | 'expired';
  joinedAt: number;
  expiresAt: number;
  mapId: string;
  teamId: string;
  matchId: string | null;
  participantId: string | null;
}

const ARENA_QUEUE_STATES = new Set<ArenaQueueTicket['state']>([
  'waiting', 'matching', 'matched', 'completed', 'cancelled', 'expired',
]);

function arenaQueueTicketFrom(
  value: unknown,
  fallbackQueueId?: unknown,
): ArenaQueueTicket | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const ticket = value as Record<string, unknown>;
  const queueId = typeof ticket['queueId'] === 'string' ? ticket['queueId'] : fallbackQueueId;
  const state = ticket['state'];
  const matchId = ticket['matchId'];
  const participantId = ticket['participantId'];
  if (
    typeof queueId !== 'string' || !queueId
    || typeof ticket['ticketId'] !== 'string' || !ticket['ticketId']
    || typeof state !== 'string' || !ARENA_QUEUE_STATES.has(state as ArenaQueueTicket['state'])
    || typeof ticket['joinedAt'] !== 'number' || !Number.isFinite(ticket['joinedAt'])
    || typeof ticket['expiresAt'] !== 'number' || !Number.isFinite(ticket['expiresAt'])
    || typeof ticket['mapId'] !== 'string' || !ticket['mapId']
    || typeof ticket['teamId'] !== 'string' || !ticket['teamId']
    || (matchId !== null && typeof matchId !== 'string')
    || (participantId !== null
      && (typeof participantId !== 'string' || !isParticipantId(participantId)))
  ) return undefined;
  return { ...ticket, queueId } as unknown as ArenaQueueTicket;
}

export interface ArenaOutcome {
  winner: string | null;
  loser: string | null;
  reason: 'game' | 'disconnect' | 'idle' | 'abandoned';
  gameReason?: string;
}

export interface ArenaRoom<TObservation = Turn> {
  matchId: string;
  sessionId: string;
  status: 'connecting' | 'active' | 'completed' | 'expired';
  participantId: string;
  readyDeadline: number;
  turnDeadline: number | null;
  expiresAt: number | null;
  participants: Array<{
    participantId: string;
    claimed: boolean;
    connected: boolean;
    reconnectDeadline: number | null;
  }>;
  /** Authoritative when network policy completes a still-playing game turn. */
  outcome: ArenaOutcome | null;
  turn: TurnResult<TObservation>;
}

export class ProtocolMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolMismatchError';
  }
}

/** Runtime guard shared by clients that consume opaque game observations. */
export function parseTurnResult<TObservation = unknown>(data: unknown): TurnResult<TObservation> {
  if (!data || typeof data !== 'object') throw new ProtocolMismatchError('response is not an object');
  const value = data as Record<string, unknown>;
  if (value['protocol'] !== PROTOCOL_ID || value['protocolVersion'] !== PROTOCOL_VERSION) {
    throw new ProtocolMismatchError(`expected ${PROTOCOL_ID} ${PROTOCOL_VERSION}`);
  }
  if (value['kind'] !== 'turn' && value['kind'] !== 'pending') {
    throw new ProtocolMismatchError('response kind must be turn or pending');
  }
  if (
    typeof value['sessionId'] !== 'string'
    || !value['sessionId'].trim()
    || typeof value['turnId'] !== 'string'
    || !value['turnId'].trim()
  ) {
    throw new ProtocolMismatchError('response sessionId/turnId missing');
  }
  if (
    !Number.isSafeInteger(value['revision'])
    || (value['revision'] as number) < 0
    || !Object.hasOwn(value, 'turn')
  ) {
    throw new ProtocolMismatchError('response revision/turn missing');
  }
  if (value['kind'] === 'pending') {
    if (
      !isParticipantList(value['submittedParticipants'])
      || !isParticipantList(value['awaitingParticipants'])
    ) {
      throw new ProtocolMismatchError('pending participant lists missing');
    }
  }
  return value as unknown as TurnResult<TObservation>;
}

function isParticipantList(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((participantId) => (
      isParticipantId(participantId)
    ));
}

/** Agent API key metadata (GET /keys) — never includes key material. */
export interface AgentKeyInfo {
  id: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export class ArenaApiError extends Error {
  /** Structured active-ticket recovery data returned by matchmaking 409s. */
  readonly ticket?: ArenaQueueTicket;

  constructor(
    public status: number,
    public error: string,
    public code?: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(`HTTP ${status}: ${error}`);
    this.name = 'ArenaApiError';
    this.ticket = arenaQueueTicketFrom(details?.['ticket'], details?.['queueId']);
  }
}

/** 422 — the action was not in the legal set for this turn. */
export class IllegalActionRejected extends ArenaApiError {
  constructor(
    status: number,
    error: string,
    code?: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(status, error, code, details);
    this.name = 'IllegalActionRejected';
  }
}

/**
 * Bearer credential for API calls: a static key ("ak_…" agent keys), or a
 * provider function re-read on EVERY request — auth tokens (e.g. Supabase
 * access JWTs) rotate, so callers pass a getter and the freshest token is
 * attached per call. Returning null/undefined sends the request anonymous.
 */
export type ApiKeyProvider =
  | string
  | (() => string | null | undefined | Promise<string | null | undefined>);

export class ArenaClient {
  private readonly bindings = new Map<string, SessionBinding>();

  constructor(
    private baseUrl = 'http://localhost:8899',
    private apiKey?: ApiKeyProvider,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private remember<T>(result: TurnResult<T>, participantId?: string): SessionBinding {
    const previous = this.bindings.get(result.sessionId);
    const observation = result.turn as T & { controlRevision?: unknown };
    const controlRevision = Number.isSafeInteger(observation?.controlRevision)
      && (observation.controlRevision as number) >= 0
      ? observation.controlRevision as number
      : undefined;
    const binding: SessionBinding = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      sessionId: result.sessionId,
      turnId: result.turnId,
      revision: result.revision,
      participantId: participantId ?? previous?.participantId ?? 'player',
      ...(controlRevision !== undefined ? { controlRevision } : {}),
    };
    this.bindings.set(result.sessionId, binding);
    return binding;
  }

  private parse<T>(data: unknown, expectedSessionId?: string): TurnResult<T> {
    const result = parseTurnResult<T>(data);
    if (expectedSessionId && result.sessionId !== expectedSessionId) {
      throw new ProtocolMismatchError('response session does not match request');
    }
    return result;
  }

  private parseArenaRoom<T>(data: unknown, expectedSessionId: string): ArenaRoom<T> {
    if (!data || typeof data !== 'object') throw new ProtocolMismatchError('Arena room is not an object');
    const value = data as Record<string, unknown>;
    if (value['sessionId'] !== expectedSessionId || value['matchId'] !== expectedSessionId) {
      throw new ProtocolMismatchError('Arena room does not match request');
    }
    if (typeof value['participantId'] !== 'string' || !isParticipantId(value['participantId'])) {
      throw new ProtocolMismatchError('Arena room participant missing');
    }
    const turn = this.parse<T>(value['turn'], expectedSessionId);
    this.remember(turn, value['participantId']);
    return { ...value, turn } as unknown as ArenaRoom<T>;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const key = typeof this.apiKey === 'function' ? await this.apiKey() : this.apiKey;
    const res = await fetch(this.baseUrl + path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
    });
    const data = (await res.json()) as T & { error?: string; code?: string };
    if (!res.ok) {
      const message = data?.error ?? res.statusText;
      const code = typeof data?.code === 'string' ? data.code : undefined;
      const details = data && typeof data === 'object'
        ? data as Readonly<Record<string, unknown>>
        : undefined;
      if (res.status === 422) throw new IllegalActionRejected(res.status, message, code, details);
      throw new ArenaApiError(res.status, message, code, details);
    }
    return data;
  }

  async createSession(req: SessionRequest, participantId = 'player'): Promise<SessionStart> {
    const result = this.parse<Turn>(await this.call('POST', '/v1/sessions', req));
    if (result.kind !== 'turn') throw new ProtocolMismatchError('new session must start resolved');
    const binding = this.remember(result, participantId);
    return { sessionId: result.sessionId, turn: result.turn, binding };
  }

  async getTurnEnvelope(sessionId: string): Promise<TurnResult<Turn>> {
    const result = this.parse<Turn>(
      await this.call('GET', `/v1/sessions/${sessionId}/turn`),
      sessionId,
    );
    this.remember(result);
    return result;
  }

  /** Compatibility view: returns the latest resolved observation while pending. */
  async getTurn(sessionId: string): Promise<Turn> {
    return (await this.getTurnEnvelope(sessionId)).turn;
  }

  /** Stable v1 primitive for any JSON command and any game observation shape. */
  async submitIntent<TCommand, TObservation = Turn>(
    sessionId: string,
    command: TCommand,
    opts: {
      participantId?: string;
      submissionId?: string;
      cursor?: TurnCursor;
    } = {},
  ): Promise<TurnResult<TObservation>> {
    return this.submitIntentTo(
      `/v1/sessions/${sessionId}/actions`,
      sessionId,
      command,
      opts,
    );
  }

  private async submitIntentTo<TCommand, TObservation>(
    path: string,
    sessionId: string,
    command: TCommand,
    opts: {
      participantId?: string;
      submissionId?: string;
      cursor?: TurnCursor;
      controlRevision?: number;
    },
  ): Promise<TurnResult<TObservation>> {
    let binding = this.bindings.get(sessionId);
    if (!binding && !opts.cursor) {
      await this.getTurnEnvelope(sessionId);
      binding = this.bindings.get(sessionId);
    }
    const cursor = opts.cursor ?? binding;
    if (!cursor) throw new ProtocolMismatchError('session cursor unavailable');
    const participantId = opts.participantId ?? binding?.participantId ?? 'player';
    const submission: CommandSubmission<TCommand> = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      sessionId,
      turnId: cursor.turnId,
      revision: cursor.revision,
      participantId,
      // Stable across an application retry after an ambiguous network error.
      submissionId: opts.submissionId ?? `${participantId}:${cursor.turnId}`,
      command,
      ...(opts.controlRevision !== undefined
        ? { extensions: { [ARENA_CONTROL_EXTENSION]: { controlRevision: opts.controlRevision } } }
        : {}),
    };
    const result = this.parse<TObservation>(
      await this.call('POST', path, submission),
      sessionId,
    );
    this.remember(result, participantId);
    return result;
  }

  // ------------------------------------------------ hosted Arena mode

  arenaCatalog(): Promise<ArenaCatalog> {
    return this.call('GET', '/v1/arena/maps');
  }

  /** Join the authenticated live queue. Reuse requestId after network ambiguity. */
  joinArenaQueue(req: ArenaQueueRequest): Promise<ArenaQueueTicket> {
    return this.call('POST', '/v1/arena/matchmaking', {
      ...req,
      requestId: req.requestId ?? crypto.randomUUID(),
    });
  }

  arenaQueueTicket(queueId: string, ticketId: string): Promise<ArenaQueueTicket> {
    return this.call('GET', `/v1/arena/matchmaking/${queueId}/${ticketId}`);
  }

  cancelArenaQueueTicket(queueId: string, ticketId: string): Promise<ArenaQueueTicket> {
    return this.call('DELETE', `/v1/arena/matchmaking/${queueId}/${ticketId}`);
  }

  /** Read-only room recovery snapshot; it does not claim or heartbeat a seat. */
  async getArenaRoom<TObservation = Turn>(matchId: string): Promise<ArenaRoom<TObservation>> {
    return this.parseArenaRoom<TObservation>(
      await this.call('GET', `/v1/arena/matches/${matchId}`),
      matchId,
    );
  }

  async setArenaPresence<TObservation = Turn>(
    matchId: string,
    connected: boolean,
  ): Promise<ArenaRoom<TObservation>> {
    return this.parseArenaRoom<TObservation>(
      await this.call('POST', `/v1/arena/matches/${matchId}/presence`, { connected }),
      matchId,
    );
  }

  heartbeatArenaMatch<TObservation = Turn>(matchId: string): Promise<ArenaRoom<TObservation>> {
    return this.setArenaPresence<TObservation>(matchId, true);
  }

  /** Required after matching. The second claimed seat atomically starts turn timers. */
  connectArenaMatch<TObservation = Turn>(matchId: string): Promise<ArenaRoom<TObservation>> {
    return this.setArenaPresence<TObservation>(matchId, true);
  }

  disconnectArenaMatch<TObservation = Turn>(matchId: string): Promise<ArenaRoom<TObservation>> {
    return this.setArenaPresence<TObservation>(matchId, false);
  }

  async getArenaTurnEnvelope<TObservation = Turn>(
    matchId: string,
  ): Promise<TurnResult<TObservation>> {
    const result = this.parse<TObservation>(
      await this.call('GET', `/v1/arena/matches/${matchId}/turn`),
      matchId,
    );
    const binding = this.bindings.get(matchId);
    // Turn envelopes intentionally omit authenticated seat identity. Avoid
    // inventing the ordinary solo `player` seat when callers poll first;
    // submitArenaIntent will recover the real room binding on demand.
    if (binding) this.remember(result, binding.participantId);
    return result;
  }

  async submitArenaIntent<TCommand, TObservation = Turn>(
    matchId: string,
    command: TCommand,
    opts: { submissionId?: string; cursor?: TurnCursor; controlRevision?: number } = {},
  ): Promise<TurnResult<TObservation>> {
    let binding = this.bindings.get(matchId);
    if (!binding) {
      await this.getArenaRoom<TObservation>(matchId);
      binding = this.bindings.get(matchId);
    }
    const cursor = opts.cursor ?? binding;
    if (!cursor) throw new ProtocolMismatchError('Arena session cursor unavailable');
    const controlRevision = opts.controlRevision ?? binding?.controlRevision;
    if (!Number.isSafeInteger(controlRevision) || controlRevision! < 0) {
      throw new ProtocolMismatchError('Arena controlRevision unavailable');
    }
    const participantId = binding?.participantId ?? 'player';
    return this.submitIntentTo<TCommand, TObservation>(
      `/v1/arena/matches/${matchId}/actions`,
      matchId,
      command,
      {
        ...opts,
        cursor,
        controlRevision,
        participantId,
        submissionId: opts.submissionId
          ?? `${participantId}:${cursor.turnId}:control:${controlRevision}`,
      },
    );
  }

  /**
   * Arena convenience wrapper. Solo turns still resolve in one request; if a
   * future multiplayer Arena adapter returns pending, poll for a bounded time.
   * Generic games should call `submitIntent` and handle the discriminated union.
   */
  async submitAction(
    sessionId: string,
    action: ActionSubmit,
    opts: {
      participantId?: string;
      submissionId?: string;
      pollIntervalMs?: number;
      maxPollAttempts?: number;
    } = {},
  ): Promise<Turn> {
    const result = await this.submitIntent<ActionSubmit, Turn>(sessionId, action, opts);
    if (result.kind === 'turn') return result.turn;
    const interval = opts.pollIntervalMs ?? 250;
    const attempts = opts.maxPollAttempts ?? 120;
    for (let attempt = 0; attempt < attempts; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, interval));
      const polled = await this.getTurnEnvelope(sessionId);
      if (polled.kind === 'turn' && polled.revision > result.revision) return polled.turn;
    }
    throw new ArenaApiError(408, `timed out waiting for turn after ${attempts} polls`);
  }

  submitSession(
    sessionId: string,
    opts?: { harnessCategory?: 'llm-driven' | 'solver-assisted' },
  ): Promise<SubmitSummary> {
    return this.call('POST', `/v1/sessions/${sessionId}/submit`, opts ?? {});
  }

  labLevelVersions(): Promise<Array<{ levelId: string; version: number }>> {
    return this.call('GET', '/levels/lab/versions');
  }

  /** Self-report an unpaid Challenge claim (authenticated, stored unverified). */
  reportUnpaidChallenge(claim: { gameId: string; stars: number; steps: number }): Promise<{ recorded: boolean }> {
    return this.call('POST', '/leaderboards/challenge/unpaid', claim);
  }

  challengeBoards(gameId: string): Promise<{ paid: unknown[]; unpaid: unknown[] }> {
    return this.call('GET', `/leaderboards/challenge/${gameId}`);
  }

  // ------------------------------------------------ agent API keys (JWT only)

  /** The caller's agent keys — metadata only, never hashes or plaintexts. */
  listKeys(): Promise<AgentKeyInfo[]> {
    return this.call('GET', '/keys');
  }

  /** Mint an agent key. The plaintext `key` is returned exactly ONCE. */
  createKey(label?: string): Promise<{ key: string; label: string | null }> {
    return this.call('POST', '/keys', label === undefined ? {} : { label });
  }

  /** Revoke an agent key by id (owners only; admins can revoke any). */
  revokeKey(id: string): Promise<{ revoked: boolean }> {
    return this.call('POST', `/keys/${id}/revoke`);
  }
}
