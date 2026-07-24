import type {
  Outcome,
  SubmittedAction,
  TurnReducer,
  TurnView,
} from './contracts.js';
import { enumerateActions } from './solver.js';

export const AGENT_TRANSCRIPT_VERSION = '1.2' as const;

export type AgentEnvironmentErrorCode = 'not_started' | 'episode_done' | 'illegal_action';

export class AgentEnvironmentError extends Error {
  constructor(
    public readonly code: AgentEnvironmentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AgentEnvironmentError';
  }
}

export type AgentTerminationReason = 'won' | 'failed' | 'decided' | 'step_limit';

export interface AgentMetrics {
  steps: number;
  totalReward: number;
  status: TurnView['status'];
  stars: number | null;
  actionsUsed: number;
  outcome?: Outcome;
}

export interface AgentTurnInfo extends AgentMetrics {
  seed: number;
  seat?: string;
  terminationReason: AgentTerminationReason | null;
}

/** One Gym-style interaction result with both schemas and concrete actions. */
export interface AgentTurn<TView extends TurnView<unknown, unknown>> {
  observation: TView;
  actionDefinitions: TView['actions'];
  legalActions: SubmittedAction[];
  systemActions: SubmittedAction[];
  reward: number;
  terminated: boolean;
  truncated: boolean;
  done: boolean;
  info: AgentTurnInfo;
}

export interface AgentTranscriptAction<TView extends TurnView<unknown, unknown> = TurnView<unknown, unknown>> {
  n: number;
  action: SubmittedAction;
  reward: number;
  status: TurnView['status'];
  actionsUsed: number;
  /** Observation returned to this agent after the action. */
  observation: TView;
}

export interface AgentTranscript<
  TLevel,
  TView extends TurnView<unknown, unknown> = TurnView<unknown, unknown>,
> {
  version: typeof AGENT_TRANSCRIPT_VERSION;
  level: TLevel;
  seed: number;
  seat?: string;
  frameSkip: number;
  /** Redacted initial observation for the configured seat. */
  initialObservation: TView;
  actions: Array<AgentTranscriptAction<TView>>;
  result: AgentTurnInfo;
}

export interface AgentEnvironmentOptions<TLevel, TState, TView extends TurnView<unknown, unknown>> {
  reducer: TurnReducer<TLevel, TState, TView>;
  level: TLevel;
  seed?: number;
  /** Agent seat. Uses reducer.viewFor when available. */
  seat?: string;
  /** Independent safety bound for an agent episode. Defaults to 10,000 steps. */
  maxSteps?: number;
  /** Reducer ticks applied per agent decision. Defaults to one. */
  frameSkip?: number;
  /**
   * Product-defined held/continue input for skipped frames. Defaults to
   * repeating the chosen action. An illegal continuation ends the skip early.
   */
  continueAction?: (
    chosen: SubmittedAction,
    frame: number,
    view: TView,
  ) => SubmittedAction;
  enumerateActions?: (view: TView) => SubmittedAction[];
  isActionLegal?: (
    action: SubmittedAction,
    view: TView,
    concreteActions: readonly SubmittedAction[],
  ) => boolean;
  reward?: (
    previous: TView,
    next: TView,
    action: SubmittedAction,
    step: number,
    seat?: string,
  ) => number;
  /** Snapshot level data for deterministic transcripts. Defaults to structuredClone. */
  snapshotLevel?: (level: TLevel) => TLevel;
  /** Snapshot observations for deterministic transcripts. Defaults to structuredClone. */
  snapshotObservation?: (view: TView) => TView;
}

export interface AgentResetOptions<TLevel> {
  level?: TLevel;
  seed?: number;
}

function actionKey(action: SubmittedAction): string {
  return JSON.stringify({
    id: action.id,
    ...(action.x !== undefined ? { x: action.x } : {}),
    ...(action.y !== undefined ? { y: action.y } : {}),
    ...(action.index !== undefined ? { index: action.index } : {}),
    ...(action.boardId !== undefined ? { boardId: action.boardId } : {}),
    ...(action.zoneId !== undefined ? { zoneId: action.zoneId } : {}),
    ...(action.seat !== undefined ? { seat: action.seat } : {}),
    ...(action.targets !== undefined ? { targets: action.targets } : {}),
  });
}

function copyAction(action: SubmittedAction): SubmittedAction {
  return {
    ...action,
    ...(action.targets ? {
      targets: action.targets.map((target) => ({
        container: target.container,
        coord: Array.isArray(target.coord) ? [...target.coord] : target.coord,
      })),
    } : {}),
  };
}

function copyOutcome(outcome: Outcome): Outcome {
  return outcome.kind === 'ongoing'
    ? { kind: 'ongoing' }
    : {
      kind: 'decided',
      ranking: outcome.ranking.map((entry) => ({ ...entry })),
      ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
    };
}

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
}

