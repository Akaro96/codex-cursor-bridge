import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripCursorPrefix } from './model-catalog.mjs';

function isSimpleCommandName(command) {
  return /^[A-Za-z0-9._-]+$/.test(command);
}

function isAbsoluteCommandPath(command, platform = process.platform) {
  if (platform === 'win32') return /^[A-Za-z]:[\\/]/.test(command) || /^\\\\[^\\/]+[\\/]/.test(command);
  return command.startsWith('/');
}

export function validateAgentCommand(command, platform = process.platform) {
  if (typeof command !== 'string' || command.trim() === '') {
    throw new Error('Cursor Agent command must be a non-empty string');
  }
  if (/[\0\r\n]/.test(command)) {
    throw new Error('Cursor Agent command must be a single command path, not multiple lines');
  }
  if (!isSimpleCommandName(command) && !isAbsoluteCommandPath(command, platform)) {
    throw new Error('Cursor Agent command must be a command name or absolute path. Put arguments in bridge options, not CURSOR_AGENT_COMMAND.');
  }
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(command) && /[&|<>^%"']/u.test(command)) {
    throw new Error('Unsafe shell metacharacter in Windows Cursor Agent command');
  }
  return command;
}

export function agentCommandFromEnv(env = process.env, platform = process.platform) {
  return validateAgentCommand(env.CURSOR_AGENT_COMMAND || env.CURSOR_AGENT_PATH || 'agent', platform);
}

export function agentSpawnSpec(args, env = process.env, platform = process.platform) {
  const command = agentCommandFromEnv(env, platform);
  if (platform === 'win32') {
    const lower = command.toLowerCase();
    if (lower.endsWith('.ps1')) {
      return { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', command, ...args], shell: false };
    }
    if (lower.endsWith('.exe')) {
      return { command, args, shell: false };
    }
    // Windows cannot reliably spawn .cmd/.bat shims directly. Use cmd.exe
    // explicitly instead of Node's implicit shell path, which emits DEP0190
    // warnings and is less auditable.
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', command, ...args], shell: false };
  }
  return { command, args, shell: false };
}

const SENSITIVE_ENV_NAME = /(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|AUTHORIZATION|CREDENTIAL|COO(?:KIE)|SESSION|PRIVATE[_-]?KEY)/i;

export function buildAgentEnv(env = process.env) {
  const clean = {};
  for (const [key, value] of Object.entries(env || {})) {
    if (value == null) continue;
    if (SENSITIVE_ENV_NAME.test(key)) continue;
    clean[key] = String(value);
  }

  // Test/mock controls are intentionally local to this bridge and are useful in
  // CI. Preserve them even though the default sensitive-name filter is strict.
  for (const key of ['CODEX_CURSOR_BRIDGE_MOCK', 'CODEX_CURSOR_BRIDGE_MOCK_TEXT']) {
    if (env?.[key] != null) clean[key] = String(env[key]);
  }
  return clean;
}

export function sanitizeAgentDiagnostic(message, env = process.env, extraRoots = []) {
  let text = String(message || 'no output');
  const roots = [env.HOME, env.USERPROFILE, env.TMPDIR, env.TEMP, env.TMP, os.tmpdir(), ...extraRoots].filter(Boolean);
  for (const root of roots) {
    text = text.split(String(root)).join('[local-path]');
  }
  text = text
    .replace(/codex-cursor-bridge-[A-Za-z0-9._-]+/g, 'codex-cursor-bridge-[temp]')
    .replace(/[A-Za-z]:[\\/][^\s"']+/g, '[local-path]')
    .replace(/\/(?:home|Users)\/[^\s"']+/g, '[local-path]')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > 500) text = `${text.slice(0, 497)}...`;
  return text || 'no output';
}

export function agentArgs({ model, promptPath, workspace }) {
  const cursorModel = stripCursorPrefix(model);
  const prompt = `Read the delegated task from this local file and carry it out: ${promptPath}`;
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--stream-partial-output',
    '--force',
    '--sandbox',
    'disabled',
    '--approve-mcps',
    '--trust',
    '--workspace',
    workspace,
  ];
  // These trust flags are intentional for the local, user-owned workspace.
  // Keep workspace provenance server-side: never accept workspace paths from
  // HTTP request bodies or model payloads.
  if (cursorModel && cursorModel !== 'auto') args.push('--model', cursorModel);
  args.push(prompt);
  return args;
}

function textFromAgentJson(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.delta === 'string') return obj.delta;
  if (typeof obj.output === 'string') return obj.output;
  if (typeof obj.result === 'string') return obj.result;
  if (obj.message?.content) {
    const content = Array.isArray(obj.message.content) ? obj.message.content : [obj.message.content];
    return content.map((p) => (typeof p === 'string' ? p : p?.text || p?.output_text || '')).join('');
  }
  return '';
}

export function collectAgentOutput(stdout) {
  let lastAssistantText = '';
  const fallbackChunks = [];
  for (const rawLine of String(stdout || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      const text = textFromAgentJson(obj);
      if (!text) continue;
      if (obj.type === 'assistant') {
        // Cursor Agent emits partial assistant chunks plus final full assistant
        // messages. The final message is the one Codex should receive.
        lastAssistantText = text;
      } else {
        fallbackChunks.push(text);
      }
    } catch {
      // Cursor Agent stream-json is expected, but keep useful plain text if a version changes.
      if (!/^\{|\[/.test(line)) fallbackChunks.push(line);
    }
  }
  return (lastAssistantText || fallbackChunks.join('')).trim();
}

export async function runCursorAgent({
  prompt,
  model,
  workspace = process.cwd(),
  env = process.env,
  timeoutMs = 300000,
  tmpRoot = os.tmpdir(),
  signal = null,
  spawnImpl = spawn,
} = {}) {
  if (env.CODEX_CURSOR_BRIDGE_MOCK === '1') {
    return env.CODEX_CURSOR_BRIDGE_MOCK_TEXT || 'OK';
  }

  const dir = await fs.mkdtemp(path.join(tmpRoot, 'codex-cursor-bridge-'));
  const promptPath = path.join(dir, 'task.md');
  await fs.writeFile(promptPath, prompt, 'utf8');

  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      let child = null;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        fn(value);
      };
      const onAbort = () => {
        finish(reject, new Error('Cursor Agent aborted'));
        if (child && typeof child.kill === 'function') child.kill();
      };
      const timer = setTimeout(() => {
        if (child && typeof child.kill === 'function') child.kill();
        finish(reject, new Error(`Cursor Agent timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      const args = agentArgs({ model, promptPath, workspace });
      const spec = agentSpawnSpec(args, env);
      child = spawnImpl(spec.command, spec.args, {
        cwd: workspace,
        env: buildAgentEnv(env),
        windowsHide: true,
        shell: spec.shell,
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
      child.on('error', (error) => {
        finish(reject, new Error(`Cursor Agent spawn failed: ${sanitizeAgentDiagnostic(error?.message || error, env, [workspace])}`));
      });
      child.on('close', (code) => {
        if (settled) return;
        if (code !== 0) {
          finish(reject, new Error(`Cursor Agent exited ${code}: ${sanitizeAgentDiagnostic(stderr || stdout, env, [workspace])}`));
          return;
        }
        finish(resolve, collectAgentOutput(stdout) || stdout.trim());
      });
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
