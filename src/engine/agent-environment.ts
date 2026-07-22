import type {
  GridReducer,
  GridSubmittedAction,
  GridTurnView,
} from './contracts.js';
import { enumerateGridActions } from './solver.js';

export const AGENT_TRANSCRIPT_VERSION = '1.0' as const;

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

export type AgentTerminationReason = 'won' | 'failed' | 'step_limit';

export interface AgentMetrics {
  steps: number;
  totalReward: number;
  status: GridTurnView['status'];
  stars: number | null;
  actionsUsed: number;
}

export interface AgentTurnInfo extends AgentMetrics {
  seed: number;
  terminationReason: AgentTerminationReason | null;
}

/** One Gym-style interaction result with both schemas and concrete actions. */
export interface AgentTurn<TView extends GridTurnView> {
  observation: TView;
  actionDefinitions: TView['actions'];
  legalActions: GridSubmittedAction[];
  systemActions: GridSubmittedAction[];
  reward: number;
  terminated: boolean;
  truncated: boolean;
  done: boolean;
  info: AgentTurnInfo;
}

export interface AgentTranscriptAction {
  n: number;
  action: GridSubmittedAction;
  reward: number;
  status: GridTurnView['status'];
  actionsUsed: number;
}

export interface AgentTranscript<TLevel> {
  version: typeof AGENT_TRANSCRIPT_VERSION;
  level: TLevel;
  seed: number;
  actions: AgentTranscriptAction[];
  result: AgentTurnInfo;
}

export interface AgentEnvironmentOptions<TLevel, TState, TView extends GridTurnView> {
  reducer: GridReducer<TLevel, TState, TView>;
  level: TLevel;
  seed?: number;
  /** Independent safety bound for an agent episode. Defaults to 10,000 steps. */
  maxSteps?: number;
  enumerateActions?: (view: TView) => GridSubmittedAction[];
  isActionLegal?: (
    action: GridSubmittedAction,
    view: TView,
    concreteActions: readonly GridSubmittedAction[],
  ) => boolean;
  reward?: (
    previous: TView,
    next: TView,
    action: GridSubmittedAction,
    step: number,
  ) => number;
}

export interface AgentResetOptions<TLevel> {
  level?: TLevel;
  seed?: number;
}

function actionKey(action: GridSubmittedAction): string {
  return JSON.stringify({
    id: action.id,
    ...(action.x !== undefined ? { x: action.x } : {}),
    ...(action.y !== undefined ? { y: action.y } : {}),
    ...(action.index !== undefined ? { index: action.index } : {}),
  });
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
export class AgentEnvironment<TLevel, TState, TView extends GridTurnView> {
  private level: TLevel;
  private seed: number;
  private readonly maxSteps: number;
  private readonly enumerateActions: (view: TView) => GridSubmittedAction[];
  private readonly isActionLegal: NonNullable<AgentEnvironmentOptions<TLevel, TState, TView>['isActionLegal']>;
  private readonly rewardFor: NonNullable<AgentEnvironmentOptions<TLevel, TState, TView>['reward']>;
  private state: TState | undefined;
  private steps = 0;
  private totalReward = 0;
  private lastReward = 0;
  private ended = false;
  private terminationReason: AgentTerminationReason | null = null;
  private records: AgentTranscriptAction[] = [];

  constructor(private readonly options: AgentEnvironmentOptions<TLevel, TState, TView>) {
    this.level = options.level;
    this.seed = options.seed ?? 1;
    assertSeed(this.seed);
    this.maxSteps = options.maxSteps ?? 10_000;
    if (!Number.isSafeInteger(this.maxSteps) || this.maxSteps <= 0) {
      throw new RangeError('maxSteps must be a positive safe integer');
    }
    this.enumerateActions = options.enumerateActions ?? ((view) => enumerateGridActions(view));
    this.isActionLegal = options.isActionLegal ?? ((action, _view, concrete) => {
      const candidate = actionKey(action);
      return concrete.some((legal) => actionKey(legal) === candidate);
    });
    this.rewardFor = options.reward ?? ((_previous, next) => (
      next.status === 'won' ? (next.stars ?? 1) : 0
    ));
  }

  reset(options: AgentResetOptions<TLevel> = {}): AgentTurn<TView> {
    if (options.level !== undefined) this.level = options.level;
    if (options.seed !== undefined) this.seed = options.seed;
    assertSeed(this.seed);
    this.state = this.options.reducer.init(this.level, this.seed);
    this.steps = 0;
    this.totalReward = 0;
    this.lastReward = 0;
    this.ended = false;
    this.terminationReason = null;
    this.records = [];
    const view = this.options.reducer.view(this.state);
    if (view.status !== 'playing') {
      this.ended = true;
      this.terminationReason = view.status;
    }
    return this.turn(view);
  }

  observe(): AgentTurn<TView> {
    return this.turn(this.currentView());
  }

  step(action: GridSubmittedAction): AgentTurn<TView> {
    if (this.state === undefined) {
      throw new AgentEnvironmentError('not_started', 'call reset() before step()');
    }
    if (this.ended) {
      throw new AgentEnvironmentError('episode_done', 'reset the environment before another step');
    }
    const previous = this.options.reducer.view(this.state);
    const concrete = [
      ...this.enumerateActions(previous),
      ...(previous.systemActions
        ? enumerateGridActions({ ...previous, actions: previous.systemActions })
        : []),
    ];
    if (!this.isActionLegal(action, previous, concrete)) {
      throw new AgentEnvironmentError('illegal_action', `action is not legal this turn: ${actionKey(action)}`);
    }

    this.state = this.options.reducer.apply(this.state, action);
    this.steps++;
    const next = this.options.reducer.view(this.state);
    this.lastReward = this.rewardFor(previous, next, action, this.steps);
    if (!Number.isFinite(this.lastReward)) throw new TypeError('reward must be finite');
    this.totalReward += this.lastReward;

    if (next.status !== 'playing') {
      this.ended = true;
      this.terminationReason = next.status;
    } else if (this.steps >= this.maxSteps) {
      this.ended = true;
      this.terminationReason = 'step_limit';
    }
    this.records.push({
      n: this.steps,
      action: { ...action },
      reward: this.lastReward,
      status: next.status,
      actionsUsed: next.hud.actionsUsed,
    });
    return this.turn(next);
  }

  /** Reset and deterministically replay a canonical action list. */
  replay(actions: readonly GridSubmittedAction[], options: AgentResetOptions<TLevel> = {}): AgentTurn<TView> {
    let turn = this.reset(options);
    for (const action of actions) turn = this.step(action);
    return turn;
  }

  transcript(): AgentTranscript<TLevel> {
    const turn = this.observe();
    return {
      version: AGENT_TRANSCRIPT_VERSION,
      level: this.level,
      seed: this.seed,
      actions: this.records.map((record) => ({ ...record, action: { ...record.action } })),
      result: { ...turn.info },
    };
  }

  private currentView(): TView {
    if (this.state === undefined) {
      throw new AgentEnvironmentError('not_started', 'call reset() before observe()');
    }
    return this.options.reducer.view(this.state);
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
        : enumerateGridActions({ ...view, actions: view.systemActions }),
      reward: this.lastReward,
      terminated,
      truncated,
      done: terminated || truncated,
      info: {
        seed: this.seed,
        steps: this.steps,
        totalReward: this.totalReward,
        status: view.status,
        stars: view.stars ?? null,
        actionsUsed: view.hud.actionsUsed,
        terminationReason: this.terminationReason,
      },
    };
  }
}