/**
 * Provider-neutral, deterministic environment for agentic play.
 *
 * Products inject their reducer and content. The SDK owns episode lifecycle,
 * concrete action discovery, validation, reward accounting, and transcripts.
 */
export class AgentEnvironment<TLevel, TState, TView extends TurnView<unknown, unknown>> {
  private level: TLevel;
  private seed: number;
  private readonly maxSteps: number;
  private readonly frameSkip: number;
  private readonly enumerateActions: (view: TView) => SubmittedAction[];
  private readonly isActionLegal: NonNullable<AgentEnvironmentOptions<TLevel, TState, TView>['isActionLegal']>;
  private readonly rewardFor: NonNullable<AgentEnvironmentOptions<TLevel, TState, TView>['reward']>;
  private state: TState | undefined;
  private steps = 0;
  private totalReward = 0;
  private lastReward = 0;
  private ended = false;
  private terminationReason: AgentTerminationReason | null = null;
  private records: Array<AgentTranscriptAction<TView>> = [];
  private transcriptLevel: TLevel | undefined;
  private initialObservation: TView | undefined;
  private readonly snapshotLevel: (level: TLevel) => TLevel;
  private readonly snapshotObservation: (view: TView) => TView;

  constructor(private readonly options: AgentEnvironmentOptions<TLevel, TState, TView>) {
    this.level = options.level;
    this.seed = options.seed ?? 1;
    assertSeed(this.seed);
    if (options.seat !== undefined && (typeof options.seat !== 'string' || options.seat.length === 0)) {
      throw new TypeError('seat must be a non-empty string');
    }
    this.maxSteps = options.maxSteps ?? 10_000;
    if (!Number.isSafeInteger(this.maxSteps) || this.maxSteps <= 0) {
      throw new RangeError('maxSteps must be a positive safe integer');
    }
    this.frameSkip = options.frameSkip ?? 1;
    if (!Number.isSafeInteger(this.frameSkip) || this.frameSkip < 1) {
      throw new RangeError('frameSkip must be a positive safe integer');
    }
    if (options.continueAction !== undefined && typeof options.continueAction !== 'function') {
      throw new TypeError('continueAction must be a function');
    }
    this.enumerateActions = options.enumerateActions ?? ((view) => enumerateActions(view));
    this.isActionLegal = options.isActionLegal ?? ((action, _view, concrete) => {
      const withoutHostedSeat = (value: SubmittedAction): SubmittedAction => (
        options.seat && value.seat === options.seat
          ? { ...value, seat: undefined }
          : value
      );
      const candidate = actionKey(withoutHostedSeat(action));
      return concrete.some((legal) => actionKey(withoutHostedSeat(legal)) === candidate);
    });
    this.rewardFor = options.reward ?? ((_previous, next) => {
      if (options.seat && next.outcome?.kind === 'decided') {
        const result = next.outcome.ranking.find(({ seat }) => seat === options.seat);
        if (result) return result.score ?? (result.rank === 1 ? 1 : 0);
      }
      return next.status === 'won' ? (next.stars ?? 1) : 0;
    });
    this.snapshotLevel = options.snapshotLevel ?? ((level) => {
      try {
        return structuredClone(level);
      } catch (error) {
        throw new TypeError('level is not cloneable; provide AgentEnvironmentOptions.snapshotLevel', { cause: error });
      }
    });
    this.snapshotObservation = options.snapshotObservation ?? ((view) => {
      try {
        return structuredClone(view);
      } catch (error) {
        throw new TypeError(
          'view is not cloneable; provide AgentEnvironmentOptions.snapshotObservation',
          { cause: error },
        );
      }
    });
  }

  reset(options: AgentResetOptions<TLevel> = {}): AgentTurn<TView> {
    if (options.level !== undefined) this.level = options.level;
    if (options.seed !== undefined) this.seed = options.seed;
    assertSeed(this.seed);
    this.transcriptLevel = this.snapshotLevel(this.level);
    this.state = this.options.reducer.init(this.level, this.seed);
    this.steps = 0;
    this.totalReward = 0;
    this.lastReward = 0;
    this.ended = false;
    this.terminationReason = null;
    this.records = [];
    const view = this.viewOf(this.state);
    this.initialObservation = this.snapshotObservation(view);
    if (view.status !== 'playing' || view.outcome?.kind === 'decided') {
      this.ended = true;
      this.terminationReason = view.status !== 'playing' ? view.status : 'decided';
    }
    return this.turn(view);
  }

  observe(): AgentTurn<TView> {
    return this.turn(this.currentView());
  }

  step(action: SubmittedAction): AgentTurn<TView> {
    return this.stepInternal(action, this.frameSkip);
  }

