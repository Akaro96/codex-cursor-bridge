import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentArgs, buildAgentEnv, collectAgentOutput, agentSpawnSpec, runCursorAgent, sanitizeAgentDiagnostic, validateAgentCommand } from '../src/cursor-agent.mjs';
import { stripCursorPrefix } from '../src/model-catalog.mjs';

function makeFakeSpawn({ stdout = '{"type":"assistant","message":{"content":[{"text":"OK"}]}}\n', stderr = '', code = 0, neverClose = false } = {}) {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killedByTest = false;
    child.kill = () => {
      child.killedByTest = true;
      child.emit('close', null);
      return true;
    };
    process.nextTick(() => {
      if (stdout) child.stdout.emit('data', stdout);
      if (stderr) child.stderr.emit('data', stderr);
      if (!neverClose) child.emit('close', code);
    });
    spawnImpl.lastChild = child;
    return child;
  };
  spawnImpl.calls = calls;
  return spawnImpl;
}

test('agent args map cursor-prefixed model to Cursor Agent model', () => {
  const args = agentArgs({ model: 'cursor-gpt-5.5-high-fast', promptPath: '/tmp/task.md', workspace: '/work' });
  assert.ok(args.includes('--model'));
  assert.ok(args.includes('gpt-5.5-high-fast'));
  assert.ok(args.includes('--workspace'));
});

test('agent args omit explicit model for cursor-auto', () => {
  const args = agentArgs({ model: 'cursor-auto', promptPath: '/tmp/task.md', workspace: '/work' });
  assert.equal(args.includes('--model'), false);
});

test('agent args make permissive flags explicit and auditable', () => {
  const args = agentArgs({ model: 'cursor-auto', promptPath: '/tmp/task.md', workspace: '/work' });
  assert.ok(args.includes('--force'));
  assert.ok(args.includes('--sandbox'));
  assert.ok(args.includes('disabled'));
  assert.ok(args.includes('--approve-mcps'));
  assert.ok(args.includes('--trust'));
});

test('collectAgentOutput parses generic delta output', () => {
  const out = collectAgentOutput('{"delta":"O"}\n{"delta":"K"}\n');
  assert.equal(out, 'OK');
});

test('collectAgentOutput prefers final assistant message over progress/tool chatter', () => {
  const stream = [
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Ich lese zuerst' }] } },
    { type: 'tool_call', subtype: 'completed', tool_call: { readToolCall: { result: { success: { content: 'task' } } } } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'OK' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'OK' }] } },
  ].map((x) => JSON.stringify(x)).join('\n');
  assert.equal(collectAgentOutput(stream), 'OK');
});

test('stripCursorPrefix handles slash and dash forms', () => {
  assert.equal(stripCursorPrefix('cursor/gemini-3.1-pro'), 'gemini-3.1-pro');
  assert.equal(stripCursorPrefix('cursor-gemini-3.1-pro'), 'gemini-3.1-pro');
});

