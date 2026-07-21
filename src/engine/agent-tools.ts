import type { GridSubmittedAction, GridTurnView } from './contracts.js';
import type { AgentEnvironment } from './agent-environment.js';

export type AgentToolName = 'observe' | 'act' | 'reset' | 'transcript';

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Provider-neutral definitions that can be registered with MCP or tool APIs. */
export const AGENT_TOOL_DEFINITIONS: readonly AgentToolDefinition[] = [
  {
    name: 'observe',
    description: 'Observe the current environment, concrete legal actions, budgets, and episode status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'act',
    description: 'Submit one concrete legal action and observe the deterministic result.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      additionalProperties: false,
      properties: {
        action: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1 },
            x: { type: 'integer' },
            y: { type: 'integer' },
            index: { type: 'integer' },
          },
        },
      },
    },
  },
  {
    name: 'reset',
    description: 'Start a fresh deterministic episode, optionally with a new unsigned 32-bit seed.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { seed: { type: 'integer', minimum: 0, maximum: 0xffffffff } },
    },
  },
  {
    name: 'transcript',
    description: 'Return the canonical action transcript and accumulated episode metrics.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('tool input must be an object');
  }
  return value as Record<string, unknown>;
}

function parseAction(value: unknown): GridSubmittedAction {
  const input = record(value);
  if (typeof input.id !== 'string' || input.id.length === 0) {
    throw new TypeError('action.id must be a non-empty string');
  }
  const action: GridSubmittedAction = { id: input.id };
  for (const key of ['x', 'y', 'index'] as const) {
    if (input[key] !== undefined) {
      if (!Number.isInteger(input[key])) throw new TypeError(`action.${key} must be an integer`);
      action[key] = input[key] as number;
    }
  }
  return action;
}

export interface AgentToolAdapter {
  definitions: readonly AgentToolDefinition[];
  call(name: AgentToolName, input?: unknown): unknown;
}

/** Bind the standard agent tools to one environment without an MCP dependency. */
export function createAgentToolAdapter<TLevel, TState, TView extends GridTurnView>(
  environment: AgentEnvironment<TLevel, TState, TView>,
): AgentToolAdapter {
  return {
    definitions: AGENT_TOOL_DEFINITIONS,
    call(name, value = {}) {
      const input = record(value);
      switch (name) {
        case 'observe':
          return environment.observe();
        case 'act':
          return environment.step(parseAction(input.action));
        case 'reset': {
          if (input.seed !== undefined && !Number.isInteger(input.seed)) {
            throw new TypeError('seed must be an integer');
          }
          return environment.reset(input.seed === undefined ? {} : { seed: input.seed as number });
        }
        case 'transcript':
          return environment.transcript();
      }
    },
  };
}
