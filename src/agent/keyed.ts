import type { GridSubmittedAction } from '../engine/contracts.js';
import {
  isLegalAgentDecision,
  type AgentDecision,
  type AgentDriver,
  type AgentDriverContext,
  type AgentTokenUsage,
} from './driver.js';

export type AgentFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface KeyCheck {
  ok: boolean;
  detail: string;
}

export interface KeyedAgentDriverOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: AgentFetch;
  maxTokens?: number;
  headers?: Readonly<Record<string, string>>;
  systemPrompt?: string;
}

export interface KeyedProvider {
  readonly id: string;
  readonly label: string;
  readonly apiKeyEnv: string;
  readonly login: string;
  readonly baseUrl: string;
  readonly defaultModel?: string;
  check(apiKey: string, options?: { fetch?: AgentFetch; signal?: AbortSignal }): Promise<KeyCheck>;
  createDriver<TObservation = unknown>(options: KeyedAgentDriverOptions): AgentDriver<TObservation>;
}

export class KeyedProviderRegistry {
  private readonly providers = new Map<string, KeyedProvider>();
  private readonly aliases = new Map<string, string>();

  constructor(providers: readonly KeyedProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: KeyedProvider, options: { replace?: boolean; aliases?: readonly string[] } = {}): this {
    if (!provider.id.trim()) throw new TypeError('keyed provider id must not be empty');
    if (this.providers.has(provider.id) && !options.replace) {
      throw new Error(`keyed provider is already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    for (const alias of options.aliases ?? []) this.alias(alias, provider.id);
    return this;
  }

  alias(alias: string, providerId: string): this {
    if (!this.providers.has(providerId)) throw new Error(`unknown keyed provider: ${providerId}`);
    this.aliases.set(alias, providerId);
    return this;
  }

  get(id: string): KeyedProvider | undefined {
    const normalized = id.startsWith('key:') ? id.slice(4) : id;
    return this.providers.get(this.aliases.get(normalized) ?? normalized);
  }

  require(id: string): KeyedProvider {
    const provider = this.get(id);
    if (!provider) throw new Error(`unknown keyed provider: ${id}`);
    return provider;
  }

  list(): KeyedProvider[] {
    return [...this.providers.values()];
  }
}

const DEFAULT_SYSTEM_PROMPT = [
  'You are controlling a turn-based grid environment.',
  'Choose exactly one entry from legalActions.',
  'Return only JSON with this shape:',
  '{"reasoning":"brief explanation","action":{"id":"action id","x":0,"y":0,"index":0},"message":"optional"}',
  'Omit x, y, or index when the selected legal action does not contain it.',
].join('\n');

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function balancedJsonObject(text: string): string | undefined {
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  return undefined;
}

function optionalInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) throw new TypeError(`agent decision ${name} must be an integer`);
  return value as number;
}

/** Parse a model response into the provider-neutral action contract. */
export function parseAgentDecision(text: string): AgentDecision {
  const json = balancedJsonObject(text);
  if (!json) throw new TypeError('agent response did not contain a JSON object');
  const root = record(JSON.parse(json));
  if (!root) throw new TypeError('agent response must be a JSON object');
  const nested = record(root.action);
  const candidate = nested ?? root;
  const id = typeof candidate.id === 'string'
    ? candidate.id
    : typeof candidate.action === 'string'
      ? candidate.action
      : undefined;
  if (!id?.trim()) throw new TypeError('agent decision action.id must be a non-empty string');
  const action: GridSubmittedAction = {
    id,
    ...(candidate.x !== undefined ? { x: optionalInteger(candidate.x, 'x') } : {}),
    ...(candidate.y !== undefined ? { y: optionalInteger(candidate.y, 'y') } : {}),
    ...(candidate.index !== undefined ? { index: optionalInteger(candidate.index, 'index') } : {}),
  };
  return {
    action,
    ...(typeof root.reasoning === 'string' ? { reasoning: root.reasoning } : {}),
    ...(typeof root.message === 'string' ? { message: root.message } : {}),
  };
}

export function formatAgentContext<TObservation>(context: AgentDriverContext<TObservation>): string {
  return JSON.stringify({
    step: context.step,
    observation: context.observation,
    actionDefinitions: context.actionDefinitions,
    legalActions: context.legalActions,
    guidance: context.guidance,
  });
}

function systemPrompt<TObservation>(
  options: KeyedAgentDriverOptions,
  context: AgentDriverContext<TObservation>,
): string {
  return [options.systemPrompt, context.systemPrompt, DEFAULT_SYSTEM_PROMPT]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n\n');
}

function secretSafeError(message: string, apiKey: string): Error {
  return new Error(apiKey ? message.split(apiKey).join('[redacted]') : message);
}

async function responseError(response: Response, apiKey: string): Promise<Error> {
  const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 500);
  return secretSafeError(`agent provider returned HTTP ${response.status}${body ? `: ${body}` : ''}`, apiKey);
}

function assertLegal<TObservation>(
  decision: AgentDecision,
  context: AgentDriverContext<TObservation>,
): AgentDecision {
  if (!isLegalAgentDecision(decision, context.legalActions)) {
    throw new TypeError(`agent selected an illegal action: ${JSON.stringify(decision.action)}`);
  }
  return decision;
}

function usage(inputTokens: unknown, outputTokens: unknown): AgentTokenUsage | undefined {
  const result: AgentTokenUsage = {};
  if (typeof inputTokens === 'number') result.inputTokens = inputTokens;
  if (typeof outputTokens === 'number') result.outputTokens = outputTokens;
  return Object.keys(result).length ? result : undefined;
}

export class OpenAICompatibleAgentDriver<TObservation = unknown> implements AgentDriver<TObservation> {
  readonly id: string;
  readonly label: string;
  private readonly request: AgentFetch;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;

  constructor(
    id: string,
    label: string,
    private readonly options: KeyedAgentDriverOptions & { defaultModel?: string; defaultBaseUrl: string },
  ) {
    this.id = id;
    this.label = label;
    this.request = options.fetch ?? fetch;
    this.model = options.model ?? options.defaultModel ?? '';
    this.baseUrl = (options.baseUrl ?? options.defaultBaseUrl).replace(/\/$/, '');
    this.maxTokens = options.maxTokens ?? 800;
    if (!options.apiKey) throw new TypeError('apiKey must not be empty');
    if (!this.model) throw new TypeError(`model is required for keyed provider ${id}`);
  }

  async act(context: AgentDriverContext<TObservation>): Promise<AgentDecision> {
    const response = await this.request(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: context.signal,
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
        ...this.options.headers,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt(this.options, context) },
          { role: 'user', content: formatAgentContext(context) },
        ],
      }),
    });
    if (!response.ok) throw await responseError(response, this.options.apiKey);
    const raw: unknown = await response.json();
    const payload = record(raw);
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    const first = record(choices[0]);
    const message = record(first?.message);
    if (typeof message?.content !== 'string') throw new TypeError('agent provider returned no message content');
    const parsed = parseAgentDecision(message.content);
    const tokens = record(payload?.usage);
    return assertLegal({
      ...parsed,
      raw,
      usage: usage(tokens?.prompt_tokens, tokens?.completion_tokens),
    }, context);
  }
}

export class AnthropicAgentDriver<TObservation = unknown> implements AgentDriver<TObservation> {
  readonly id: string;
  readonly label: string;
  private readonly request: AgentFetch;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;

  constructor(
    id: string,
    label: string,
    private readonly options: KeyedAgentDriverOptions & { defaultModel?: string; defaultBaseUrl: string },
  ) {
    this.id = id;
    this.label = label;
    this.request = options.fetch ?? fetch;
    this.model = options.model ?? options.defaultModel ?? '';
    this.baseUrl = (options.baseUrl ?? options.defaultBaseUrl).replace(/\/$/, '');
    this.maxTokens = options.maxTokens ?? 800;
    if (!options.apiKey) throw new TypeError('apiKey must not be empty');
    if (!this.model) throw new TypeError(`model is required for keyed provider ${id}`);
  }

  async act(context: AgentDriverContext<TObservation>): Promise<AgentDecision> {
    const response = await this.request(`${this.baseUrl}/messages`, {
      method: 'POST',
      signal: context.signal,
      headers: {
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        ...this.options.headers,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt(this.options, context),
        messages: [{ role: 'user', content: formatAgentContext(context) }],
      }),
    });
    if (!response.ok) throw await responseError(response, this.options.apiKey);
    const raw: unknown = await response.json();
    const payload = record(raw);
    const content = Array.isArray(payload?.content) ? payload.content : [];
    const text = content
      .map(record)
      .filter((part): part is Record<string, unknown> => part !== undefined)
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
    if (!text) throw new TypeError('agent provider returned no message content');
    const parsed = parseAgentDecision(text);
    const tokens = record(payload?.usage);
    return assertLegal({
      ...parsed,
      raw,
      usage: usage(tokens?.input_tokens, tokens?.output_tokens),
    }, context);
  }
}

function openAIProvider(options: {
  id: string;
  label: string;
  apiKeyEnv: string;
  login: string;
  baseUrl: string;
  defaultModel?: string;
}): KeyedProvider {
  return {
    ...options,
    async check(apiKey, checkOptions = {}) {
      if (!apiKey) return { ok: false, detail: `missing ${options.apiKeyEnv}` };
      try {
        const response = await (checkOptions.fetch ?? fetch)(`${options.baseUrl}/models`, {
          signal: checkOptions.signal,
          headers: { authorization: `Bearer ${apiKey}` },
        });
        return response.ok
          ? { ok: true, detail: 'API key accepted' }
          : { ok: false, detail: `API returned HTTP ${response.status}` };
      } catch (error) {
        return { ok: false, detail: secretSafeError(String(error), apiKey).message };
      }
    },
    createDriver<TObservation>(driverOptions: KeyedAgentDriverOptions) {
      return new OpenAICompatibleAgentDriver<TObservation>(options.id, options.label, {
        ...driverOptions,
        defaultBaseUrl: options.baseUrl,
        defaultModel: options.defaultModel,
      });
    },
  };
}

const anthropicProvider: KeyedProvider = {
  id: 'anthropic',
  label: 'Anthropic',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  login: 'https://console.anthropic.com/settings/keys',
  baseUrl: 'https://api.anthropic.com/v1',
  defaultModel: 'claude-opus-4-8',
  async check(apiKey, options = {}) {
    if (!apiKey) return { ok: false, detail: 'missing ANTHROPIC_API_KEY' };
    try {
      const response = await (options.fetch ?? fetch)(`${anthropicProvider.baseUrl}/models`, {
        signal: options.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      return response.ok
        ? { ok: true, detail: 'API key accepted' }
        : { ok: false, detail: `API returned HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, detail: secretSafeError(String(error), apiKey).message };
    }
  },
  createDriver<TObservation>(options: KeyedAgentDriverOptions) {
    return new AnthropicAgentDriver<TObservation>(anthropicProvider.id, anthropicProvider.label, {
      ...options,
      defaultBaseUrl: anthropicProvider.baseUrl,
      defaultModel: anthropicProvider.defaultModel,
    });
  },
};

export const KEYED_PROVIDERS = [
  anthropicProvider,
  openAIProvider({
    id: 'openai',
    label: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    login: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.1',
  }),
  openAIProvider({
    id: 'xai',
    label: 'xAI',
    apiKeyEnv: 'XAI_API_KEY',
    login: 'https://console.x.ai/',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
  }),
  openAIProvider({
    id: 'openrouter',
    label: 'OpenRouter',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    login: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
  }),
] as const;

export function createDefaultKeyedProviderRegistry(): KeyedProviderRegistry {
  return new KeyedProviderRegistry(KEYED_PROVIDERS)
    .alias('api', 'anthropic')
    .alias('router', 'openrouter');
}

export function createKeyedAgentDriver<TObservation = unknown>(
  providerId: string,
  options: KeyedAgentDriverOptions,
  registry = createDefaultKeyedProviderRegistry(),
): AgentDriver<TObservation> {
  return registry.require(providerId).createDriver<TObservation>(options);
}
