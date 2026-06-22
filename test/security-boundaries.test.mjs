import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { listen } from '../src/server.mjs';

const sourceFiles = [
  'bin/codex-cursor-bridge.mjs',
  'scripts/check-syntax.mjs',
  'scripts/release-check.mjs',
  'scripts/run-ci.mjs',
  'scripts/run-tests.mjs',
  'scripts/smoke-test.mjs',
  'examples/curl.sh',
  'examples/codex-config.toml',
  'src/cursor-agent.mjs',
  'src/doctor.mjs',
  'src/server.mjs',
  'src/prompt.mjs',
  'src/responses.mjs',
  'src/model-catalog.mjs',
];

test('source does not contain credential-store scraping primitives', async () => {
  const combined = (await Promise.all(sourceFiles.map((file) => fs.readFile(path.resolve(file), 'utf8')))).join('\n');
  for (const forbidden of ['keychain', 'cookie', 'cookies', 'LevelDB', 'Local State', 'Login Data']) {
    assert.equal(combined.toLowerCase().includes(forbidden.toLowerCase()), false, `forbidden credential term found: ${forbidden}`);
  }
  assert.equal(/readFileSync\s*\(/.test(combined), false);
  assert.equal(/shell\s*:\s*true/.test(combined), false);
});

test('server loopback default is enforced by API contract', async () => {
  const { server, host } = await listen({ port: 0, env: { CODEX_CURSOR_BRIDGE_MOCK: '1' } });
  try {
    assert.equal(host, '127.0.0.1');
    assert.equal(server.address().address, '127.0.0.1');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
