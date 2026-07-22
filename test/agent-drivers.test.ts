import { describe, expect, it, vi } from 'vitest';
import {
  AgentDriverRegistry,
  KEYED_PROVIDERS,
  createDefaultKeyedProviderRegistry,
  createKeyedAgentDriver,
  parseAgentDecision,
  runAgentDriverEpisode,
  type AgentDriver,
  type AgentFetch,
} from '../src/agent/index.js';
import {
  AgentEnvironment,
  type GridReducer,
  type GridTurnView,
} from '../src/engine/index.js';

interface Level { goal: number }
interface State { at: number; actionsUsed: number }
interface View extends GridTurnView { at: number }

const reducer: GridReducer<Level, State, View> = {
  init: () => ({ at: 0, actionsUsed: 0 }),
  apply: (state, action) => ({
    at: state.at + (action.id === 'jump' ? (action.index ?? 0) : 1),
    actionsUsed: state.actionsUsed + 1,
  }),
  view: (state) => ({
    at: state.at,
    actions: [
      { id: 'advance', params: 'none' },
      { id: 'jump', params: 'index' },
    ],
    status: state.at >= 2 ? 'won' : 'playing',
    ...(state.at >= 2 ? { stars: 3 } : {}),
    hud: { actionsUsed: state.actionsUsed, items: [{ index: 2 }] },
  }),
};

describe('agent driver contracts', () => {
  it('supports extension through a driver registry', async () => {
    const driver: AgentDriver<View> = {
      id: 'local',
      label: 'Local test driver',
      act: async () => ({ action: { id: 'jump', index: 2 } }),
    };
    const registry = new AgentDriverRegistry([driver]);
    expect(registry.require('local')).toBe(driver);
    expect(() => registry.register(driver)).toThrow('already registered');

    const result = await runAgentDriverEpisode(new AgentEnvironment({
      reducer,
      level: { goal: 2 },
      seed: 1,
    }), driver);
    expect(result.decisions).toEqual([{ action: { id: 'jump', index: 2 } }]);
    expect(result.finalTurn.info).toMatchObject({ terminationReason: 'won', steps: 1 });
  });

  it('parses nested JSON without being confused by braces in strings', () => {
    expect(parseAgentDecision('answer: {"reasoning":"use {jump}","action":{"id":"jump","index":2}} done'))
      .toEqual({
        reasoning: 'use {jump}',
        action: { id: 'jump', index: 2 },
      });
  });
});

