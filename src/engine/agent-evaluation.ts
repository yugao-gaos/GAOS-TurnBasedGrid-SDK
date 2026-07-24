import type { SubmittedAction, TurnView } from './contracts.js';
import type {
  AgentEnvironment,
  AgentTranscript,
  AgentTurn,
} from './agent-environment.js';

export type AgentPolicy<TView extends TurnView<unknown, unknown>> = (
  turn: AgentTurn<TView>,
) => SubmittedAction | Promise<SubmittedAction>;

export interface AgentEpisodeResult<TLevel, TView extends TurnView<unknown, unknown>> {
  finalTurn: AgentTurn<TView>;
  transcript: AgentTranscript<TLevel, TView>;
}

/** Run one complete episode using a synchronous or asynchronous agent policy. */
export async function runAgentEpisode<TLevel, TState, TView extends TurnView<unknown, unknown>>(
  environment: AgentEnvironment<TLevel, TState, TView>,
  policy: AgentPolicy<TView>,
): Promise<AgentEpisodeResult<TLevel, TView>> {
  let turn = environment.reset();
  while (!turn.done) turn = environment.step(await policy(turn));
  return { finalTurn: turn, transcript: environment.transcript() };
}

export interface AgentBatchCase<TLevel> {
  id: string;
  level: TLevel;
  seed: number;
}

export interface AgentBatchEpisode<TLevel, TView extends TurnView<unknown, unknown>>
  extends AgentEpisodeResult<TLevel, TView> {
  id: string;
}

export interface AgentBatchResult<TLevel, TView extends TurnView<unknown, unknown>> {
  episodes: Array<AgentBatchEpisode<TLevel, TView>>;
  summary: {
    episodes: number;
    won: number;
    failed: number;
    truncated: number;
    meanReward: number;
    meanSteps: number;
  };
}

/** Sequential deterministic batch runner suitable for evaluation harnesses. */
export async function evaluateAgentEpisodes<TLevel, TState, TView extends TurnView<unknown, unknown>>(
  cases: readonly AgentBatchCase<TLevel>[],
  createEnvironment: (episode: AgentBatchCase<TLevel>) => AgentEnvironment<TLevel, TState, TView>,
  policy: (turn: AgentTurn<TView>, episode: AgentBatchCase<TLevel>) => SubmittedAction | Promise<SubmittedAction>,
): Promise<AgentBatchResult<TLevel, TView>> {
  const episodes: Array<AgentBatchEpisode<TLevel, TView>> = [];
  for (const episode of cases) {
    const result = await runAgentEpisode(
      createEnvironment(episode),
      (turn) => policy(turn, episode),
    );
    episodes.push({ id: episode.id, ...result });
  }
  const count = episodes.length;
  return {
    episodes,
    summary: {
      episodes: count,
      won: episodes.filter(({ finalTurn }) => finalTurn.info.terminationReason === 'won').length,
      failed: episodes.filter(({ finalTurn }) => finalTurn.info.terminationReason === 'failed').length,
      truncated: episodes.filter(({ finalTurn }) => finalTurn.truncated).length,
      meanReward: count === 0
        ? 0
        : episodes.reduce((sum, episode) => sum + episode.finalTurn.info.totalReward, 0) / count,
      meanSteps: count === 0
        ? 0
        : episodes.reduce((sum, episode) => sum + episode.finalTurn.info.steps, 0) / count,
    },
  };
}
