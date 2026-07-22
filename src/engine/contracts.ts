import type { Cell } from './movement.js';

export interface GridActionDefinition {
  id: string;
  params: 'none' | 'xy' | 'index';
  text?: string;
}

export interface GridSubmittedAction {
  id: string;
  x?: number;
  y?: number;
  index?: number;
}

/** Minimum observation surface used by the generic solver and replay checker. */
export interface GridTurnView {
  actions: readonly GridActionDefinition[];
  /** Semantic host controls, separate from hidden/state-filtered gameplay actions. */
  systemActions?: readonly GridActionDefinition[];
  status: 'playing' | 'won' | 'failed';
  stars?: number;
  hud: {
    actionsUsed: number;
    items?: ReadonlyArray<{ index: number }>;
    dialogueOptions?: ReadonlyArray<{ index: number }>;
    pois?: ReadonlyArray<{ index: number }>;
    targetableCells?: readonly Cell[];
    actionTargeting?: Readonly<Record<string, { targetableCells: readonly Cell[] }>>;
  };
}

/** Deterministic game adapter consumed by reusable engine algorithms. */
export interface GridReducer<TLevel, TState, TView extends GridTurnView = GridTurnView> {
  init(level: TLevel, seed: number): TState;
  apply(state: TState, action: GridSubmittedAction): TState;
  view(state: TState): TView;
}
