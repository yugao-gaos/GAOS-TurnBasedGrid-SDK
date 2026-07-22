import type {
  GridActionDefinition,
  GridSubmittedAction,
} from '../engine/contracts.js';

export interface AgentDriverContext<TObservation = unknown> {
  observation: TObservation;
  legalActions: readonly GridSubmittedAction[];
  /** Always-available semantic controls, separate from gameplay legality. */
  systemActions?: readonly GridSubmittedAction[];
  actionDefinitions?: readonly GridActionDefinition[];
  step: number;
  systemPrompt?: string;
  guidance?: readonly string[];
  signal?: AbortSignal;
}

export interface AgentTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentDecision {
  action: GridSubmittedAction;
  reasoning?: string;
  message?: string;
  usage?: AgentTokenUsage;
  raw?: unknown;
}

export type AgentInterruptionMode = 'resume' | 'abort' | 'restart' | 'unsupported';

export interface AgentInterruptOptions {
  /** New user guidance that caused the interruption. */
  prompt?: string;
}

export interface AgentInterruptionResult {
  mode: AgentInterruptionMode;
  interrupted: boolean;
  /** True when the next decision retains the runner's prior conversation. */
  preservesContext: boolean;
}

export interface AgentDriver<TObservation = unknown> {
  readonly id: string;
  readonly label: string;
  reset?(): void | Promise<void>;
  /** Cancel the active decision. Implementations own provider-specific context preservation. */
  interrupt?(options?: AgentInterruptOptions): AgentInterruptionResult | Promise<AgentInterruptionResult>;
  act(context: AgentDriverContext<TObservation>): Promise<AgentDecision>;
}

export class AgentDriverRegistry<TObservation = unknown> {
  private readonly drivers = new Map<string, AgentDriver<TObservation>>();

  constructor(drivers: readonly AgentDriver<TObservation>[] = []) {
    for (const driver of drivers) this.register(driver);
  }

  register(driver: AgentDriver<TObservation>, options: { replace?: boolean } = {}): this {
    if (!driver.id.trim()) throw new TypeError('agent driver id must not be empty');
    if (this.drivers.has(driver.id) && !options.replace) {
      throw new Error(`agent driver is already registered: ${driver.id}`);
    }
    this.drivers.set(driver.id, driver);
    return this;
  }

  unregister(id: string): boolean {
    return this.drivers.delete(id);
  }

  get(id: string): AgentDriver<TObservation> | undefined {
    return this.drivers.get(id);
  }

  require(id: string): AgentDriver<TObservation> {
    const driver = this.get(id);
    if (!driver) throw new Error(`unknown agent driver: ${id}`);
    return driver;
  }

  list(): AgentDriver<TObservation>[] {
    return [...this.drivers.values()];
  }
}

function actionKey(action: GridSubmittedAction): string {
  return JSON.stringify({
    id: action.id,
    ...(action.x !== undefined ? { x: action.x } : {}),
    ...(action.y !== undefined ? { y: action.y } : {}),
    ...(action.index !== undefined ? { index: action.index } : {}),
  });
}

export function isLegalAgentDecision(
  decision: AgentDecision,
  legalActions: readonly GridSubmittedAction[],
): boolean {
  const key = actionKey(decision.action);
  return legalActions.some((action) => actionKey(action) === key);
}
