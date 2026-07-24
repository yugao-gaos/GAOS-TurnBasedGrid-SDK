import type { Cell } from './movement.js';
import type { LocationRef } from './locations.js';

export interface ActionDefinition {
  id: string;
  /** `targets` references a pre-enumerated declarative target specification. */
  params: 'none' | 'xy' | 'index' | 'targets';
  text?: string;
  targetSpecId?: string;
}

export interface SubmittedAction {
  id: string;
  x?: number;
  y?: number;
  index?: number;
  /** Target board for games with more than one board. */
  boardId?: string;
  /** Reserved for zone-indexed actions. */
  zoneId?: string;
  /** Submitting seat when the host does not carry seat identity separately. */
  seat?: string;
  /** Cross-container target selection produced by a declarative target spec. */
  targets?: readonly LocationRef[];
}

export interface GridViewNamespace {
  targetableCells?: readonly Cell[];
  actionTargeting?: Readonly<Record<string, { targetableCells: readonly Cell[] }>>;
}

/** Minimum observation surface used by the generic solver and replay checker. */
export type GridTargetingView =
  GridViewNamespace | Readonly<Record<string, GridViewNamespace>>;

export interface ZoneEntryView {
  id: string;
  [key: string]: unknown;
}

export interface ZoneViewNamespace<TEntry = ZoneEntryView> {
  /** Aggregate existence/count remains visible even when identity is hidden. */
  count: number;
  entries?: readonly TEntry[];
  /** Present only when the viewer may observe authored order. */
  ordered?: boolean;
  slots?: Readonly<Record<string, TEntry | null>>;
  [key: string]: unknown;
}

export type ZoneViews<TEntry = ZoneEntryView> =
  Readonly<Record<string, ZoneViewNamespace<TEntry>>>;

export interface TargetChoiceView {
  choices: readonly (readonly LocationRef[])[];
  /** True means the product's combinatorial guard omitted legal choices. */
  truncated: boolean;
}

export type Participation =
  | { mode: 'sequential'; activeSeat: string }
  | { mode: 'simultaneous'; seats: readonly string[] };

export type Outcome =
  | { kind: 'ongoing' }
  | {
    kind: 'decided';
    /** Ascending rank; ties share a rank. */
    ranking: ReadonlyArray<{ seat: string; rank: number; score?: number }>;
    reason?: string;
  };

export interface TurnView<
  TGrid = GridTargetingView,
  TZones = ZoneViews,
> {
  actions: readonly ActionDefinition[];
  /** Semantic host controls, separate from hidden/state-filtered gameplay actions. */
  systemActions?: readonly ActionDefinition[];
  status: 'playing' | 'won' | 'failed';
  stars?: number;
  /** Active player/agent seat. Absent retains the single-seat behavior. */
  activeSeat?: string;
  /** Participation model. `activeSeat` is sequential-mode compatibility sugar. */
  participation?: Participation;
  /** Multi-seat result. `status` remains the required solo compatibility view. */
  outcome?: Outcome;
  hud: {
    actionsUsed: number;
    items?: ReadonlyArray<{ index: number }>;
    dialogueOptions?: ReadonlyArray<{ index: number }>;
    pois?: ReadonlyArray<{ index: number }>;
  };
  /**
   * Spatial targeting for one implicit board or a record keyed by board id.
   * The single-board shape keeps product views compact.
   */
  grid?: TGrid;
  /** Conventional partition-filtered zone observations. */
  zones?: TZones;
  /** JSON-ready target choices keyed by `ActionDefinition.targetSpecId`. */
  targetChoices?: Readonly<Record<string, TargetChoiceView>>;
}

/** Deterministic game adapter consumed by reusable engine algorithms. */
export interface TurnReducer<
  TLevel,
  TState,
  TView extends TurnView<unknown, unknown> = TurnView,
> {
  init(level: TLevel, seed: number): TState;
  apply(state: TState, action: SubmittedAction): TState;
  /** Optional atomic batch resolver for simultaneous participation. */
  applyIntents?(state: TState, actions: readonly SubmittedAction[]): TState;
  view(state: TState): TView;
  /** Optional per-seat observation. Absent means perfect information. */
  viewFor?(state: TState, seat: string): TView;
}

/** @deprecated Renamed to `ActionDefinition`; this alias will be removed in v1.0. */
export type GridActionDefinition = ActionDefinition;

/** @deprecated Renamed to `SubmittedAction`; this alias will be removed in v1.0. */
export type GridSubmittedAction = SubmittedAction;

/**
 * Legacy v0.12 observation shape with targeting fields inside `hud`.
 *
 * @deprecated Renamed to `TurnView`; move spatial targeting to `grid`. This
 * alias and its flat HUD compatibility fields will be removed in v1.0.
 */
export interface GridTurnView extends TurnView<unknown, unknown> {
  hud: TurnView['hud'] & GridViewNamespace;
}

/** @deprecated Renamed to `TurnReducer`; this alias will be removed in v1.0. */
export type GridReducer<
  TLevel,
  TState,
  TView extends GridTurnView = GridTurnView,
> = TurnReducer<TLevel, TState, TView>;