describe('keyed providers', () => {
  it('ships four providers and legacy aliases', () => {
    expect(KEYED_PROVIDERS.map(({ id }) => id)).toEqual([
      'anthropic',
      'openai',
      'xai',
      'openrouter',
    ]);
    const registry = createDefaultKeyedProviderRegistry();
    expect(registry.require('key:openai').id).toBe('openai');
    expect(registry.require('api').id).toBe('anthropic');
    expect(registry.require('router').id).toBe('openrouter');
  });

  it('calls OpenAI-compatible APIs and rejects an illegal model action', async () => {
    const request = vi.fn<AgentFetch>().mockImplementation(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"reasoning":"go","action":{"id":"advance"}}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 4 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const driver = createKeyedAgentDriver<View>('openai', {
      apiKey: 'secret-key',
      model: 'test-model',
      fetch: request,
    });
    const decision = await driver.act({
      observation: reducer.view(reducer.init({ goal: 2 }, 1)),
      legalActions: [{ id: 'advance' }],
      step: 0,
      systemPrompt: 'Product rule: avoid hazards.',
    });
    expect(decision).toMatchObject({
      action: { id: 'advance' },
      reasoning: 'go',
      usage: { inputTokens: 10, outputTokens: 4 },
    });
    expect(request).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer secret-key' }),
      body: expect.stringContaining('Product rule: avoid hazards.'),
    }));
    const requestBody = JSON.parse(request.mock.calls[0]![1]!.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.messages[0]?.content).toContain(
      'Choose exactly one entry from legalActions or systemActions.',
    );

    await driver.act({
      observation: reducer.view(reducer.init({ goal: 2 }, 1)),
      legalActions: [{ id: 'advance' }],
      step: 1,
    });
    const continuedBody = JSON.parse(request.mock.calls[1]![1]!.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(continuedBody.messages.map(({ role }) => role)).toEqual(['system', 'user', 'assistant', 'user']);

    request.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"action":{"id":"jump","index":9}}' } }],
    }), { status: 200 }));
    await expect(driver.act({
      observation: reducer.view(reducer.init({ goal: 2 }, 1)),
      legalActions: [{ id: 'advance' }],
      step: 0,
    })).rejects.toThrow('illegal action');
  });

  it('interrupts an in-flight keyed request while retaining completed context', async () => {
    const request = vi.fn<AgentFetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const driver = createKeyedAgentDriver<View>('openai', {
      apiKey: 'secret-key', model: 'test-model', fetch: request,
    });
    const pending = driver.act({
      observation: reducer.view(reducer.init({ goal: 2 }, 1)),
      legalActions: [{ id: 'advance' }],
      step: 0,
    });
    const rejected = expect(pending).rejects.toThrow('agent interrupted');
    expect(driver.interrupt?.({ prompt: 'stop' })).toEqual({
      mode: 'abort', interrupted: true, preservesContext: true,
    });
    await rejected;
  });

  it('retries transient responses and bounds completed conversation history', async () => {
    const ok = () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"action":{"id":"advance"}}' } }],
    }), { status: 200 });
    const request = vi.fn<AgentFetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValue(ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok());
    const sleep = vi.fn(async () => undefined);
    const driver = createKeyedAgentDriver<View>('openai', {
      apiKey: 'secret-key', model: 'test-model', fetch: request,
      maxHistoryTurns: 1, maxRetries: 2, retryBaseDelayMs: 5, sleep,
    });
    for (let step = 0; step < 3; step++) {
      await driver.act({
        observation: reducer.view(reducer.init({ goal: 2 }, 1)),
        legalActions: [{ id: 'advance' }],
        step,
      });
    }
    expect(request).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledWith(5, expect.any(AbortSignal));
    const lastBody = JSON.parse(request.mock.calls[3]![1]!.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(lastBody.messages.map(({ role }) => role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(lastBody.messages[1]?.content).toContain('"step":1');
    expect(lastBody.messages[3]?.content).toContain('"step":2');
  });

  it('aborts while waiting to retry a transient response', async () => {
    const sleep = vi.fn((_delay: number, signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const driver = createKeyedAgentDriver<View>('anthropic', {
      apiKey: 'secret-key', model: 'test-model', maxRetries: 1,
      fetch: async () => new Response('busy', { status: 429 }), sleep,
    });
    const pending = driver.act({
      observation: reducer.view(reducer.init({ goal: 2 }, 1)),
      legalActions: [{ id: 'advance' }],
      step: 0,
    });
    await vi.waitFor(() => expect(sleep).toHaveBeenCalled());
    expect(driver.interrupt?.()).toMatchObject({ interrupted: true });
    await expect(pending).rejects.toThrow('agent interrupted');
  });

  it('calls Anthropic Messages without requiring a provider SDK', async () => {
    const request = vi.fn<AgentFetch>().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: '{"action":{"id":"jump","index":2}}' }],
      usage: { input_tokens: 8, output_tokens: 3 },
    }), { status: 200 }));
    const driver = createKeyedAgentDriver<View>('anthropic', {
      apiKey: 'secret-key',
      model: 'test-model',
      fetch: request,
    });
    await expect(driver.act({
      observation: reducer.view(reducer.init({ goal: 2 }, 1)),
      legalActions: [{ id: 'jump', index: 2 }],
      step: 0,
    })).resolves.toMatchObject({
      action: { id: 'jump', index: 2 },
      usage: { inputTokens: 8, outputTokens: 3 },
    });
    expect(request).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
      headers: expect.objectContaining({ 'x-api-key': 'secret-key' }),
    }));
  });

  it('checks keys with injected fetch and never echoes a rejected secret', async () => {
    const provider = createDefaultKeyedProviderRegistry().require('openai');
    await expect(provider.check('not-for-logs', {
      fetch: async () => new Response('', { status: 401 }),
    })).resolves.toEqual({ ok: false, detail: 'API returned HTTP 401' });
    await expect(provider.check('not-for-logs', {
      fetch: async () => { throw new Error('request not-for-logs rejected'); },
    })).resolves.toEqual({ ok: false, detail: 'Error: request [redacted] rejected' });
  });
});