  private stepInternal(action: SubmittedAction, requestedFrames: number): AgentTurn<TView> {
    if (this.state === undefined) {
      throw new AgentEnvironmentError('not_started', 'call reset() before step()');
    }
    if (this.ended) {
      throw new AgentEnvironmentError('episode_done', 'reset the environment before another step');
    }
    let next = this.currentView();
    let accumulatedReward = 0;
    let chosen = copyAction(action);
    for (let frame = 0; frame < requestedFrames && !this.ended; frame++) {
      const previous = next;
      const gameplay = this.enumerateActions(previous);
      const systems = previous.systemActions
        ? enumerateActions({ ...previous, actions: previous.systemActions })
        : [];
      const candidate = frame === 0
        ? chosen
        : copyAction(this.options.continueAction?.(chosen, frame, previous) ?? chosen);
      const concrete = [...gameplay, ...systems];
      if (!this.isActionLegal(candidate, previous, concrete)) {
        if (frame > 0) break;
        throw new AgentEnvironmentError(
          'illegal_action',
          `action is not legal this turn: ${actionKey(candidate)}`,
        );
      }
      if (this.options.seat && candidate.seat !== undefined
        && candidate.seat !== this.options.seat) {
        throw new AgentEnvironmentError(
          'illegal_action',
          `action seat ${candidate.seat} does not match environment seat ${this.options.seat}`,
        );
      }
      const appliedAction = this.options.seat && candidate.seat === undefined
        ? { ...candidate, seat: this.options.seat }
        : candidate;
      this.state = this.options.reducer.apply(this.state!, appliedAction);
      this.steps++;
      next = this.viewOf(this.state);
      const reward = this.rewardFor(
        previous,
        next,
        appliedAction,
        this.steps,
        this.options.seat,
      );
      if (!Number.isFinite(reward)) throw new TypeError('reward must be finite');
      accumulatedReward += reward;
      this.totalReward += reward;

      if (next.status !== 'playing' || next.outcome?.kind === 'decided') {
        this.ended = true;
        this.terminationReason = next.status !== 'playing' ? next.status : 'decided';
      } else if (this.steps >= this.maxSteps) {
        this.ended = true;
        this.terminationReason = 'step_limit';
      }
      this.records.push({
        n: this.steps,
        action: copyAction(appliedAction),
        reward,
        status: next.status,
        actionsUsed: next.hud.actionsUsed,
        observation: this.snapshotObservation(next),
      });
      // Semantic host controls are one-shot and never held across frames.
      if (systems.some((system) => actionKey(system) === actionKey(candidate))) break;
    }
    this.lastReward = accumulatedReward;
    return this.turn(next);
  }

  /** Reset and deterministically replay a canonical action list. */
  replay(actions: readonly SubmittedAction[], options: AgentResetOptions<TLevel> = {}): AgentTurn<TView> {
    let turn = this.reset(options);
    for (const action of actions) turn = this.stepInternal(action, 1);
    return turn;
  }

  transcript(): AgentTranscript<TLevel, TView> {
    const turn = this.observe();
    if (this.transcriptLevel === undefined || this.initialObservation === undefined) {
      throw new AgentEnvironmentError('not_started', 'call reset() before transcript()');
    }
    return {
      version: AGENT_TRANSCRIPT_VERSION,
      level: this.snapshotLevel(this.transcriptLevel),
      seed: this.seed,
      ...(this.options.seat ? { seat: this.options.seat } : {}),
      frameSkip: this.frameSkip,
      initialObservation: this.snapshotObservation(this.initialObservation),
      actions: this.records.map((record) => ({
        ...record,
        action: copyAction(record.action),
        observation: this.snapshotObservation(record.observation),
      })),
      result: {
        ...turn.info,
        ...(turn.info.outcome ? { outcome: copyOutcome(turn.info.outcome) } : {}),
      },
    };
  }

  private currentView(): TView {
    if (this.state === undefined) {
      throw new AgentEnvironmentError('not_started', 'call reset() before observe()');
    }
    return this.viewOf(this.state);
  }

  private viewOf(state: TState): TView {
    return this.options.seat && this.options.reducer.viewFor
      ? this.options.reducer.viewFor(state, this.options.seat)
      : this.options.reducer.view(state);
  }

  private turn(view: TView): AgentTurn<TView> {
    const terminated = this.ended && this.terminationReason !== 'step_limit';
    const truncated = this.terminationReason === 'step_limit';
    return {
      observation: view,
      actionDefinitions: view.actions,
      legalActions: this.ended ? [] : this.enumerateActions(view),
      systemActions: this.ended || !view.systemActions
        ? []
        : enumerateActions({ ...view, actions: view.systemActions }),
      reward: this.lastReward,
      terminated,
      truncated,
      done: terminated || truncated,
      info: {
        seed: this.seed,
        ...(this.options.seat ? { seat: this.options.seat } : {}),
        steps: this.steps,
        totalReward: this.totalReward,
        status: view.status,
        stars: view.stars ?? null,
        actionsUsed: view.hud.actionsUsed,
        ...(view.outcome ? { outcome: copyOutcome(view.outcome) } : {}),
        terminationReason: this.terminationReason,
      },
    };
  }
}
