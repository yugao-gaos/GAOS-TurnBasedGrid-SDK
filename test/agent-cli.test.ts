import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CliAgentRegistry,
  createBuiltinCliAgents,
  createDefaultCliAgentRegistry,
  customCliAgentsFromJson,
  inspectCliAgent,
  parseCodexJson,
  parseGenericLine,
  parseStreamJson,
  resolveCliExecutable,
  spawnCliAgent,
  type CliAgentSpec,
} from '../src/agent-cli/index.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('CLI agent recipes', () => {
  it('ships five extensible built-in recipes', () => {
    const agents = createBuiltinCliAgents();
    expect(agents.map(({ id }) => id)).toEqual(['claude', 'codex', 'cursor', 'grok', 'opencode']);
    const registry = new CliAgentRegistry(agents);
    expect(registry.require('codex').bin).toBe('codex');
    expect(() => registry.register(agents[0]!)).toThrow('already registered');
  });

  it('configures a caller-owned MCP server and tool allowlist', () => {
    const registry = createDefaultCliAgentRegistry();
    const context = {
      mcpUrl: 'http://127.0.0.1:9000/mcp',
      prompt: 'Complete the episode.',
      serverName: 'arena',
      toolNames: ['observe', 'act', 'say'],
    };
    const claude = registry.require('claude').launch(context);
    expect(claude.argv).toContain('mcp__arena__observe,mcp__arena__act,mcp__arena__say');
    expect(claude.argv.join(' ')).toContain('http://127.0.0.1:9000/mcp');

    const codex = registry.require('codex').launch(context);
    expect(codex.argv).toContain('mcp_servers.arena.url="http://127.0.0.1:9000/mcp"');

    const cursor = registry.require('cursor').launch(context);
    expect(JSON.parse(cursor.files['.cursor/mcp.json']!)).toEqual({
      mcpServers: { arena: { url: context.mcpUrl } },
    });

    const grok = registry.require('grok').launch(context);
    expect(grok.files['.grok/config.toml']).toContain('[mcp_servers.arena]');

    const opencode = registry.require('opencode').launch(context);
    expect(JSON.parse(opencode.files['opencode.json']!).mcp.arena.url).toBe(context.mcpUrl);
  });

  it('loads declarative custom recipes with safe placeholders', () => {
    const [custom] = customCliAgentsFromJson(JSON.stringify({
      local: {
        bin: 'local-agent',
        args: ['--server', '{mcpUrl}', '--prompt', '{prompt}', '--tools', '{allowedTools}'],
        files: { 'agent.json': '{"server":"{serverName}"}' },
      },
    }));
    expect(custom?.launch({
      mcpUrl: 'http://localhost/mcp',
      prompt: 'play',
      toolNames: ['observe'],
    })).toEqual({
      argv: ['--server', 'http://localhost/mcp', '--prompt', 'play', '--tools', 'mcp__game__observe'],
      files: { 'agent.json': '{"server":"game"}' },
    });
  });

  it('parses transcript formats without surfacing unrelated JSON', () => {
    expect(parseStreamJson(JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'thinking', thinking: 'consider move' }] },
    }))).toEqual(['consider move']);
    expect(parseCodexJson(JSON.stringify({ item: { item_type: 'agent_reasoning', text: 'choose jump' } })))
      .toEqual(['choose jump']);
    expect(parseGenericLine('{"text":"hello"}')).toEqual(['hello']);
    expect(parseGenericLine('plain output')).toEqual(['plain output']);
  });
});

describe('CLI agent process integration', () => {
  it('resolves executables and reports missing agents without a model call', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'gaos-agent-test-'));
    temporaryDirectories.push(directory);
    const executable = join(directory, 'working-agent');
    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);
    expect(resolveCliExecutable('working-agent', directory)).toBe(executable);

    const status = await inspectCliAgent({
      id: 'missing',
      label: 'Missing',
      bin: 'definitely-missing-agent',
      launch: () => ({ argv: [], files: {} }),
      login: 'Install it.',
    }, { path: directory });
    expect(status).toMatchObject({ installed: false, auth: 'none' });
  });

  it('launches in a scratch directory and streams parsed transcript text', async () => {
    const transcripts: string[] = [];
    const spec: CliAgentSpec = {
      id: 'node-test',
      label: 'Node test',
      bin: process.execPath,
      launch: () => ({
        argv: ['-e', 'console.log(JSON.stringify({text:"move selected"}))'],
        files: { 'config/agent.json': '{}' },
      }),
      parseLine: parseGenericLine,
      login: 'none',
    };
    const launched = spawnCliAgent(spec, { mcpUrl: 'http://localhost/mcp', prompt: 'play' }, {
      onTranscript: (text) => transcripts.push(text),
    });
    await expect(launched.completion).resolves.toMatchObject({ code: 0, signal: null });
    expect(transcripts).toEqual(['move selected']);
  });

  it('rejects custom config paths that escape the scratch directory', () => {
    const spec: CliAgentSpec = {
      id: 'unsafe',
      label: 'Unsafe',
      bin: process.execPath,
      launch: () => ({ argv: [], files: { '../outside': 'no' } }),
      login: 'none',
    };
    expect(() => spawnCliAgent(spec, { mcpUrl: 'http://localhost/mcp', prompt: 'play' }))
      .toThrow('escapes scratch directory');
  });
});

