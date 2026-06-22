import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const binPath = path.resolve('bin/codex-cursor-bridge.mjs');

function runCli(args, { env = {}, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out: ${args.join(' ')}`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

test('doctor command exits successfully and reports catalog, platform and agent probe', async () => {
  const result = await runCli(['doctor'], { env: { CODEX_CURSOR_BRIDGE_MOCK: '1' } });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /node=v/);
  assert.match(result.stdout, /platform=/);
  assert.match(result.stdout, /catalog_valid=true/);
  assert.match(result.stdout, /agent_probe=mock/);
});

test('catalog command writes UTF-8 JSON without BOM', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccb-cli-'));
  const out = path.join(dir, 'catalog.json');
  try {
    const result = await runCli(['catalog', '--out', out]);
    assert.equal(result.code, 0);
    const bytes = await fs.readFile(out);
    assert.notDeepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const json = JSON.parse(bytes.toString('utf8'));
    assert.ok(json.models.some((m) => m.slug === 'cursor-auto'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('serve command can bind an ephemeral loopback port and answer /health', async () => {
  const child = spawn(process.execPath, [binPath, 'serve', '--port', '0'], {
    cwd: process.cwd(),
    env: { ...process.env, CODEX_CURSOR_BRIDGE_MOCK: '1' },
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`server did not start: ${stdout} ${stderr}`)), 10000);
      child.stdout.on('data', () => {
        const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`server exited early with ${code}: ${stdout} ${stderr}`));
      });
    });
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  } finally {
    child.kill();
  }
});
