import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { isLoopbackHost, listen } from '../src/server.mjs';
import { extractOutputText } from '../src/responses.mjs';

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function withServer(config, fn) {
  const { server, host } = await listen({ port: 0, env: { CODEX_CURSOR_BRIDGE_MOCK: '1', CODEX_CURSOR_BRIDGE_MOCK_TEXT: 'OK' }, ...config });
  const address = server.address();
  const port = typeof address === 'object' ? address.port : 0;
  try { await fn(`http://${host}:${port}`, { server, host, port }); } finally { await closeServer(server); }
}



test('loopback host detection covers common IPv4 and IPv6 forms', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('127.12.34.56'), true);
  assert.equal(isLoopbackHost('[::1]'), true);
  assert.equal(isLoopbackHost('0:0:0:0:0:0:0:1'), true);
  assert.equal(isLoopbackHost('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackHost('0.0.0.0'), false);
  assert.equal(isLoopbackHost('203.0.113.10'), false);
});

test('listen defaults to loopback host', async () => {
  await withServer({}, async (_base, { host }) => {
    assert.equal(host, '127.0.0.1');
  });
});

test('server handles cursor model responses in mock mode', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/v1/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'cursor-auto', input: 'OK?', reasoning: { effort: 'xhigh' } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(extractOutputText(body), 'OK');
    assert.equal(body.reasoning.effort, 'xhigh');
  });
});

test('server refuses native models by default instead of silently misrouting', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/v1/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.5', input: 'hello' }),
    });
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.equal(body.error.type, 'unsupported_model');
  });
});

test('server exposes health and model list endpoints without leaking workspace path', async () => {
  await withServer({ workspace: '/private/example/workspace' }, async (base) => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(Object.hasOwn(healthBody, 'workspace'), false);
    assert.equal(JSON.stringify(healthBody).includes('/private/example/workspace'), false);
    const models = await fetch(`${base}/v1/models`);
    assert.equal(models.status, 200);
    const body = await models.json();
    assert.equal(body.object, 'list');
    assert.ok(body.data.some((m) => m.id === 'cursor-auto'));
  });
});

test('server rejects malformed JSON and oversized bodies', async () => {
  await withServer({ maxBodyBytes: 20 }, async (base) => {
    const malformed = await fetch(`${base}/v1/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.type, 'invalid_json');

    const oversized = await fetch(`${base}/v1/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'x'.repeat(100) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.type, 'request_too_large');
  });
});

test('listen rejects when the requested port is already in use', async () => {
  await withServer({}, async (_base, { host, port }) => {
    await assert.rejects(listen({ host, port, env: { CODEX_CURSOR_BRIDGE_MOCK: '1' } }), /EADDRINUSE|in use/i);
  });
});


test('listen refuses non-loopback hosts unless explicitly allowed', async () => {
  await assert.rejects(
    listen({ host: '0.0.0.0', port: 0, env: { CODEX_CURSOR_BRIDGE_MOCK: '1' } }),
    /Refusing to bind to non-loopback host/
  );
});