test('agentSpawnSpec returns explicit wrappers for linux, macOS and Windows commands', () => {
  assert.deepEqual(agentSpawnSpec(['--version'], { CURSOR_AGENT_COMMAND: 'agent' }, 'linux'), {
    command: 'agent',
    args: ['--version'],
    shell: false,
  });
  assert.deepEqual(agentSpawnSpec(['--version'], { CURSOR_AGENT_COMMAND: 'agent' }, 'darwin'), {
    command: 'agent',
    args: ['--version'],
    shell: false,
  });
  const winCmd = agentSpawnSpec(['--version'], { CURSOR_AGENT_COMMAND: 'agent.cmd' }, 'win32');
  assert.equal(winCmd.command, 'cmd.exe');
  assert.deepEqual(winCmd.args.slice(0, 4), ['/d', '/s', '/c', 'agent.cmd']);
  assert.equal(winCmd.shell, false);
  const winPs = agentSpawnSpec(['--version'], { CURSOR_AGENT_COMMAND: 'C:\\Tools\\agent.ps1' }, 'win32');
  assert.equal(winPs.command, 'powershell.exe');
  assert.deepEqual(winPs.args.slice(0, 4), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File']);
  assert.equal(winPs.shell, false);
  const winExe = agentSpawnSpec(['--version'], { CURSOR_AGENT_COMMAND: 'C:\\Tools\\agent.exe' }, 'win32');
  assert.equal(winExe.command, 'C:\\Tools\\agent.exe');
  assert.deepEqual(winExe.args, ['--version']);
  assert.equal(winExe.shell, false);
});

test('agentSpawnSpec rejects shell-like Cursor Agent command values', () => {
  assert.equal(validateAgentCommand('agent'), 'agent');
  assert.equal(validateAgentCommand('C:\\Program Files\\Cursor\\agent.cmd', 'win32'), 'C:\\Program Files\\Cursor\\agent.cmd');
  assert.throws(() => validateAgentCommand('agent --version'), /command name or absolute path/i);
  assert.throws(() => validateAgentCommand('agent.cmd & calc.exe', 'win32'), /absolute path|metacharacter/i);
  assert.throws(() => validateAgentCommand('agent\nother'), /single command path/i);
});

test('buildAgentEnv filters token-shaped environment values before spawning Cursor Agent', () => {
  const env = buildAgentEnv({
    PATH: '/usr/bin',
    HOME: '/home/example',
    CURSOR_AGENT_COMMAND: 'agent',
    OPENAI_API_KEY: 'redacted-openai-key',
    AWS_ACCESS_KEY_ID: 'redacted-access-key',
    GITHUB_TOKEN: 'redacted-github-token',
    PASSWORD: 'secret',
    CODEX_CURSOR_BRIDGE_MOCK: '1',
  });
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.CURSOR_AGENT_COMMAND, 'agent');
  assert.equal(env.CODEX_CURSOR_BRIDGE_MOCK, '1');
  assert.equal('OPENAI_API_KEY' in env, false);
  assert.equal('AWS_ACCESS_KEY_ID' in env, false);
  assert.equal('GITHUB_TOKEN' in env, false);
  assert.equal('PASSWORD' in env, false);
});

test('sanitizeAgentDiagnostic removes local paths and truncates stderr before HTTP errors', () => {
  const message = '/home/example/project/codex-cursor-bridge-abc123/task.md failed ' + 'x'.repeat(800);
  const sanitized = sanitizeAgentDiagnostic(message, { HOME: '/home/example' });
  assert.equal(sanitized.includes('/home/example'), false);
  assert.equal(sanitized.includes('codex-cursor-bridge-abc123'), false);
  assert.ok(sanitized.length <= 500);
});

test('runCursorAgent sanitizes spawn errors before returning them', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ccb-spawn-error-test-'));
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    process.nextTick(() => child.emit('error', new Error(`spawn ${tmpRoot}/agent ENOENT`)));
    return child;
  };
  try {
    await assert.rejects(
      runCursorAgent({
        prompt: 'Say OK',
        model: 'cursor-auto',
        workspace: tmpRoot,
        tmpRoot,
        spawnImpl,
        env: { CURSOR_AGENT_COMMAND: 'agent', HOME: tmpRoot },
      }),
      (error) => error.message.includes('Cursor Agent spawn failed') && !error.message.includes(tmpRoot),
    );
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('runCursorAgent cleans up temporary prompt directory after success', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ccb-test-'));
  const spawnImpl = makeFakeSpawn();
  try {
    const text = await runCursorAgent({
      prompt: 'Say OK',
      model: 'cursor-auto',
      workspace: tmpRoot,
      tmpRoot,
      spawnImpl,
      env: { CURSOR_AGENT_COMMAND: 'agent' },
    });
    assert.equal(text, 'OK');
    assert.equal(spawnImpl.calls.length, 1);
    assert.deepEqual(await fs.readdir(tmpRoot), []);
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('runCursorAgent aborts and kills the child process when the request is cancelled', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ccb-abort-test-'));
  const controller = new AbortController();
  const spawnImpl = makeFakeSpawn({ neverClose: true, stdout: '' });
  try {
    const promise = runCursorAgent({
      prompt: 'wait',
      model: 'cursor-auto',
      workspace: tmpRoot,
      tmpRoot,
      spawnImpl,
      env: { CURSOR_AGENT_COMMAND: 'agent' },
      signal: controller.signal,
    });
    while (!spawnImpl.lastChild) await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await assert.rejects(promise, /aborted/i);
    assert.equal(spawnImpl.lastChild.killedByTest, true);
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});
