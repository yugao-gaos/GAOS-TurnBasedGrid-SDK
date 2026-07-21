import type { GridTurnView } from '../engine/contracts.js';
import type {
  AgentEnvironment,
  AgentTranscript,
  AgentTurn,
} from '../engine/agent-environment.js';
import type { AgentDecision, AgentDriver } from './driver.js';

export interface AgentDriverEpisodeResult<TLevel, TView extends GridTurnView> {
  finalTurn: AgentTurn<TView>;
  transcript: AgentTranscript<TLevel>;
  decisions: AgentDecision[];
}

/** Run one complete deterministic environment episode through an AgentDriver. */
export async function runAgentDriverEpisode<TLevel, TState, TView extends GridTurnView>(
  environment: AgentEnvironment<TLevel, TState, TView>,
  driver: AgentDriver<TView>,
  options: {
    systemPrompt?: string;
    guidance?: readonly string[];
    signal?: AbortSignal;
    onDecision?: (decision: AgentDecision, turn: AgentTurn<TView>) => void | Promise<void>;
  } = {},
): Promise<AgentDriverEpisodeResult<TLevel, TView>> {
  await driver.reset?.();
  let turn = environment.reset();
  const decisions: AgentDecision[] = [];
  while (!turn.done) {
    if (options.signal?.aborted) throw options.signal.reason;
    const decision = await driver.act({
      observation: turn.observation,
      legalActions: turn.legalActions,
      actionDefinitions: turn.actionDefinitions,
      step: turn.info.steps,
      systemPrompt: options.systemPrompt,
      guidance: options.guidance,
      signal: options.signal,
    });
    decisions.push(decision);
    await options.onDecision?.(decision, turn);
    turn = environment.step(decision.action);
  }
  return { finalTurn: turn, transcript: environment.transcript(), decisions };
}

