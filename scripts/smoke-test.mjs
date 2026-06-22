import assert from 'node:assert/strict';
import { listen } from '../src/server.mjs';
import { extractOutputText } from '../src/responses.mjs';

process.env.CODEX_CURSOR_BRIDGE_MOCK = '1';
process.env.CODEX_CURSOR_BRIDGE_MOCK_TEXT = 'OK';

const { server, host, port } = await listen({ port: 0, env: { CODEX_CURSOR_BRIDGE_MOCK: '1', CODEX_CURSOR_BRIDGE_MOCK_TEXT: 'OK' } });
const address = server.address();
const actualPort = typeof address === 'object' ? address.port : port;
try {
  const res = await fetch(`http://${host}:${actualPort}/v1/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'cursor-auto',
      input: 'Reply with exactly OK.',
      reasoning: { effort: 'xhigh', summary: 'concise' },
      text: { verbosity: 'high' },
    }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.model, 'cursor-auto');
  assert.equal(body.reasoning.effort, 'xhigh');
  assert.equal(body.text.verbosity, 'high');
  assert.equal(extractOutputText(body), 'OK');
  console.log('smoke_ok');
} finally {
  server.close();
}
